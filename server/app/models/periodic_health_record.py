from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, Numeric, String, UniqueConstraint, func, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PeriodicHealthRecord(Base):
    __tablename__ = "periodic_health_records"
    __table_args__ = (
        UniqueConstraint("user_id", "window_start", "window_end", name="uq_periodic_health_record_window"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    device_id: Mapped[str] = mapped_column(String(100), nullable=False)
    
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    avg_hr: Mapped[int] = mapped_column(Integer, nullable=False)
    min_hr: Mapped[int] = mapped_column(Integer, nullable=False)
    max_hr: Mapped[int] = mapped_column(Integer, nullable=False)
    
    avg_hrv: Mapped[int] = mapped_column(Integer, nullable=False)
    
    avg_spo2: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    min_spo2: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    
    dominant_activity_level: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)
    
    raw_data_payload: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
