import base64
import json
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.alert_history import AlertHistory
from app.models.periodic_health_record import PeriodicHealthRecord
from app.models.user_account import UserAccount


router = APIRouter(prefix="/sync", tags=["sync"])
DbSession = Annotated[Session, Depends(get_db)]


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
    user_id: str
    device_id: str
    sync_started_at: datetime
    periodic_health_records: list[PeriodicHealthRecordSchema]
    alerts: list[AlertSyncSchema] = Field(default_factory=list)


class SyncBatchResponse(BaseModel):
    success: bool
    accepted_health_record_count: int
    accepted_alert_count: int
    server_received_at: datetime


@router.post("/batch", response_model=SyncBatchResponse)
def sync_batch(request: SyncBatchRequest, db: DbSession):
    server_received_at = datetime.now()
    accepted_health_record_count = 0
    accepted_alert_count = 0

    try:
        # TODO: 目前以第一筆帳號作為 user_account_id 的解析來源。
        # 未來應改為從 JWT Token 或 user_id 對應表中查詢正確的 user_account.id。
        user_account = db.query(UserAccount).first()
        if not user_account:
            raise ValueError("No user account found in the system.")
        user_account_id = user_account.id

        # Process Periodic Health Records
        if request.periodic_health_records:
            records_to_insert = []
            for record in request.periodic_health_records:
                # Decode Base64 to bytes if present
                raw_bytes = None
                if record.raw_data_payload:
                    try:
                        raw_bytes = base64.b64decode(record.raw_data_payload)
                    except Exception as e:
                        # Log error but raise to rollback transaction
                        raise ValueError(f"Invalid Base64 in raw_data_payload: {e}")

                records_to_insert.append({
                    "user_id": request.user_id,
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
                    "raw_data_payload": raw_bytes,
                })

            # Idempotent bulk insert (Upsert/Do nothing on conflict)
            stmt = insert(PeriodicHealthRecord).values(records_to_insert)
            stmt = stmt.on_conflict_do_nothing(
                index_elements=['user_id', 'window_start', 'window_end']
            )
            result = db.execute(stmt)
            accepted_health_record_count = result.rowcount

        # Process alerts
        if request.alerts:
            alerts_to_insert = []
            for alert in request.alerts:
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
                    "user_id": request.user_id,
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
            accepted_alert_count = result.rowcount
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
            content={"success": False, "error_code": "DATABASE_ERROR", "message": "Failed to save sync data"}
        )
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error_code": "INTERNAL_SERVER_ERROR", "message": str(e)}
        )
