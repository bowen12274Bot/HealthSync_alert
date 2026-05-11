from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.health_check_record import HealthCheckRecord


router = APIRouter(tags=["health"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "HealthSync Alert API"}


@router.get("/db-health")
def db_health_check(db: DbSession) -> dict[str, int | str]:
    db.execute(text("SELECT 1"))
    record_count = db.query(HealthCheckRecord).count()
    return {
        "status": "ok",
        "database": "connected",
        "table": HealthCheckRecord.__tablename__,
        "record_count": record_count,
    }


@router.post("/db-test-records")
def create_db_test_record(db: DbSession) -> dict[str, int | str]:
    record = HealthCheckRecord(message="Database connection test")
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "status": "created",
        "id": record.id,
        "message": record.message,
    }
