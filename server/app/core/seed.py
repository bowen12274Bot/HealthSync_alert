from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_password_salt, hash_password
from app.models.user_account import UserAccount
from app.models.user_profile import UserProfile
from app.models.user_activity_baseline import UserActivityBaseline


def seed_user_account(db: Session) -> None:
    if not settings.seed_user_email or not settings.seed_user_password:
        return

    normalized_email = settings.seed_user_email.strip().lower()
    existing_user = db.query(UserAccount).filter(UserAccount.email == normalized_email).first()

    if existing_user:
        return

    password_salt = create_password_salt()
    user = UserAccount(
        email=normalized_email,
        password_hash=hash_password(settings.seed_user_password, password_salt),
        password_salt=password_salt,
    )
    db.add(user)
    db.flush()  # get user.id

    seed_user_id = "user_123"

    profile = UserProfile(
        user_account_id=user.id,
        name="Admin User",
        age=30,
        gender="male",
        basic_health_info="Generally healthy, regular exercise.",
    )
    db.add(profile)

    baselines = [
        UserActivityBaseline(user_account_id=user.id, user_id=seed_user_id, activity_level=0, target_hr=60, target_hrv=50, target_spo2=98.0),
        UserActivityBaseline(user_account_id=user.id, user_id=seed_user_id, activity_level=1, target_hr=80, target_hrv=45, target_spo2=97.0),
        UserActivityBaseline(user_account_id=user.id, user_id=seed_user_id, activity_level=2, target_hr=110, target_hrv=35, target_spo2=96.0),
        UserActivityBaseline(user_account_id=user.id, user_id=seed_user_id, activity_level=3, target_hr=140, target_hrv=25, target_spo2=95.0),
    ]
    db.add_all(baselines)
    db.commit()
