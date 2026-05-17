from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_password_salt, hash_password
from app.models.user_account import UserAccount


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


def seed_demo_data(db: Session) -> None:
    seed_user_account(db)
