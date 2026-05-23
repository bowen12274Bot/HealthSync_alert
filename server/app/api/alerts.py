import json
from datetime import datetime
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import AuthenticatedSession, get_authenticated_session
from app.core.database import get_db
from app.models.alert_history import AlertHistory
from app.models.long_term_alert import LongTermAlert


router = APIRouter(prefix="/alerts", tags=["alerts"])
DbSession = Annotated[Session, Depends(get_db)]
AuthenticatedUser = Annotated[AuthenticatedSession, Depends(get_authenticated_session)]
TAIPEI_TIMEZONE = ZoneInfo("Asia/Taipei")


class AlertHistoryRecordResponse(BaseModel):
    record_id: str
    source_type: Literal["realtime", "long_term"]
    source_table: Literal["alert_histories", "long_term_alerts"]
    source_key: str
    alert_type: str
    alert_type_label: str
    title: str
    summary: str
    history_type_label: str
    display_severity: Literal["mild", "moderate", "high"]
    display_severity_label: str
    status: str
    status_label: str
    occurred_at: datetime
    resolved_at: datetime | None
    time_range_label: str
    created_at: datetime


class AlertHistoryListResponse(BaseModel):
    records: list[AlertHistoryRecordResponse]
    server_generated_at: datetime


class AlertStatusHistoryItemResponse(BaseModel):
    status: str
    status_label: str
    risk_score: int
    status_time: datetime
    status_description: str


class AlertHistoryDetailResponse(BaseModel):
    record_id: str
    source_type: Literal["realtime", "long_term"]
    source_table: Literal["alert_histories", "long_term_alerts"]
    source_key: str
    alert_type: str
    alert_type_label: str
    title: str
    summary: str
    history_type_label: str
    display_severity: Literal["mild", "moderate", "high"]
    display_severity_label: str
    status: str
    status_label: str
    occurred_at: datetime
    resolved_at: datetime | None
    time_range_label: str
    created_at: datetime
    trigger_reason: str
    alert_id: str | None = None
    max_risk_score: int | None = None
    max_severity_level: str | None = None
    first_occurred_at: datetime | None = None
    last_abnormal_at: datetime | None = None
    duration_seconds: int | None = None
    status_change_count: int | None = None
    is_worsened: bool | None = None
    status_history: list[AlertStatusHistoryItemResponse] | None = None
    long_term_alert_id: int | None = None
    risk_score: int | None = None
    window_start: datetime | None = None
    window_end: datetime | None = None
    updated_at: datetime | None = None


class AlertHistoryDetailEnvelopeResponse(BaseModel):
    detail: AlertHistoryDetailResponse


@router.get("/history", response_model=AlertHistoryListResponse)
def list_alert_history(
    session: AuthenticatedUser,
    db: DbSession,
    limit: int = Query(default=50, ge=1, le=200),
) -> AlertHistoryListResponse:
    realtime_records = [
        build_alert_history_record(record)
        for record in (
            db.query(AlertHistory)
            .filter(AlertHistory.user_account_id == session.user.id)
            .order_by(AlertHistory.first_occurred_at.desc(), AlertHistory.created_at.desc())
            .limit(limit)
            .all()
        )
    ]
    long_term_records = [
        build_long_term_record(record)
        for record in (
            db.query(LongTermAlert)
            .filter(LongTermAlert.user_account_id == session.user.id)
            .order_by(LongTermAlert.window_start.desc(), LongTermAlert.created_at.desc())
            .limit(limit)
            .all()
        )
    ]
    records = sorted(
        [*realtime_records, *long_term_records],
        key=lambda item: (item.occurred_at, item.created_at),
        reverse=True,
    )[:limit]

    return AlertHistoryListResponse(
        records=records,
        server_generated_at=datetime.now(TAIPEI_TIMEZONE),
    )


