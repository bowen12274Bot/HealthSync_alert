from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.profile.user_profile import UserProfile


class ActivityBaselineProfile(Base):
    __tablename__ = "activity_baseline_profile"
    __table_args__ = (
        UniqueConstraint("user_profile_id", "activity_level", name="uq_baseline_profile_level"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_profile_id: Mapped[int] = mapped_column(
        ForeignKey("user_profiles.id"),
        index=True,
        nullable=False,
    )
    activity_level: Mapped[int] = mapped_column(Integer, nullable=False)
    target_hr: Mapped[int] = mapped_column(Integer, nullable=False)
    target_hrv: Mapped[int] = mapped_column(Integer, nullable=False)
    target_spo2: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user_profile: Mapped["UserProfile"] = relationship(back_populates="activity_baseline_profiles")
