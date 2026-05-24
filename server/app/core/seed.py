from __future__ import annotations

import json
import random
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_password_salt, hash_password
from app.models.alert_history import AlertHistory
from app.models.auth.user_account import UserAccount
from app.models.long_term_alert import LongTermAlert
from app.models.periodic_health_record import PeriodicHealthRecord
from app.models.profile.activity_baseline_profile import ActivityBaselineProfile
from app.models.profile.user_profile import UserProfile


DEFAULT_ACTIVITY_BASELINES = (
    {"activity_level": 0, "target_hr": 72, "target_hrv": 55, "target_spo2": 97},
    {"activity_level": 1, "target_hr": 90, "target_hrv": 45, "target_spo2": 97},
    {"activity_level": 2, "target_hr": 115, "target_hrv": 35, "target_spo2": 96},
    {"activity_level": 3, "target_hr": 145, "target_hrv": 25, "target_spo2": 96},
)

DEMO_DEVICE_ID = "demo_device_healthsync"
DEMO_RANDOM_SEED = 20260524
DEMO_ALERT_BASE_HOUR = 21


@dataclass(frozen=True)
class DemoAlertStatusStep:
    status: str
    offset_minutes: int
    risk_score: int
    description: str


@dataclass(frozen=True)
class DemoAlertEvent:
    alert_id: str
    alert_type: str
    trigger_reason: str
    days_ago: int
    start_hour: int
    duration_minutes: int
    steps: tuple[DemoAlertStatusStep, ...]


@dataclass(frozen=True)
class DemoLongTermAlertEvent:
    alert_type: str
    days_ago: int
    duration_days: int
    risk_score: int
    trigger_reason: str


DEMO_ALERT_EVENTS = (
    DemoAlertEvent(
        alert_id="demo-alert-001",
        alert_type="physiological_stress",
        trigger_reason="低活動期間心率偏高且 HRV 持續下降",
        days_ago=21,
        start_hour=20,
        duration_minutes=110,
        steps=(
            DemoAlertStatusStep("觀察中", 0, 3, "低活動期間心率偏高"),
            DemoAlertStatusStep("注意", 30, 5, "心率持續上升且 HRV 降低"),
            DemoAlertStatusStep("已解除", 110, 2, "指標已逐步回復穩定"),
        ),
    ),
    DemoAlertEvent(
        alert_id="demo-alert-002",
        alert_type="physiological_stress",
        trigger_reason="工作日傍晚出現持續性生理壓力升高",
        days_ago=17,
        start_hour=19,
        duration_minutes=140,
        steps=(
            DemoAlertStatusStep("觀察中", 0, 3, "傍晚靜止狀態下心率偏高"),
            DemoAlertStatusStep("注意", 35, 5, "HRV 降低且壓力反應延續"),
            DemoAlertStatusStep("恢復中", 95, 4, "壓力指標開始回穩"),
            DemoAlertStatusStep("已解除", 140, 2, "指標已回到正常範圍"),
        ),
    ),
    DemoAlertEvent(
        alert_id="demo-alert-003",
        alert_type="spo2_risk",
        trigger_reason="夜間血氧曾連續落在較低區間",
        days_ago=12,
        start_hour=1,
        duration_minutes=125,
        steps=(
            DemoAlertStatusStep("觀察中", 0, 4, "SpO2 開始低於安全基線"),
            DemoAlertStatusStep("注意", 30, 6, "血氧持續下降並伴隨 HRV 降低"),
            DemoAlertStatusStep("已解除", 125, 3, "夜間血氧已回升至可接受範圍"),
        ),
    ),
    DemoAlertEvent(
        alert_id="demo-alert-004",
        alert_type="spo2_risk",
        trigger_reason="凌晨時段血氧下降並伴隨心率偏高",
        days_ago=9,
        start_hour=2,
        duration_minutes=150,
        steps=(
            DemoAlertStatusStep("觀察中", 0, 4, "夜間血氧波動明顯"),
            DemoAlertStatusStep("注意", 40, 6, "血氧持續低於安全範圍"),
            DemoAlertStatusStep("恢復中", 105, 4, "血氧逐漸回升"),
            DemoAlertStatusStep("已解除", 150, 3, "異常已結束"),
        ),
    ),
    DemoAlertEvent(
        alert_id="demo-alert-005",
        alert_type="combined_physiological_risk",
        trigger_reason="夜間多項生理指標同時異常，曾達高度警戒",
        days_ago=6,
        start_hour=0,
        duration_minutes=205,
        steps=(
            DemoAlertStatusStep("觀察中", 0, 5, "夜間心率偏高且 HRV 開始下降"),
            DemoAlertStatusStep("注意", 35, 7, "SpO2 明顯下降並伴隨心率惡化"),
            DemoAlertStatusStep("警戒", 85, 8, "多項生理指標同時惡化"),
            DemoAlertStatusStep("恢復中", 150, 5, "主要風險開始緩解"),
            DemoAlertStatusStep("已解除", 205, 2, "指標逐步恢復正常"),
        ),
    ),
    DemoAlertEvent(
        alert_id="demo-alert-006",
        alert_type="physiological_stress",
        trigger_reason="近期壓力波動曾短暫偏高，但已於兩日前解除",
        days_ago=2,
        start_hour=18,
        duration_minutes=95,
        steps=(
            DemoAlertStatusStep("觀察中", 0, 3, "晚間低活動期間心率上升"),
            DemoAlertStatusStep("注意", 30, 4, "HRV 短暫下降"),
            DemoAlertStatusStep("已解除", 95, 2, "近兩日未再出現異常"),
        ),
    ),
)