@router.get("/history/{record_id}", response_model=AlertHistoryDetailEnvelopeResponse)
def get_alert_history_detail(
    record_id: str,
    session: AuthenticatedUser,
    db: DbSession,
) -> AlertHistoryDetailEnvelopeResponse:
    source_type, internal_id = parse_record_id(record_id)

    if source_type == "alert_history":
        record = (
            db.query(AlertHistory)
            .filter(
                AlertHistory.id == internal_id,
                AlertHistory.user_account_id == session.user.id,
            )
            .first()
        )
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert history not found")
        return AlertHistoryDetailEnvelopeResponse(detail=build_alert_history_detail(record))

    record = (
        db.query(LongTermAlert)
        .filter(
            LongTermAlert.id == internal_id,
            LongTermAlert.user_account_id == session.user.id,
        )
        .first()
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Long-term alert not found")
    return AlertHistoryDetailEnvelopeResponse(detail=build_long_term_detail(record))


def parse_record_id(record_id: str) -> tuple[Literal["alert_history", "long_term_alert"], int]:
    prefix, separator, raw_id = record_id.partition(":")
    if separator != ":" or prefix not in {"alert_history", "long_term_alert"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert record not found")
    try:
        parsed_id = int(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert record not found") from exc

    if prefix == "alert_history":
        return "alert_history", parsed_id

    return "long_term_alert", parsed_id


def build_alert_history_record(record: AlertHistory) -> AlertHistoryRecordResponse:
    display_severity, display_severity_label = map_realtime_severity(record.max_risk_score)
    status_label = map_realtime_status_label(record.status)
    alert_type_label = map_alert_type_label(record.alert_type)
    return AlertHistoryRecordResponse(
        record_id=f"alert_history:{record.id}",
        source_type="realtime",
        source_table="alert_histories",
        source_key=record.alert_id,
        alert_type=record.alert_type,
        alert_type_label=alert_type_label,
        title=map_realtime_title(record.alert_type),
        summary=record.trigger_reason,
        history_type_label="即時預警",
        display_severity=display_severity,
        display_severity_label=display_severity_label,
        status=record.status,
        status_label=status_label,
        occurred_at=record.first_occurred_at,
        resolved_at=record.resolved_at,
        time_range_label=format_single_time(record.first_occurred_at),
        created_at=record.created_at,
    )


def build_long_term_record(record: LongTermAlert) -> AlertHistoryRecordResponse:
    display_severity, display_severity_label = map_long_term_severity(record.risk_score)
    alert_type_label = map_long_term_alert_type_label(record.alert_type)
    return AlertHistoryRecordResponse(
        record_id=f"long_term_alert:{record.id}",
        source_type="long_term",
        source_table="long_term_alerts",
        source_key=str(record.id),
        alert_type=record.alert_type,
        alert_type_label=alert_type_label,
        title=alert_type_label,
        summary=record.trigger_reason,
        history_type_label="長期預警",
        display_severity=display_severity,
        display_severity_label=display_severity_label,
        status=record.status,
        status_label=map_long_term_status_label(record.status),
        occurred_at=record.window_start,
        resolved_at=record.window_end,
        time_range_label=format_time_range(record.window_start, record.window_end),
        created_at=record.created_at,
    )


def build_alert_history_detail(record: AlertHistory) -> AlertHistoryDetailResponse:
    base = build_alert_history_record(record)
    return AlertHistoryDetailResponse(
        **base.model_dump(),
        trigger_reason=record.trigger_reason,
        alert_id=record.alert_id,
        max_risk_score=record.max_risk_score,
        max_severity_level=record.max_severity_level,
        first_occurred_at=record.first_occurred_at,
        last_abnormal_at=record.last_abnormal_at,
        duration_seconds=record.duration,
        status_change_count=record.status_change_count,
        is_worsened=record.is_worsened,
        status_history=parse_status_history(record.status_history_payload),
    )


def build_long_term_detail(record: LongTermAlert) -> AlertHistoryDetailResponse:
    base = build_long_term_record(record)
    return AlertHistoryDetailResponse(
        **base.model_dump(),
        trigger_reason=record.trigger_reason,
        long_term_alert_id=record.id,
        risk_score=record.risk_score,
        window_start=record.window_start,
        window_end=record.window_end,
        updated_at=record.updated_at,
    )


def parse_status_history(payload: str | None) -> list[AlertStatusHistoryItemResponse]:
    if not payload:
        return []
    try:
        raw_items = json.loads(payload)
    except json.JSONDecodeError:
        return []

    items: list[AlertStatusHistoryItemResponse] = []
    for item in raw_items:
        status = str(item.get("status", ""))
        status_time_raw = item.get("status_time")
        try:
            status_time = datetime.fromisoformat(str(status_time_raw).replace("Z", "+00:00"))
        except ValueError:
            continue
        items.append(
            AlertStatusHistoryItemResponse(
                status=status,
                status_label=map_realtime_status_label(status),
                risk_score=int(item.get("risk_score", 0)),
                status_time=status_time,
                status_description=str(item.get("status_description", "")),
            )
        )
    return items


def map_alert_type_label(alert_type: str) -> str:
    return {
        "spo2_risk": "血氧風險",
        "physiological_stress": "生理壓力",
        "combined_physiological_risk": "複合生理風險",
    }.get(alert_type, "生理異常")


def map_realtime_title(alert_type: str) -> str:
    return {
        "spo2_risk": "血氧過低",
        "physiological_stress": "生理壓力異常",
        "combined_physiological_risk": "發現異常指標",
    }.get(alert_type, "發現異常指標")


def map_long_term_alert_type_label(alert_type: str) -> str:
    return {
        "trend": "長期趨勢風險",
        "history_pattern": "長期歷史模式風險",
    }.get(alert_type, "長期預警")


def map_realtime_status_label(status_value: str) -> str:
    return {
        "resolved": "已解除",
        "pending": "處理中",
        "觀察中": "觀察中",
        "注意": "注意",
        "警戒": "警戒",
        "恢復中": "恢復中",
        "已解除": "已解除",
        "已轉移": "已轉移",
    }.get(status_value, status_value)


def map_long_term_status_label(status_value: str) -> str:
    return {
        "active": "進行中",
        "resolved": "已結束",
    }.get(status_value, status_value)


def map_realtime_severity(risk_score: int) -> tuple[Literal["mild", "moderate", "high"], str]:
    if risk_score <= 4:
        return "mild", "輕度"
    if risk_score <= 6:
        return "moderate", "中度"
    return "high", "高度"


def map_long_term_severity(risk_score: int) -> tuple[Literal["mild", "moderate", "high"], str]:
    if risk_score < 70:
        return "mild", "輕度"
    if risk_score < 85:
        return "moderate", "中度"
    return "high", "高度"


def format_single_time(value: datetime) -> str:
    return value.astimezone(TAIPEI_TIMEZONE).strftime("%Y/%m/%d %H:%M")


def format_time_range(start: datetime, end: datetime) -> str:
    return f"{format_single_time(start)} ~ {format_single_time(end)}"
