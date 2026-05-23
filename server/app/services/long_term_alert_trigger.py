from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.alert_history import AlertHistory
from app.models.periodic_health_record import PeriodicHealthRecord
from app.models.periodic_health_record_analysis_status import (
    PeriodicHealthRecordAnalysisStatus,
)
from app.utils.analysis_windows import AnalysisWindow


class TrendAnalysisPeriod(str, Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


@dataclass(frozen=True)
class TrendTriggerDecision:
    should_run: bool
    period: TrendAnalysisPeriod
    expected_record_count: int
    actual_record_count: int
    coverage_ratio: float
    required_coverage_ratio: float
    unanalyzed_record_count: int


@dataclass(frozen=True)
class HistoryTriggerDecision:
    should_run: bool
    alert_count: int


def _expected_periodic_record_count(window: AnalysisWindow) -> int:
    total_seconds = (window.window_end - window.window_start).total_seconds()
    return int(total_seconds // 600)


def _required_trend_coverage_ratio(period: TrendAnalysisPeriod) -> float:
    if period == TrendAnalysisPeriod.WEEKLY:
        return 0.75
    return 0.70


def evaluate_trend_trigger(
    db: Session,
    user_id: str,
    window: AnalysisWindow,
    period: TrendAnalysisPeriod,
) -> TrendTriggerDecision:
    expected_record_count = _expected_periodic_record_count(window)
    required_coverage_ratio = _required_trend_coverage_ratio(period)

    actual_record_count = db.execute(
        select(func.count(PeriodicHealthRecord.id)).where(
            PeriodicHealthRecord.user_id == user_id,
            PeriodicHealthRecord.window_start >= window.window_start,
            PeriodicHealthRecord.window_end <= window.window_end,
        )
    ).scalar_one()

    coverage_ratio = (
        actual_record_count / expected_record_count
        if expected_record_count > 0
        else 0.0
    )

    status_flag = (
        PeriodicHealthRecordAnalysisStatus.is_trend_weekly_analyzed
        if period == TrendAnalysisPeriod.WEEKLY
        else PeriodicHealthRecordAnalysisStatus.is_trend_monthly_analyzed
    )

    unanalyzed_record_count = db.execute(
        select(func.count(PeriodicHealthRecord.id))
        .select_from(PeriodicHealthRecord)
        .outerjoin(
            PeriodicHealthRecordAnalysisStatus,
            PeriodicHealthRecordAnalysisStatus.periodic_health_record_id
            == PeriodicHealthRecord.id,
        )
        .where(
            PeriodicHealthRecord.user_id == user_id,
            PeriodicHealthRecord.window_start >= window.window_start,
            PeriodicHealthRecord.window_end <= window.window_end,
            or_(
                PeriodicHealthRecordAnalysisStatus.id.is_(None),
                status_flag.is_(False),
            ),
        )
    ).scalar_one()

    should_run = (
        coverage_ratio >= required_coverage_ratio and unanalyzed_record_count > 0
    )

    return TrendTriggerDecision(
        should_run=should_run,
        period=period,
        expected_record_count=expected_record_count,
        actual_record_count=actual_record_count,
        coverage_ratio=coverage_ratio,
        required_coverage_ratio=required_coverage_ratio,
        unanalyzed_record_count=unanalyzed_record_count,
    )


def evaluate_history_trigger(
    db: Session,
    user_id: str,
    window: AnalysisWindow,
) -> HistoryTriggerDecision:
    alert_count = db.execute(
        select(func.count(AlertHistory.id)).where(
            AlertHistory.user_id == user_id,
            AlertHistory.first_occurred_at >= window.window_start,
            AlertHistory.first_occurred_at < window.window_end,
        )
    ).scalar_one()

    return HistoryTriggerDecision(
        should_run=True,
        alert_count=alert_count,
    )
