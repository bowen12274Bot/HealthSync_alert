from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.auth.user_account import UserAccount
from app.models.alert_history import AlertHistory
from app.models.long_term_analysis_link import LongTermAnalysisLink
from app.models.periodic_health_record import PeriodicHealthRecord
from app.models.periodic_health_record_analysis_status import (
    PeriodicHealthRecordAnalysisStatus,
)
from app.long_term_alerts.analysis import (
    calculate_monthly_history_risk,
    calculate_monthly_trend_risk,
    calculate_weekly_history_risk,
    calculate_weekly_trend_risk,
)
from app.long_term_alerts.scanner import build_user_daily_scan_plan
from app.long_term_alerts.store import (
    LongTermAlertWriteResult,
    persist_history_alert,
    persist_trend_alert,
)
from app.long_term_alerts.trigger import TrendAnalysisPeriod
from app.long_term_alerts.windows import AnalysisWindow


@dataclass(frozen=True)
class LongTermAlertExecutionResult:
    weekly_trend: LongTermAlertWriteResult | None
    monthly_trend: LongTermAlertWriteResult | None
    weekly_history: LongTermAlertWriteResult | None
    monthly_history: LongTermAlertWriteResult | None


@dataclass(frozen=True)
class UserLongTermAlertExecutionResult:
    user_account_id: int
    user_id: str
    result: LongTermAlertExecutionResult


def execute_user_long_term_alert_analysis(
    db: Session,
    *,
    user_id: str,
    user_account_id: int,
    scan_time: datetime | None = None,
) -> LongTermAlertExecutionResult:
    scan_plan = build_user_daily_scan_plan(db=db, user_id=user_id, scan_time=scan_time)

    weekly_trend_result: LongTermAlertWriteResult | None = None
    monthly_trend_result: LongTermAlertWriteResult | None = None
    weekly_history_result: LongTermAlertWriteResult | None = None
    monthly_history_result: LongTermAlertWriteResult | None = None

    if scan_plan.weekly.trend.should_run:
        weekly_current_records = _load_periodic_records(db, user_id, scan_plan.weekly_window)
        weekly_historical_records = _load_historical_periodic_records(
            db,
            user_id,
            scan_plan.weekly_window,
            days=30,
        )
        weekly_trend_risk = calculate_weekly_trend_risk(
            current_records=weekly_current_records,
            historical_records=weekly_historical_records,
        )
        weekly_trend_result = persist_trend_alert(
            db,
            user_id=user_id,
            user_account_id=user_account_id,
            window=scan_plan.weekly_window,
            result=weekly_trend_risk,
        )
        _mark_periodic_records_as_analyzed(
            db,
            records=weekly_current_records,
            period=TrendAnalysisPeriod.WEEKLY,
        )
        _sync_analysis_links(
            db,
            write_result=weekly_trend_result,
            records=weekly_current_records,
        )

    if scan_plan.monthly.trend.should_run:
        monthly_current_records = _load_periodic_records(db, user_id, scan_plan.monthly_window)
        monthly_historical_records = _load_historical_periodic_records(
            db,
            user_id,
            scan_plan.monthly_window,
            days=90,
        )
        previous_month_window = _derive_previous_month_window(scan_plan.monthly_window)
        previous_month_records = _load_periodic_records(db, user_id, previous_month_window)
        monthly_trend_risk = calculate_monthly_trend_risk(
            current_records=monthly_current_records,
            historical_records=monthly_historical_records,
            previous_window_records=previous_month_records,
        )
        monthly_trend_result = persist_trend_alert(
            db,
            user_id=user_id,
            user_account_id=user_account_id,
            window=scan_plan.monthly_window,
            result=monthly_trend_risk,
        )
        _mark_periodic_records_as_analyzed(
            db,
            records=monthly_current_records,
            period=TrendAnalysisPeriod.MONTHLY,
        )
        _sync_analysis_links(
            db,
            write_result=monthly_trend_result,
            records=monthly_current_records,
        )

    weekly_alerts = _load_alert_histories(db, user_id, scan_plan.weekly_window)
    weekly_history_risk = calculate_weekly_history_risk(weekly_alerts)
    weekly_history_result = persist_history_alert(
        db,
        user_id=user_id,
        user_account_id=user_account_id,
        window=scan_plan.weekly_window,
        result=weekly_history_risk,
    )

    monthly_alerts = _load_alert_histories(db, user_id, scan_plan.monthly_window)
    monthly_history_risk = calculate_monthly_history_risk(monthly_alerts)
    monthly_history_result = persist_history_alert(
        db,
        user_id=user_id,
        user_account_id=user_account_id,
        window=scan_plan.monthly_window,
        result=monthly_history_risk,
    )

    db.commit()

    return LongTermAlertExecutionResult(
        weekly_trend=weekly_trend_result,
        monthly_trend=monthly_trend_result,
        weekly_history=weekly_history_result,
        monthly_history=monthly_history_result,
    )


