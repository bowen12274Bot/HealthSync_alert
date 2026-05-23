from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from math import sqrt
from typing import Literal, Sequence

from app.models.alert_history import AlertHistory
from app.models.periodic_health_record import PeriodicHealthRecord


MetricName = Literal["hr", "hrv", "spo2"]

HIGH_RISK_SEVERITY_LEVELS = {"注意", "警戒"}
SPECIAL_SEVERE_SEVERITY_LEVEL = "警戒"


@dataclass(frozen=True)
class MetricComponentScores:
    absolute_abnormality: float
    personal_deviation: float
    persistence: float
    slow_deterioration: float


@dataclass(frozen=True)
class MetricRiskBreakdown:
    metric: MetricName
    risk_score: int
    components: MetricComponentScores


@dataclass(frozen=True)
class TrendRiskResult:
    risk_score: int
    indicator_breakdowns: list[MetricRiskBreakdown]
    trigger_reasons: list[str]


@dataclass(frozen=True)
class HistoryRiskComponents:
    frequency: float
    severity: float
    duration: float
    concentration: float


@dataclass(frozen=True)
class HistoryRiskResult:
    risk_score: int
    components: HistoryRiskComponents
    trigger_reasons: list[str]


def calculate_weekly_trend_risk(
    current_records: Sequence[PeriodicHealthRecord],
    historical_records: Sequence[PeriodicHealthRecord],
) -> TrendRiskResult:
    return _calculate_trend_risk(
        current_records=current_records,
        historical_records=historical_records,
        previous_window_records=None,
        period="weekly",
    )


def calculate_monthly_trend_risk(
    current_records: Sequence[PeriodicHealthRecord],
    historical_records: Sequence[PeriodicHealthRecord],
    previous_window_records: Sequence[PeriodicHealthRecord],
) -> TrendRiskResult:
    return _calculate_trend_risk(
        current_records=current_records,
        historical_records=historical_records,
        previous_window_records=previous_window_records,
        period="monthly",
    )


def calculate_weekly_history_risk(
    alerts: Sequence[AlertHistory],
) -> HistoryRiskResult:
    return _calculate_history_risk(alerts, period="weekly")


def calculate_monthly_history_risk(
    alerts: Sequence[AlertHistory],
) -> HistoryRiskResult:
    return _calculate_history_risk(alerts, period="monthly")


def derive_risk_level(risk_score: int) -> str:
    if risk_score >= 80:
        return "警戒"
    if risk_score >= 60:
        return "注意"
    if risk_score >= 40:
        return "觀察"
    return "無"


def _calculate_trend_risk(
    current_records: Sequence[PeriodicHealthRecord],
    historical_records: Sequence[PeriodicHealthRecord],
    previous_window_records: Sequence[PeriodicHealthRecord] | None,
    period: Literal["weekly", "monthly"],
) -> TrendRiskResult:
    metric_breakdowns = [
        _calculate_metric_risk(
            metric="hr",
            current_records=current_records,
            historical_records=historical_records,
            previous_window_records=previous_window_records,
            period=period,
        ),
        _calculate_metric_risk(
            metric="hrv",
            current_records=current_records,
            historical_records=historical_records,
            previous_window_records=previous_window_records,
            period=period,
        ),
        _calculate_metric_risk(
            metric="spo2",
            current_records=current_records,
            historical_records=historical_records,
            previous_window_records=previous_window_records,
            period=period,
        ),
    ]

    if not metric_breakdowns:
        return TrendRiskResult(risk_score=0, indicator_breakdowns=[], trigger_reasons=[])

    indicator_scores = [breakdown.risk_score for breakdown in metric_breakdowns]
    overall_risk = round((0.7 * max(indicator_scores)) + (0.3 * _mean(indicator_scores)))
    trigger_reasons = [
        f"{breakdown.metric.upper()}={breakdown.risk_score}"
        for breakdown in metric_breakdowns
        if breakdown.risk_score >= 40
    ]

    return TrendRiskResult(
        risk_score=_clamp_score(overall_risk),
        indicator_breakdowns=metric_breakdowns,
        trigger_reasons=trigger_reasons,
    )


def _calculate_metric_risk(
    metric: MetricName,
    current_records: Sequence[PeriodicHealthRecord],
    historical_records: Sequence[PeriodicHealthRecord],
    previous_window_records: Sequence[PeriodicHealthRecord] | None,
    period: Literal["weekly", "monthly"],
) -> MetricRiskBreakdown:
    a_score = _metric_absolute_abnormality(metric, current_records)
    p_score = _metric_personal_deviation(metric, current_records, historical_records, period)
    c_score = _metric_persistence(metric, current_records)
    d_score = (
        _metric_slow_deterioration(metric, current_records, previous_window_records or [])
        if period == "monthly"
        else 0.0
    )

    if period == "weekly":
        risk_score = round(100 * ((0.45 * a_score) + (0.35 * p_score) + (0.20 * c_score)))
    else:
        risk_score = round(
            100 * ((0.35 * a_score) + (0.30 * p_score) + (0.20 * c_score) + (0.15 * d_score))
        )

    return MetricRiskBreakdown(
        metric=metric,
        risk_score=_clamp_score(risk_score),
        components=MetricComponentScores(
            absolute_abnormality=a_score,
            personal_deviation=p_score,
            persistence=c_score,
            slow_deterioration=d_score,
        ),
    )


