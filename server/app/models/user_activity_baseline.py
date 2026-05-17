from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class UserActivityBaseline(Base):
    __tablename__ = "user_activity_baselines"
    __table_args__ = (
        UniqueConstraint("user_account_id", "activity_level", name="uq_user_account_activity_baseline"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    user_account_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False
    )
    
    activity_level: Mapped[int] = mapped_column(Integer, nullable=False)
    target_hr: Mapped[int] = mapped_column(Integer, nullable=False)
    target_hrv: Mapped[int] = mapped_column(Integer, nullable=False)
    target_spo2: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
