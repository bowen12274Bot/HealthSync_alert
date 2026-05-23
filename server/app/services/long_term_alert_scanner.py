from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.orm import Session

from app.utils.analysis_windows import (
    AnalysisWindow,
    DailyScanWindows,
    derive_daily_scan_windows,
)
from app.services.long_term_alert_trigger import (
    HistoryTriggerDecision,
    TrendAnalysisPeriod,
    TrendTriggerDecision,
    evaluate_history_trigger,
    evaluate_trend_trigger,
)


@dataclass(frozen=True)
class LongTermAlertScanPlan:
    scan_time: datetime
    weekly_window: AnalysisWindow
    monthly_window: AnalysisWindow


@dataclass(frozen=True)
class WindowTriggerPlan:
    trend: TrendTriggerDecision
    history: HistoryTriggerDecision


@dataclass(frozen=True)
class UserLongTermAlertScanPlan:
    user_id: str
    scan_time: datetime
    weekly_window: AnalysisWindow
    monthly_window: AnalysisWindow
    weekly: WindowTriggerPlan
    monthly: WindowTriggerPlan


def build_daily_scan_plan(scan_time: datetime | None = None) -> LongTermAlertScanPlan:
    derived_windows: DailyScanWindows = derive_daily_scan_windows(scan_time)
    return LongTermAlertScanPlan(
        scan_time=derived_windows.scan_time,
        weekly_window=derived_windows.weekly,
        monthly_window=derived_windows.monthly,
    )


def build_user_daily_scan_plan(
    db: Session,
    user_id: str,
    scan_time: datetime | None = None,
) -> UserLongTermAlertScanPlan:
    base_plan = build_daily_scan_plan(scan_time)

    weekly_trend = evaluate_trend_trigger(
        db=db,
        user_id=user_id,
        window=base_plan.weekly_window,
        period=TrendAnalysisPeriod.WEEKLY,
    )
    weekly_history = evaluate_history_trigger(
        db=db,
        user_id=user_id,
        window=base_plan.weekly_window,
    )

    monthly_trend = evaluate_trend_trigger(
        db=db,
        user_id=user_id,
        window=base_plan.monthly_window,
        period=TrendAnalysisPeriod.MONTHLY,
    )
    monthly_history = evaluate_history_trigger(
        db=db,
        user_id=user_id,
        window=base_plan.monthly_window,
    )

    return UserLongTermAlertScanPlan(
        user_id=user_id,
        scan_time=base_plan.scan_time,
        weekly_window=base_plan.weekly_window,
        monthly_window=base_plan.monthly_window,
        weekly=WindowTriggerPlan(
            trend=weekly_trend,
            history=weekly_history,
        ),
        monthly=WindowTriggerPlan(
            trend=monthly_trend,
            history=monthly_history,
        ),
    )