DEMO_LONG_TERM_ALERT_EVENTS = (
    DemoLongTermAlertEvent(
        alert_type="trend",
        days_ago=18,
        duration_days=7,
        risk_score=76,
        trigger_reason="近一週平均 HR 偏高且 HRV 較個人基線下降",
    ),
    DemoLongTermAlertEvent(
        alert_type="history_pattern",
        days_ago=8,
        duration_days=6,
        risk_score=88,
        trigger_reason="夜間血氧反覆下降，形成顯著歷史模式風險",
    ),
)


def seed_user_account(db: Session) -> UserAccount | None:
    if not settings.seed_user_email or not settings.seed_user_password:
        return None

    normalized_email = settings.seed_user_email.strip().lower()
    existing_user = db.query(UserAccount).filter(UserAccount.email == normalized_email).first()

    if existing_user:
        return existing_user

    password_salt = create_password_salt()
    user = UserAccount(
        email=normalized_email,
        password_hash=hash_password(settings.seed_user_password, password_salt),
        password_salt=password_salt,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def seed_user_profile(db: Session, user_account: UserAccount) -> UserProfile:
    existing_profile = (
        db.query(UserProfile)
        .filter(UserProfile.user_account_id == user_account.id)
        .first()
    )

    if existing_profile:
        return existing_profile

    profile = UserProfile(
        user_account_id=user_account.id,
        name="Demo User",
        age=30,
        gender="未提供",
        basic_health_info="baseline demo profile",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def seed_activity_baseline_profile(db: Session, user_profile: UserProfile) -> None:
    existing_count = (
        db.query(ActivityBaselineProfile)
        .filter(ActivityBaselineProfile.user_profile_id == user_profile.id)
        .count()
    )

    if existing_count >= len(DEFAULT_ACTIVITY_BASELINES):
        return

    for baseline in DEFAULT_ACTIVITY_BASELINES:
        existing_record = (
            db.query(ActivityBaselineProfile)
            .filter(
                ActivityBaselineProfile.user_profile_id == user_profile.id,
                ActivityBaselineProfile.activity_level == baseline["activity_level"],
            )
            .first()
        )
        if existing_record:
            continue

        db.add(
            ActivityBaselineProfile(
                user_profile_id=user_profile.id,
                activity_level=baseline["activity_level"],
                target_hr=baseline["target_hr"],
                target_hrv=baseline["target_hrv"],
                target_spo2=baseline["target_spo2"],
            )
        )

    db.commit()


def seed_demo_data(db: Session) -> None:
    user_account = seed_user_account(db)
    if user_account is None:
        return

    user_profile = seed_user_profile(db, user_account)
    seed_activity_baseline_profile(db, user_profile)


def seed_demo_scenario(db: Session) -> None:
    user_account = seed_user_account(db)
    if user_account is None:
        return

    user_profile = seed_user_profile(db, user_account)
    seed_activity_baseline_profile(db, user_profile)
    reseed_demo_domain_data(db, user_account)


def reseed_demo_domain_data(db: Session, user_account: UserAccount) -> None:
    user_id = f"user_{user_account.id}"
    rng = random.Random(DEMO_RANDOM_SEED)
    today = datetime.now(UTC).date()

    db.query(LongTermAlert).filter(LongTermAlert.user_account_id == user_account.id).delete()
    db.query(AlertHistory).filter(AlertHistory.user_account_id == user_account.id).delete()
    db.query(PeriodicHealthRecord).filter(PeriodicHealthRecord.user_id == user_id).delete()
    db.commit()

    periodic_records = build_demo_periodic_health_records(user_id, today, rng)
    alert_histories = build_demo_alert_histories(user_account.id, user_id, today)
    long_term_alerts = build_demo_long_term_alerts(user_account.id, user_id, today)

    db.add_all(periodic_records)
    db.add_all(alert_histories)
    db.add_all(long_term_alerts)
    db.commit()


def build_demo_periodic_health_records(
    user_id: str,
    today: date,
    rng: random.Random,
) -> list[PeriodicHealthRecord]:
    records: list[PeriodicHealthRecord] = []
    start_day = today - timedelta(days=59)

    for day_offset in range(60):
        current_day = start_day + timedelta(days=day_offset)
        days_ago = (today - current_day).days

        for hour in range(24):
            window_start = datetime.combine(current_day, time(hour=hour, tzinfo=UTC))
            window_end = window_start + timedelta(minutes=10)
            activity_level = resolve_activity_level(hour)
            day_profile = resolve_day_profile(days_ago)

            avg_hr = apply_hr_profile(72 + activity_level * 11, day_profile, hour, rng)
            min_hr = max(48, avg_hr - rng.randint(4, 9))
            max_hr = min(182, avg_hr + rng.randint(5, 12))

            avg_hrv = apply_hrv_profile(56 - activity_level * 9, day_profile, hour, rng)
            avg_spo2 = apply_spo2_profile(97 - (1 if activity_level >= 2 else 0), day_profile, hour, rng)
            min_spo2 = max(85, round(float(avg_spo2) - rng.uniform(0.4, 1.4), 2))

            sample_count = rng.randint(7, 13)
            steps = resolve_steps(activity_level, day_profile, rng)

            records.append(
                PeriodicHealthRecord(
                    user_id=user_id,
                    device_id=DEMO_DEVICE_ID,
                    window_start=window_start,
                    window_end=window_end,
                    avg_hr=avg_hr,
                    min_hr=min_hr,
                    max_hr=max_hr,
                    avg_hrv=avg_hrv,
                    avg_spo2=Decimal(f"{avg_spo2:.2f}"),
                    min_spo2=Decimal(f"{min_spo2:.2f}"),
                    dominant_activity_level=activity_level,
                    sample_count=sample_count,
                    steps=steps,
                    raw_data_payload=None,
                )
            )

    return records


def resolve_day_profile(days_ago: int) -> str:
    if days_ago <= 1:
        return "stable_recent"
    if days_ago <= 6:
        return "recovery"
    if days_ago <= 13:
        return "risk"
    if days_ago <= 20:
        return "stress"
    if days_ago <= 27:
        return "stable"
    return "baseline"


def resolve_activity_level(hour: int) -> int:
    if 0 <= hour <= 5:
        return 0
    if 6 <= hour <= 8:
        return 1
    if 9 <= hour <= 17:
        return 2
    if 18 <= hour <= 20:
        return 1
    return 0


def apply_hr_profile(base_hr: int, day_profile: str, hour: int, rng: random.Random) -> int:
    adjustment = 0
    if day_profile == "stress":
        adjustment += 10
    elif day_profile == "risk":
        adjustment += 8
    elif day_profile == "recovery":
        adjustment += 3
    elif day_profile == "baseline":
        adjustment -= 2

    if 0 <= hour <= 4:
        adjustment -= 7
    elif 10 <= hour <= 16:
        adjustment += 6

    return max(45, min(165, base_hr + adjustment + rng.randint(-4, 4)))


def apply_hrv_profile(base_hrv: int, day_profile: str, hour: int, rng: random.Random) -> int:
    adjustment = 0
    if day_profile == "stress":
        adjustment -= 11
    elif day_profile == "risk":
        adjustment -= 13
    elif day_profile == "recovery":
        adjustment -= 3
    elif day_profile == "baseline":
        adjustment += 4

    if 0 <= hour <= 4:
        adjustment += 7
    elif 10 <= hour <= 16:
        adjustment -= 4

    return max(12, min(95, base_hrv + adjustment + rng.randint(-4, 4)))


def apply_spo2_profile(base_spo2: int, day_profile: str, hour: int, rng: random.Random) -> float:
    adjustment = 0.0
    if day_profile == "stress":
        adjustment -= 0.6
    elif day_profile == "risk":
        adjustment -= 1.2
    elif day_profile == "recovery":
        adjustment -= 0.2
    elif day_profile == "baseline":
        adjustment += 0.2

    if day_profile == "risk" and 0 <= hour <= 4:
        adjustment -= 3.2
    elif 0 <= hour <= 4:
        adjustment -= 0.5
    elif 11 <= hour <= 16:
        adjustment += 0.2

    value = base_spo2 + adjustment + rng.uniform(-0.35, 0.35)
    return round(max(88.0, min(99.0, value)), 2)


def resolve_steps(activity_level: int, day_profile: str, rng: random.Random) -> int:
    baseline = {
        0: (0, 35),
        1: (80, 260),
        2: (220, 650),
        3: (500, 900),
    }[activity_level]

    lower, upper = baseline
    if day_profile in {"stress", "risk"} and activity_level >= 1:
        upper = max(lower + 20, upper - 70)

    return rng.randint(lower, upper)


def build_demo_alert_histories(
    user_account_id: int,
    user_id: str,
    today: date,
) -> list[AlertHistory]:
    records: list[AlertHistory] = []

    for event in DEMO_ALERT_EVENTS:
        first_occurred_at = datetime.combine(
            today - timedelta(days=event.days_ago),
            time(hour=event.start_hour, minute=0, tzinfo=UTC),
        )
        resolved_at = first_occurred_at + timedelta(minutes=event.duration_minutes)
        status_history = build_status_history_payload(first_occurred_at, event.steps)
        max_risk_score = max(step.risk_score for step in event.steps)
        records.append(
            AlertHistory(
                user_id=user_id,
                user_account_id=user_account_id,
                alert_source="mobile",
                alert_id=event.alert_id,
                alert_type=event.alert_type,
                max_risk_score=max_risk_score,
                max_severity_level=map_max_severity_level(max_risk_score),
                trigger_reason=event.trigger_reason,
                first_occurred_at=first_occurred_at,
                last_abnormal_at=resolved_at - timedelta(minutes=20),
                resolved_at=resolved_at,
                duration=event.duration_minutes * 60,
                status_change_count=len(event.steps),
                is_worsened=max_risk_score >= 6,
                status_history_payload=json.dumps(status_history, ensure_ascii=False),
                status="resolved",
            )
        )

    return records


def build_status_history_payload(
    first_occurred_at: datetime,
    steps: tuple[DemoAlertStatusStep, ...],
) -> list[dict[str, object]]:
    payload: list[dict[str, object]] = []
    for step in steps:
        status_time = first_occurred_at + timedelta(minutes=step.offset_minutes)
        payload.append(
            {
                "status": step.status,
                "risk_score": step.risk_score,
                "status_time": status_time.isoformat(),
                "status_description": step.description,
            }
        )
    return payload


def build_demo_long_term_alerts(
    user_account_id: int,
    user_id: str,
    today: date,
) -> list[LongTermAlert]:
    records: list[LongTermAlert] = []

    for event in DEMO_LONG_TERM_ALERT_EVENTS:
        window_end_day = today - timedelta(days=event.days_ago)
        window_start = datetime.combine(
            window_end_day - timedelta(days=event.duration_days - 1),
            time.min,
            tzinfo=UTC,
        )
        window_end = datetime.combine(window_end_day, time.max, tzinfo=UTC)
        records.append(
            LongTermAlert(
                user_id=user_id,
                user_account_id=user_account_id,
                alert_type=event.alert_type,
                risk_score=event.risk_score,
                trigger_reason=event.trigger_reason,
                window_start=window_start,
                window_end=window_end,
                status="resolved",
            )
        )

    return records


def map_max_severity_level(risk_score: int) -> str:
    if risk_score >= 7:
        return "高度"
    if risk_score >= 5:
        return "中度"
    return "低度"
