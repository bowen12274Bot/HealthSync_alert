from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.auth.user_account import UserAccount
    from app.models.profile.activity_baseline_profile import ActivityBaselineProfile


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_account_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.id"),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    age: Mapped[int] = mapped_column(nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    basic_health_info: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user_account: Mapped["UserAccount"] = relationship(back_populates="user_profile")
    activity_baseline_profiles: Mapped[list["ActivityBaselineProfile"]] = relationship(
        back_populates="user_profile",
        cascade="all, delete-orphan",
    )
