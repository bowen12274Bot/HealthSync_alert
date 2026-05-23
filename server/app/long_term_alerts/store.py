from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.long_term_alert import LongTermAlert
from app.long_term_alerts.analysis import HistoryRiskResult, TrendRiskResult
from app.long_term_alerts.windows import AnalysisWindow


WRITE_THRESHOLD = 60


@dataclass(frozen=True)
class LongTermAlertWriteResult:
    action: str
    alert_id: int | None
    risk_score: int


def persist_trend_alert(
    db: Session,
    *,
    user_id: str,
    user_account_id: int,
    window: AnalysisWindow,
    result: TrendRiskResult,
    alert_type: str = "trend",
) -> LongTermAlertWriteResult:
    return persist_long_term_alert(
        db=db,
        user_id=user_id,
        user_account_id=user_account_id,
        alert_type=alert_type,
        window=window,
        risk_score=result.risk_score,
        trigger_reasons=result.trigger_reasons,
    )


def persist_history_alert(
    db: Session,
    *,
    user_id: str,
    user_account_id: int,
    window: AnalysisWindow,
    result: HistoryRiskResult,
    alert_type: str = "history_pattern",
) -> LongTermAlertWriteResult:
    return persist_long_term_alert(
        db=db,
        user_id=user_id,
        user_account_id=user_account_id,
        alert_type=alert_type,
        window=window,
        risk_score=result.risk_score,
        trigger_reasons=result.trigger_reasons,
    )


def persist_long_term_alert(
    db: Session,
    *,
    user_id: str,
    user_account_id: int,
    alert_type: str,
    window: AnalysisWindow,
    risk_score: int,
    trigger_reasons: list[str],
) -> LongTermAlertWriteResult:
    existing_alert = db.execute(
        select(LongTermAlert).where(
            LongTermAlert.user_account_id == user_account_id,
            LongTermAlert.alert_type == alert_type,
            LongTermAlert.window_start == window.window_start,
            LongTermAlert.window_end == window.window_end,
        )
    ).scalar_one_or_none()

    trigger_reason = _format_trigger_reason(trigger_reasons)

    if risk_score < WRITE_THRESHOLD:
        if existing_alert is None:
            return LongTermAlertWriteResult(
                action="noop",
                alert_id=None,
                risk_score=risk_score,
            )

        alert_id = existing_alert.id
        db.delete(existing_alert)
        db.flush()
        return LongTermAlertWriteResult(
            action="deleted",
            alert_id=alert_id,
            risk_score=risk_score,
        )

    if existing_alert is None:
        new_alert = LongTermAlert(
            user_id=user_id,
            user_account_id=user_account_id,
            alert_type=alert_type,
            risk_score=risk_score,
            trigger_reason=trigger_reason,
            window_start=window.window_start,
            window_end=window.window_end,
            status="active",
        )
        db.add(new_alert)
        db.flush()
        return LongTermAlertWriteResult(
            action="created",
            alert_id=new_alert.id,
            risk_score=risk_score,
        )

    existing_alert.risk_score = risk_score
    existing_alert.trigger_reason = trigger_reason
    existing_alert.status = "active"
    db.flush()
    return LongTermAlertWriteResult(
        action="updated",
        alert_id=existing_alert.id,
        risk_score=risk_score,
    )


def _format_trigger_reason(trigger_reasons: list[str]) -> str:
    if not trigger_reasons:
        return "No trigger reasons"
    return ", ".join(trigger_reasons)
