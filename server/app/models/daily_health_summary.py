from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DailyHealthSummary(Base):
    __tablename__ = "daily_health_summaries"
    __table_args__ = (
        UniqueConstraint("user_account_id", "summary_date", name="uq_daily_health_summary_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    user_account_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False
    )
    
    summary_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    avg_hr: Mapped[int] = mapped_column(Integer, nullable=False)
    resting_hr: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_hrv: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_spo2: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    min_spo2: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    total_steps: Mapped[int] = mapped_column(Integer, nullable=False)
    sleep_duration: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    sleep_cycle_summary: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
