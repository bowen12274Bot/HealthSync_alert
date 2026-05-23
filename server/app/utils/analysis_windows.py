from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


TAIPEI_TIMEZONE = ZoneInfo("Asia/Taipei")


@dataclass(frozen=True)
class AnalysisWindow:
    window_start: datetime
    window_end: datetime


@dataclass(frozen=True)
class DailyScanWindows:
    scan_time: datetime
    weekly: AnalysisWindow
    monthly: AnalysisWindow


def normalize_scan_time(scan_time: datetime | None = None) -> datetime:
    if scan_time is None:
        return datetime.now(TAIPEI_TIMEZONE)

    if scan_time.tzinfo is None:
        return scan_time.replace(tzinfo=TAIPEI_TIMEZONE)

    return scan_time.astimezone(TAIPEI_TIMEZONE)


def derive_weekly_window(scan_time: datetime | None = None) -> AnalysisWindow:
    localized_scan_time = normalize_scan_time(scan_time)
    current_week_start = localized_scan_time.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ) - timedelta(days=localized_scan_time.weekday())

    return AnalysisWindow(
        window_start=current_week_start - timedelta(days=7),
        window_end=current_week_start,
    )


def derive_monthly_window(scan_time: datetime | None = None) -> AnalysisWindow:
    localized_scan_time = normalize_scan_time(scan_time)
    current_month_start = localized_scan_time.replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    previous_month_end = current_month_start - timedelta(days=1)
    previous_month_start = previous_month_end.replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    return AnalysisWindow(
        window_start=previous_month_start,
        window_end=current_month_start,
    )


def derive_daily_scan_windows(scan_time: datetime | None = None) -> DailyScanWindows:
    localized_scan_time = normalize_scan_time(scan_time)
    return DailyScanWindows(
        scan_time=localized_scan_time,
        weekly=derive_weekly_window(localized_scan_time),
        monthly=derive_monthly_window(localized_scan_time),
    )
