from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from app.core.database import SessionLocal
from app.long_term_alerts.execution import (
    execute_all_users_long_term_alert_analysis,
)
from app.long_term_alerts.windows import TAIPEI_TIMEZONE, normalize_scan_time


logger = logging.getLogger(__name__)


def get_next_daily_scan_time(now: datetime | None = None) -> datetime:
    localized_now = normalize_scan_time(now)
    next_scan = localized_now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ) + timedelta(days=1)
    return next_scan


async def run_daily_long_term_alert_scheduler() -> None:
    while True:
        now = datetime.now(TAIPEI_TIMEZONE)
        next_scan = get_next_daily_scan_time(now)
        sleep_seconds = max((next_scan - now).total_seconds(), 0.0)
        await asyncio.sleep(sleep_seconds)
        await run_long_term_alert_scan_once(next_scan)


async def run_long_term_alert_scan_once(scan_time: datetime | None = None) -> None:
    db = SessionLocal()
    try:
        execute_all_users_long_term_alert_analysis(db, scan_time=scan_time)
    except Exception:
        db.rollback()
        logger.exception("Failed to execute daily long-term alert scan.")
    finally:
        db.close()
