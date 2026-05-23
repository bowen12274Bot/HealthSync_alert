from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import AuthenticatedSession, get_authenticated_session
from app.core.database import get_db
from app.models.long_term_alert import LongTermAlert
from app.models.periodic_health_record import PeriodicHealthRecord


router = APIRouter(prefix="/trends", tags=["trends"])


class TrendPointResponse(BaseModel):
    timestamp: datetime
    value: float


class TrendMetricSummaryResponse(BaseModel):
    average: float | None
    delta_from_previous: float | None


class TrendMetricResponse(BaseModel):
    points: list[TrendPointResponse]
    summary: TrendMetricSummaryResponse


class TrendWindowResponse(BaseModel):
    month: str
    label: str
    start_at: datetime
    end_at: datetime
    previous_start_at: datetime
    previous_end_at: datetime


class LongTermAlertHintResponse(BaseModel):
    has_alert: bool
    count: int
    latest_alert_type: str | None = None
    latest_alert_type_label: str | None = None
    latest_risk_score: int | None = None
    latest_severity_label: str | None = None
    latest_trigger_reason: str | None = None
    latest_window_start: datetime | None = None
    latest_window_end: datetime | None = None


class LongTermTrendReportResponse(BaseModel):
    mode: str = "long_term"
    window: TrendWindowResponse
    hr: TrendMetricResponse
    spo2: TrendMetricResponse
    hrv: TrendMetricResponse
    alert_hint: LongTermAlertHintResponse
    server_generated_at: datetime


@dataclass(frozen=True)
class TrendWindow:
    month: str
    start_at: datetime
    end_at: datetime
    previous_start_at: datetime
    previous_end_at: datetime

    @property
    def label(self) -> str:
        return f"{self.start_at:%Y/%m/%d} - {self.end_at:%Y/%m/%d}"


@dataclass(frozen=True)
class DailyMetricPoint:
    timestamp: datetime
    hr: float
    spo2: float
    hrv: float


def parse_month_window(month_value: str) -> TrendWindow:
    try:
        month_anchor = datetime.strptime(month_value, "%Y-%m").date()
    except ValueError as error:
        raise HTTPException(status_code=400, detail="month must be formatted as YYYY-MM") from error

    month_start = month_anchor.replace(day=1)
    if month_start.month == 12:
        next_month_start = month_start.replace(year=month_start.year + 1, month=1, day=1)
    else:
        next_month_start = month_start.replace(month=month_start.month + 1, day=1)

    selected_month_end = next_month_start - timedelta(days=1)
    current_window_start_date = selected_month_end - timedelta(days=29)
    previous_window_end_date = current_window_start_date - timedelta(days=1)
    previous_window_start_date = previous_window_end_date - timedelta(days=29)

    return TrendWindow(
        month=month_value,
        start_at=datetime.combine(current_window_start_date, time.min, tzinfo=UTC),
        end_at=datetime.combine(selected_month_end, time.max, tzinfo=UTC),
        previous_start_at=datetime.combine(previous_window_start_date, time.min, tzinfo=UTC),
        previous_end_at=datetime.combine(previous_window_end_date, time.max, tzinfo=UTC),
    )


