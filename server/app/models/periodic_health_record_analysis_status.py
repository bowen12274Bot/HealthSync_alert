from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PeriodicHealthRecordAnalysisStatus(Base):
    __tablename__ = "periodic_health_record_analysis_statuses"
    __table_args__ = (
        UniqueConstraint(
            "periodic_health_record_id",
            name="uq_periodic_health_record_analysis_status_record",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    periodic_health_record_id: Mapped[int] = mapped_column(
        ForeignKey("periodic_health_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    is_trend_weekly_analyzed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_trend_monthly_analyzed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

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
