from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_password_salt, hash_password
from app.models.auth.user_account import UserAccount
from app.models.profile.activity_baseline_profile import ActivityBaselineProfile
from app.models.profile.user_profile import UserProfile


DEFAULT_ACTIVITY_BASELINES = (
    {"activity_level": 0, "target_hr": 72, "target_hrv": 55, "target_spo2": 97},
    {"activity_level": 1, "target_hr": 90, "target_hrv": 45, "target_spo2": 97},
    {"activity_level": 2, "target_hr": 115, "target_hrv": 35, "target_spo2": 96},
    {"activity_level": 3, "target_hr": 145, "target_hrv": 25, "target_spo2": 96},
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
