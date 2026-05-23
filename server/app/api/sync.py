import base64
import json
from datetime import datetime, timezone
from typing import Annotated, Optional, TypedDict, cast

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.alert_history import AlertHistory
from app.models.periodic_health_record import PeriodicHealthRecord
from app.models.periodic_health_record_analysis_status import (
    PeriodicHealthRecordAnalysisStatus,
)
from app.api.auth import get_authenticated_session, AuthenticatedSession


router = APIRouter(prefix="/sync", tags=["sync"])
DbSession = Annotated[Session, Depends(get_db)]


class PeriodicHealthRecordInsertRow(TypedDict):
    user_id: str
    device_id: str
    window_start: datetime
    window_end: datetime
    avg_hr: int
    min_hr: int
    max_hr: int
    avg_hrv: int
    avg_spo2: float
    min_spo2: float
    dominant_activity_level: int
    sample_count: int
    steps: int
    raw_data_payload: bytes | None


class AlertHistoryInsertRow(TypedDict):
    user_id: str
    user_account_id: int
    alert_source: str
    alert_id: str
    alert_type: str
    max_risk_score: int
    max_severity_level: str
    trigger_reason: str
    first_occurred_at: datetime
    last_abnormal_at: datetime
    resolved_at: datetime | None
    duration: int | None
    status_change_count: int
    is_worsened: bool
    status_history_payload: str
    status: str


def validate_utc_datetime(dt: Optional[datetime], field_name: str) -> None:
    if dt is None:
        return
    if dt.tzinfo is None:
        raise ValueError(f"Time field '{field_name}' must have timezone info")
    offset = dt.utcoffset()
    if offset is None or offset.total_seconds() != 0:
        raise ValueError(f"Time field '{field_name}' must be in UTC timezone")


class PeriodicHealthRecordSchema(BaseModel):
    window_start: datetime
    window_end: datetime
    avg_hr: int
    min_hr: int
    max_hr: int
    avg_hrv: int
    avg_spo2: float
    min_spo2: float
    dominant_activity_level: int
    sample_count: int
    steps: int = Field(0, description="Steps count during this window")
    raw_data_payload: Optional[str] = Field(
        None, description="Base64 encoded binary data (MsgPack + ZSTD)"
    )


class StatusHistoryItemSchema(BaseModel):
    status: str
    risk_score: int
    status_time: datetime
    status_description: str


class AlertSyncSchema(BaseModel):
    alert_id: str
    alert_type: str
    trigger_reason: str
    initial_risk_score: int
    max_risk_score: int
    max_severity_level: str
    first_occurred_at: datetime
    resolved_at: Optional[datetime] = None
    status_change_count: int
    status_history: list[StatusHistoryItemSchema]


class SyncBatchRequest(BaseModel):
    device_id: str
    sync_started_at: datetime
    periodic_health_records: list[PeriodicHealthRecordSchema]
    alerts: list[AlertSyncSchema] = Field(
        default_factory=lambda: cast(list[AlertSyncSchema], [])
    )


class SyncBatchResponse(BaseModel):
    success: bool
    accepted_health_record_count: int
    accepted_alert_count: int
    server_received_at: datetime