def _metric_absolute_abnormality(
    metric: MetricName,
    records: Sequence[PeriodicHealthRecord],
) -> float:
    if not records:
        return 0.0

    if metric == "hr":
        avg_value = _mean(_hr_values(records))
        high_peak_count = sum(1 for record in records if record.max_hr >= 120)
        score = 0.0
        if avg_value >= 100:
            score = 1.0
        elif avg_value > 95:
            score = 0.5
        if high_peak_count >= 3:
            score = max(score, 0.8)
        return score

    if metric == "hrv":
        avg_value = _mean(_hrv_values(records))
        if avg_value < 20:
            return 1.0
        if avg_value < 25:
            return 0.5
        return 0.0

    avg_value = _mean(_spo2_values(records))
    low_value_count = sum(1 for record in records if _to_float(record.min_spo2) <= 92)
    score = 0.0
    if avg_value < 95:
        score = 1.0
    elif avg_value < 96:
        score = 0.5
    if low_value_count >= 3:
        score = max(score, 0.8)
    return score


def _metric_personal_deviation(
    metric: MetricName,
    current_records: Sequence[PeriodicHealthRecord],
    historical_records: Sequence[PeriodicHealthRecord],
    period: Literal["weekly", "monthly"],
) -> float:
    required_history_count = 30 if period == "weekly" else 90
    if len(historical_records) < required_history_count or not current_records:
        return 0.0

    current_values = _metric_values(metric, current_records)
    history_values = _metric_values(metric, historical_records)
    if not current_values or not history_values:
        return 0.0

    current_avg = _mean(current_values)
    history_avg = _mean(history_values)
    sigma = _population_stddev(history_values)

    if sigma == 0:
        if current_avg == history_avg:
            return 0.0
        return 1.0

    z_score = (current_avg - history_avg) / sigma

    if metric == "hr":
        signed_deviation = z_score
    else:
        signed_deviation = -z_score

    if signed_deviation >= 2.0:
        return 1.0
    if signed_deviation >= 1.5:
        return 0.5
    return 0.0


def _metric_persistence(
    metric: MetricName,
    records: Sequence[PeriodicHealthRecord],
) -> float:
    if not records:
        return 0.0

    abnormal_count = sum(1 for record in records if _is_abnormal_period(metric, record))
    ratio = abnormal_count / len(records)

    if ratio >= 0.4:
        return 1.0
    if ratio >= 0.2:
        return 0.5
    return 0.0


def _metric_slow_deterioration(
    metric: MetricName,
    current_records: Sequence[PeriodicHealthRecord],
    previous_window_records: Sequence[PeriodicHealthRecord],
) -> float:
    if not current_records or not previous_window_records:
        return 0.0

    current_values = _metric_values(metric, current_records)
    previous_values = _metric_values(metric, previous_window_records)
    if not current_values or not previous_values:
        return 0.0

    current_avg = _mean(current_values)
    previous_avg = _mean(previous_values)
    slope = _simple_slope(current_values)

    if metric == "hr":
        is_worsening = current_avg > previous_avg and slope > 0
    else:
        is_worsening = current_avg < previous_avg and slope < 0

    if not is_worsening:
        return 0.0

    change_ratio = _relative_change(current_avg, previous_avg)
    if change_ratio >= 0.05:
        return 1.0
    return 0.5


def _is_abnormal_period(metric: MetricName, record: PeriodicHealthRecord) -> bool:
    if metric == "hr":
        return record.avg_hr > 95 or record.max_hr >= 115
    if metric == "hrv":
        return record.avg_hrv < 25
    return _to_float(record.avg_spo2) < 95 or _to_float(record.min_spo2) <= 93


def _calculate_history_risk(
    alerts: Sequence[AlertHistory],
    period: Literal["weekly", "monthly"],
) -> HistoryRiskResult:
    frequency = _history_frequency(alerts, period)
    severity = _history_severity(alerts)
    duration = _history_duration(alerts)
    concentration = _history_concentration(alerts)

    if period == "weekly":
        risk_score = round(
            100 * ((0.35 * frequency) + (0.30 * severity) + (0.20 * duration) + (0.15 * concentration))
        )
    else:
        risk_score = round(
            100 * ((0.30 * frequency) + (0.30 * severity) + (0.25 * duration) + (0.15 * concentration))
        )

    trigger_reasons: list[str] = []
    if frequency > 0:
        trigger_reasons.append(f"frequency={frequency}")
    if severity > 0:
        trigger_reasons.append(f"severity={severity}")
    if duration > 0:
        trigger_reasons.append(f"duration={duration}")
    if concentration > 0:
        trigger_reasons.append(f"concentration={concentration}")

    return HistoryRiskResult(
        risk_score=_clamp_score(risk_score),
        components=HistoryRiskComponents(
            frequency=frequency,
            severity=severity,
            duration=duration,
            concentration=concentration,
        ),
        trigger_reasons=trigger_reasons,
    )


