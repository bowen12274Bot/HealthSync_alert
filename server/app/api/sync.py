import base64
from datetime import datetime
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.periodic_health_record import PeriodicHealthRecord


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


class SyncBatchRequest(BaseModel):
    user_id: str
    device_id: str
    sync_started_at: datetime
    periodic_health_records: list[PeriodicHealthRecordSchema]
    alerts: list[dict[str, Any]] = Field(default_factory=list)


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

        # TODO: Process alerts when implemented in the future
        accepted_alert_count = len(request.alerts)

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