def average(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def normalize_numeric(value: Decimal | float | int) -> float:
    return round(float(value), 2)


def aggregate_daily_points(records: list[PeriodicHealthRecord]) -> list[DailyMetricPoint]:
    grouped: dict[date, list[PeriodicHealthRecord]] = defaultdict(list)
    for record in records:
        grouped[record.window_start.date()].append(record)

    points: list[DailyMetricPoint] = []
    for day in sorted(grouped.keys()):
        day_records = grouped[day]
        day_timestamp = datetime.combine(day, time.min, tzinfo=UTC)
        points.append(
            DailyMetricPoint(
                timestamp=day_timestamp,
                hr=round(sum(record.avg_hr for record in day_records) / len(day_records), 2),
                spo2=round(sum(normalize_numeric(record.avg_spo2) for record in day_records) / len(day_records), 2),
                hrv=round(sum(record.avg_hrv for record in day_records) / len(day_records), 2),
            )
        )

    return points


def build_metric_response(
    current_points: list[DailyMetricPoint],
    previous_points: list[DailyMetricPoint],
    metric_name: str,
) -> TrendMetricResponse:
    current_values = [getattr(point, metric_name) for point in current_points]
    previous_values = [getattr(point, metric_name) for point in previous_points]
    current_average = average(current_values)
    previous_average = average(previous_values)

    if current_average is not None and previous_average is not None:
        delta = round(current_average - previous_average, 2)
    else:
        delta = None

    return TrendMetricResponse(
        points=[
            TrendPointResponse(timestamp=point.timestamp, value=getattr(point, metric_name))
            for point in current_points
        ],
        summary=TrendMetricSummaryResponse(
            average=current_average,
            delta_from_previous=delta,
        ),
    )


def map_long_term_alert_type_label(alert_type: str) -> str:
    return {
        "trend": "長期趨勢風險",
        "history_pattern": "長期歷史模式風險",
    }.get(alert_type, "長期預警")


def map_long_term_severity_label(risk_score: int) -> str:
    if risk_score < 70:
        return "輕度"
    if risk_score < 85:
        return "中度"
    return "高度"


def build_alert_hint(records: list[LongTermAlert]) -> LongTermAlertHintResponse:
    if not records:
        return LongTermAlertHintResponse(
            has_alert=False,
            count=0,
        )

    latest_record = max(records, key=lambda record: record.window_end)
    return LongTermAlertHintResponse(
        has_alert=True,
        count=len(records),
        latest_alert_type=latest_record.alert_type,
        latest_alert_type_label=map_long_term_alert_type_label(latest_record.alert_type),
        latest_risk_score=latest_record.risk_score,
        latest_severity_label=map_long_term_severity_label(latest_record.risk_score),
        latest_trigger_reason=latest_record.trigger_reason,
        latest_window_start=latest_record.window_start,
        latest_window_end=latest_record.window_end,
    )


@router.get("/long-term", response_model=LongTermTrendReportResponse)
def get_long_term_trend_report(
    month: str = Query(..., description="Target month in YYYY-MM format"),
    db: Session = Depends(get_db),
    session: AuthenticatedSession = Depends(get_authenticated_session),
) -> LongTermTrendReportResponse:
    window = parse_month_window(month)
    db_user_id = f"user_{session.user.id}"

    current_records = db.execute(
        select(PeriodicHealthRecord)
        .where(
            PeriodicHealthRecord.user_id == db_user_id,
            PeriodicHealthRecord.window_start >= window.start_at,
            PeriodicHealthRecord.window_end <= window.end_at,
        )
        .order_by(PeriodicHealthRecord.window_start.asc())
    ).scalars().all()

    previous_records = db.execute(
        select(PeriodicHealthRecord)
        .where(
            PeriodicHealthRecord.user_id == db_user_id,
            PeriodicHealthRecord.window_start >= window.previous_start_at,
            PeriodicHealthRecord.window_end <= window.previous_end_at,
        )
        .order_by(PeriodicHealthRecord.window_start.asc())
    ).scalars().all()

    current_daily_points = aggregate_daily_points(current_records)
    previous_daily_points = aggregate_daily_points(previous_records)

    current_long_term_alerts = db.execute(
        select(LongTermAlert)
        .where(
            LongTermAlert.user_account_id == session.user.id,
            LongTermAlert.window_start >= window.start_at,
            LongTermAlert.window_end <= window.end_at,
        )
        .order_by(LongTermAlert.window_end.desc())
    ).scalars().all()

    return LongTermTrendReportResponse(
        window=TrendWindowResponse(
            month=window.month,
            label=window.label,
            start_at=window.start_at,
            end_at=window.end_at,
            previous_start_at=window.previous_start_at,
            previous_end_at=window.previous_end_at,
        ),
        hr=build_metric_response(current_daily_points, previous_daily_points, "hr"),
        spo2=build_metric_response(current_daily_points, previous_daily_points, "spo2"),
        hrv=build_metric_response(current_daily_points, previous_daily_points, "hrv"),
        alert_hint=build_alert_hint(current_long_term_alerts),
        server_generated_at=datetime.now(UTC),
    )