@router.post("/batch", response_model=SyncBatchResponse)
def sync_batch(
    request: SyncBatchRequest,
    db: DbSession,
    session: Annotated[AuthenticatedSession, Depends(get_authenticated_session)],
):
    server_received_at = datetime.now(timezone.utc)
    accepted_health_record_count = 0
    accepted_alert_count = 0

    try:
        user_account_id = session.user.id
        db_user_id = f"user_{user_account_id}"

        # 1. Validate sync global time
        validate_utc_datetime(request.sync_started_at, "sync_started_at")

        # Process Periodic Health Records
        if request.periodic_health_records:
            records_to_insert: list[PeriodicHealthRecordInsertRow] = []
            for record in request.periodic_health_records:
                # Time validation
                validate_utc_datetime(record.window_start, "window_start")
                validate_utc_datetime(record.window_end, "window_end")

                # Consistency validation
                if record.window_start >= record.window_end:
                    raise ValueError("window_start must be before window_end")
                if record.sample_count < 0:
                    raise ValueError("sample_count must be non-negative")

                # Decode Base64 to bytes if present
                raw_bytes = None
                if record.raw_data_payload:
                    try:
                        raw_bytes = base64.b64decode(record.raw_data_payload, validate=True)
                    except Exception as e:
                        # Log error but raise to rollback transaction
                        raise ValueError(f"Invalid Base64 in raw_data_payload: {e}")

                records_to_insert.append({
                    "user_id": db_user_id,
                    "device_id": request.device_id,
                    "window_start": record.window_start,
                    "window_end": record.window_end,
                    "avg_hr": record.avg_hr,
                    "min_hr": record.min_hr,
                    "max_hr": record.max_hr,
                    "avg_hrv": record.avg_hrv,
                    "avg_spo2": record.avg_spo2,
                    "min_spo2": record.min_spo2,
                    "dominant_activity_level": record.dominant_activity_level,
                    "sample_count": record.sample_count,
                    "steps": record.steps,
                    "raw_data_payload": raw_bytes,
                })
            # Idempotent bulk insert (Upsert/Do nothing on conflict)
            stmt = insert(PeriodicHealthRecord).values(records_to_insert)
            stmt = stmt.on_conflict_do_nothing(
                index_elements=['user_id', 'window_start', 'window_end']
            )
            result = db.execute(stmt)
            accepted_health_record_count = cast(
                int,
                getattr(result, "rowcount", -1),
            )
            if accepted_health_record_count == -1:
                accepted_health_record_count = len(records_to_insert)

            # Ensure every periodic health record has a paired analysis status row.
            window_pairs: list[tuple[datetime, datetime]] = [
                (record["window_start"], record["window_end"])
                for record in records_to_insert
            ]
            status_target_record_ids = db.execute(
                select(PeriodicHealthRecord.id).where(
                    PeriodicHealthRecord.user_id == db_user_id,
                    tuple_(
                        PeriodicHealthRecord.window_start,
                        PeriodicHealthRecord.window_end,
                    ).in_(window_pairs),
                )
            ).scalars().all()

            if status_target_record_ids:
                status_stmt = insert(PeriodicHealthRecordAnalysisStatus).values([
                    {"periodic_health_record_id": record_id}
                    for record_id in status_target_record_ids
                ])
                status_stmt = status_stmt.on_conflict_do_nothing(
                    index_elements=["periodic_health_record_id"]
                )
                db.execute(status_stmt)

        # Process alerts
        if request.alerts:
            alerts_to_insert: list[AlertHistoryInsertRow] = []
            for alert in request.alerts:
                # Time validation
                validate_utc_datetime(alert.first_occurred_at, "first_occurred_at")
                validate_utc_datetime(alert.resolved_at, "resolved_at")

                # Consistency validation
                if not alert.status_history:
                    raise ValueError("status_history cannot be empty")
                if alert.status_change_count != len(alert.status_history):
                    raise ValueError("status_change_count must match status_history length")

                max_hist_risk = max(sh.risk_score for sh in alert.status_history)
                if alert.max_risk_score < max_hist_risk:
                    raise ValueError("max_risk_score cannot be less than the maximum risk score in status history")

                for sh in alert.status_history:
                    validate_utc_datetime(sh.status_time, "status_time")
                    if alert.first_occurred_at > sh.status_time:
                        raise ValueError("first_occurred_at cannot be after status_time")

                if alert.resolved_at:
                    if alert.resolved_at < alert.first_occurred_at:
                        raise ValueError("resolved_at cannot be before first_occurred_at")
                    for sh in alert.status_history:
                        if sh.status_time > alert.resolved_at:
                            raise ValueError("status_time cannot be after resolved_at")
                    # Check that alert has resolved status in history
                    resolved_statuses = {"已解除", "已轉移"}
                    if not any(sh.status in resolved_statuses for sh in alert.status_history):
                        raise ValueError("resolved alert must contain a resolved status in status history")

                duration = None
                if alert.resolved_at and alert.first_occurred_at:
                    duration = int((alert.resolved_at - alert.first_occurred_at).total_seconds())
                
                is_worsened = alert.max_risk_score > alert.initial_risk_score
                
                # Determine last_abnormal_at
                last_abnormal = alert.first_occurred_at
                for sh in alert.status_history:
                    if sh.status_time > last_abnormal:
                        last_abnormal = sh.status_time
                
                alerts_to_insert.append({
                    "user_id": db_user_id,
                    "user_account_id": user_account_id,
                    "alert_source": "mobile",
                    "alert_id": alert.alert_id,
                    "alert_type": alert.alert_type,
                    "max_risk_score": alert.max_risk_score,
                    "max_severity_level": alert.max_severity_level,
                    "trigger_reason": alert.trigger_reason,
                    "first_occurred_at": alert.first_occurred_at,
                    "last_abnormal_at": last_abnormal,
                    "resolved_at": alert.resolved_at,
                    "duration": duration,
                    "status_change_count": alert.status_change_count,
                    "is_worsened": is_worsened,
                    "status_history_payload": json.dumps([item.model_dump(mode='json') for item in alert.status_history]),
                    "status": "resolved" if alert.resolved_at else "pending"
                })
            
            stmt = insert(AlertHistory).values(alerts_to_insert)
            stmt = stmt.on_conflict_do_nothing(
                index_elements=['alert_id']
            )
            result = db.execute(stmt)
            accepted_alert_count = cast(
                int,
                getattr(result, "rowcount", -1),
            )
            if accepted_alert_count == -1:
                accepted_alert_count = len(alerts_to_insert)
        else:
            accepted_alert_count = 0

        # Commit transaction
        db.commit()

        return SyncBatchResponse(
            success=True,
            accepted_health_record_count=accepted_health_record_count,
            accepted_alert_count=accepted_alert_count,
            server_received_at=server_received_at
        )

    except ValueError as ve:
        db.rollback()
        return JSONResponse(
            status_code=400,
            content={"success": False, "error_code": "VALIDATION_FAILED", "message": str(ve)}
        )
    except SQLAlchemyError as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error_code": "DATABASE_ERROR", "message": f"Failed to save sync data: {str(e)}"}
        )
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error_code": "INTERNAL_SERVER_ERROR", "message": str(e)}
        )