def execute_all_users_long_term_alert_analysis(
    db: Session,
    *,
    scan_time: datetime | None = None,
) -> list[UserLongTermAlertExecutionResult]:
    user_accounts = list(db.execute(select(UserAccount)).scalars().all())
    results: list[UserLongTermAlertExecutionResult] = []

    for user_account in user_accounts:
        user_id = f"user_{user_account.id}"
        result = execute_user_long_term_alert_analysis(
            db,
            user_id=user_id,
            user_account_id=user_account.id,
            scan_time=scan_time,
        )
        results.append(
            UserLongTermAlertExecutionResult(
                user_account_id=user_account.id,
                user_id=user_id,
                result=result,
            )
        )

    return results


def _load_periodic_records(
    db: Session,
    user_id: str,
    window: AnalysisWindow,
) -> list[PeriodicHealthRecord]:
    return list(
        db.execute(
        select(PeriodicHealthRecord)
        .where(
            PeriodicHealthRecord.user_id == user_id,
            PeriodicHealthRecord.window_start >= window.window_start,
            PeriodicHealthRecord.window_end <= window.window_end,
        )
        .order_by(PeriodicHealthRecord.window_start.asc())
        ).scalars().all()
    )


def _load_historical_periodic_records(
    db: Session,
    user_id: str,
    current_window: AnalysisWindow,
    *,
    days: int,
) -> list[PeriodicHealthRecord]:
    history_window_start = current_window.window_start - timedelta(days=days)
    return list(
        db.execute(
        select(PeriodicHealthRecord)
        .where(
            PeriodicHealthRecord.user_id == user_id,
            PeriodicHealthRecord.window_start >= history_window_start,
            PeriodicHealthRecord.window_end <= current_window.window_start,
        )
        .order_by(PeriodicHealthRecord.window_start.asc())
        ).scalars().all()
    )


def _load_alert_histories(
    db: Session,
    user_id: str,
    window: AnalysisWindow,
) -> list[AlertHistory]:
    return list(
        db.execute(
        select(AlertHistory)
        .where(
            AlertHistory.user_id == user_id,
            AlertHistory.first_occurred_at >= window.window_start,
            AlertHistory.first_occurred_at < window.window_end,
        )
        .order_by(AlertHistory.first_occurred_at.asc())
        ).scalars().all()
    )


def _derive_previous_month_window(current_window: AnalysisWindow) -> AnalysisWindow:
    previous_window_end = current_window.window_start
    previous_month_last_day = previous_window_end - timedelta(days=1)
    previous_window_start = previous_month_last_day.replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    return AnalysisWindow(
        window_start=previous_window_start,
        window_end=previous_window_end,
    )


def _mark_periodic_records_as_analyzed(
    db: Session,
    *,
    records: list[PeriodicHealthRecord],
    period: TrendAnalysisPeriod,
) -> None:
    if not records:
        return

    record_ids = [record.id for record in records]

    seed_stmt = insert(PeriodicHealthRecordAnalysisStatus).values([
        {"periodic_health_record_id": record_id}
        for record_id in record_ids
    ])
    seed_stmt = seed_stmt.on_conflict_do_nothing(
        index_elements=["periodic_health_record_id"]
    )
    db.execute(seed_stmt)

    statuses = db.execute(
        select(PeriodicHealthRecordAnalysisStatus).where(
            PeriodicHealthRecordAnalysisStatus.periodic_health_record_id.in_(record_ids)
        )
    ).scalars().all()

    for status in statuses:
        if period == TrendAnalysisPeriod.WEEKLY:
            status.is_trend_weekly_analyzed = True
        else:
            status.is_trend_monthly_analyzed = True


def _sync_analysis_links(
    db: Session,
    *,
    write_result: LongTermAlertWriteResult,
    records: list[PeriodicHealthRecord],
) -> None:
    if write_result.alert_id is None:
        return

    if write_result.action == "deleted":
        db.execute(
            delete(LongTermAnalysisLink).where(
                LongTermAnalysisLink.long_term_alert_id == write_result.alert_id
            )
        )
        return

    record_ids = [record.id for record in records]
    if not record_ids:
        db.execute(
            delete(LongTermAnalysisLink).where(
                LongTermAnalysisLink.long_term_alert_id == write_result.alert_id
            )
        )
        return

    db.execute(
        delete(LongTermAnalysisLink).where(
            LongTermAnalysisLink.long_term_alert_id == write_result.alert_id,
            LongTermAnalysisLink.periodic_health_record_id.not_in(record_ids),
        )
    )

    link_stmt = insert(LongTermAnalysisLink).values([
        {
            "long_term_alert_id": write_result.alert_id,
            "periodic_health_record_id": record_id,
        }
        for record_id in record_ids
    ])
    link_stmt = link_stmt.on_conflict_do_nothing(
        index_elements=["long_term_alert_id", "periodic_health_record_id"]
    )
    db.execute(link_stmt)
