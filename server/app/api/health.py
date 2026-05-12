from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.health_check_record import HealthCheckRecord


router = APIRouter(tags=["health"])
DbSession = Annotated[Session, Depends(get_db)]


def database_error_response(message: str) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "status": "error",
            "message": message,
        },
    )


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "HealthSync Alert API"}


@router.get("/db-health", response_model=None)
def db_health_check(db: DbSession) -> dict[str, int | str] | JSONResponse:
    try:
        db.execute(text("SELECT 1"))
        record_count = db.query(HealthCheckRecord).count()
        return {
            "status": "ok",
            "database": "connected",
            "table": HealthCheckRecord.__tablename__,
            "record_count": record_count,
        }
    except SQLAlchemyError:
        return database_error_response("Database unavailable")


@router.post("/db-test-records", response_model=None)
def create_db_test_record(db: DbSession) -> dict[str, int | str] | JSONResponse:
    try:
        record = HealthCheckRecord(message="Database connection test")
        db.add(record)
        db.commit()
        db.refresh(record)

        return {
            "status": "created",
            "id": record.id,
            "message": record.message,
        }
    except SQLAlchemyError:
        db.rollback()
        return database_error_response("Failed to create test record")