def _history_frequency(
    alerts: Sequence[AlertHistory],
    period: Literal["weekly", "monthly"],
) -> float:
    total_count = len(alerts)
    if total_count == 0:
        return 0.0

    type_counts: dict[str, int] = {}
    for alert in alerts:
        type_counts[alert.alert_type] = type_counts.get(alert.alert_type, 0) + 1
    effective_count = max(total_count, max(type_counts.values(), default=0))

    if period == "weekly":
        if effective_count >= 4:
            return 1.0
        if effective_count == 3:
            return 0.75
        if effective_count == 2:
            return 0.5
        if effective_count == 1:
            return 0.25
        return 0.0

    if effective_count >= 8:
        return 1.0
    if effective_count >= 6:
        return 0.75
    if effective_count >= 4:
        return 0.5
    if effective_count >= 2:
        return 0.25
    return 0.0


def _history_severity(alerts: Sequence[AlertHistory]) -> float:
    if not alerts:
        return 0.0

    high_risk_count = sum(
        1
        for alert in alerts
        if alert.max_risk_score >= 60 or alert.max_severity_level in HIGH_RISK_SEVERITY_LEVELS
    )
    ratio = high_risk_count / len(alerts)

    score = 0.0
    if ratio >= 0.6:
        score = 1.0
    elif ratio >= 0.4:
        score = 0.75
    elif ratio >= 0.2:
        score = 0.5
    elif ratio > 0:
        score = 0.25

    has_special_severe_event = any(
        alert.max_risk_score >= 80 or alert.max_severity_level == SPECIAL_SEVERE_SEVERITY_LEVEL
        for alert in alerts
    )
    if has_special_severe_event:
        score = max(score, 0.75)

    return score


def _history_duration(alerts: Sequence[AlertHistory]) -> float:
    durations_in_minutes = [
        alert.duration / 60
        for alert in alerts
        if alert.duration is not None
    ]
    if not durations_in_minutes:
        return 0.0

    average_duration = _mean(durations_in_minutes)
    longest_duration = max(durations_in_minutes)

    if average_duration >= 45 or longest_duration >= 60:
        return 1.0
    if average_duration >= 30 or longest_duration >= 45:
        return 0.75
    if average_duration >= 20 or longest_duration >= 30:
        return 0.5
    if average_duration >= 10 or longest_duration >= 20:
        return 0.25
    return 0.0


def _history_concentration(alerts: Sequence[AlertHistory]) -> float:
    if not alerts:
        return 0.0

    per_day_counts: dict[date, int] = {}
    for alert in alerts:
        occurred_date = alert.first_occurred_at.date()
        per_day_counts[occurred_date] = per_day_counts.get(occurred_date, 0) + 1

    total_count = len(alerts)
    max_day_ratio = max(per_day_counts.values()) / total_count
    max_two_day_count = _max_two_day_count(per_day_counts)

    if max_two_day_count >= 3 or max_day_ratio >= 0.6:
        return 1.0
    if max_two_day_count >= 2 or max_day_ratio >= 0.4:
        return 0.5
    return 0.0


def _max_two_day_count(per_day_counts: dict[date, int]) -> int:
    if not per_day_counts:
        return 0

    sorted_days = sorted(per_day_counts.keys())
    max_count = 0
    for index, current_day in enumerate(sorted_days):
        two_day_count = per_day_counts[current_day]
        if index + 1 < len(sorted_days):
            next_day = sorted_days[index + 1]
            if (next_day - current_day).days == 1:
                two_day_count += per_day_counts[next_day]
        max_count = max(max_count, two_day_count)
    return max_count


def _metric_values(
    metric: MetricName,
    records: Sequence[PeriodicHealthRecord],
) -> list[float]:
    if metric == "hr":
        return _hr_values(records)
    if metric == "hrv":
        return _hrv_values(records)
    return _spo2_values(records)


def _hr_values(records: Sequence[PeriodicHealthRecord]) -> list[float]:
    return [float(record.avg_hr) for record in records]


def _hrv_values(records: Sequence[PeriodicHealthRecord]) -> list[float]:
    return [float(record.avg_hrv) for record in records]


def _spo2_values(records: Sequence[PeriodicHealthRecord]) -> list[float]:
    return [_to_float(record.avg_spo2) for record in records]


def _to_float(value: float | Decimal) -> float:
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _mean(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _population_stddev(values: Sequence[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean_value = _mean(values)
    variance = sum((value - mean_value) ** 2 for value in values) / len(values)
    return sqrt(variance)


def _simple_slope(values: Sequence[float]) -> float:
    if len(values) < 2:
        return 0.0
    return (values[-1] - values[0]) / (len(values) - 1)


def _relative_change(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0 if current == 0 else 1.0
    return abs((current - previous) / previous)


def _clamp_score(score: int) -> int:
    return max(0, min(100, score))
