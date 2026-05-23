from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class LongTermAnalysisLink(Base):
    __tablename__ = "long_term_analysis_links"
    __table_args__ = (
        UniqueConstraint(
            "long_term_alert_id",
            "periodic_health_record_id",
            name="uq_long_term_analysis_link_pair",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    long_term_alert_id: Mapped[int] = mapped_column(
        ForeignKey("long_term_alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    periodic_health_record_id: Mapped[int] = mapped_column(
        ForeignKey("periodic_health_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
