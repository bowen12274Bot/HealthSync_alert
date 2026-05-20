from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AlertHistory(Base):
    __tablename__ = "alert_histories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    user_account_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False
    )
    
    alert_source: Mapped[str] = mapped_column(String(50), default="mobile", nullable=False)
    alert_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    max_risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    max_severity_level: Mapped[str] = mapped_column(String(32), nullable=False)
    trigger_reason: Mapped[str] = mapped_column(String(500), nullable=False)
    
    first_occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_abnormal_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status_change_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_worsened: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    status_history_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="resolved", nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
