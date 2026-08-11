from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._mixins import utcnow

# JSONB on PostgreSQL, generic JSON everywhere else (e.g. SQLite in tests).
JSONType = JSON().with_variant(JSONB, "postgresql")


class TelemetryEvent(Base):
    """The canonical, normalized telemetry record.

    This is the stable contract Phase 2/3 consume. The ``fingerprint``,
    ``incident_id`` and ``correlation_id`` columns are intentionally nullable
    now — Phase 2 intelligence populates them without a schema rewrite.
    """

    __tablename__ = "telemetry_events"
    __table_args__ = (
        Index("ix_telemetry_org_time", "organization_id", "timestamp"),
        Index("ix_telemetry_app_time", "application_id", "timestamp"),
        Index("ix_telemetry_severity", "severity"),
        Index("ix_telemetry_event_type", "event_type"),
        Index("ix_telemetry_service", "service"),
        Index("ix_telemetry_fingerprint", "fingerprint"),
    )

    # event_id (evt_...) — supplied by client or generated at ingestion.
    id: Mapped[str] = mapped_column("event_id", String, primary_key=True)

    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )

    service: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # application | agent | system  (extensible)
    source_type: Mapped[str] = mapped_column(String(40), default="application", nullable=False)
    environment: Mapped[str | None] = mapped_column(String(60), nullable=True)
    region: Mapped[str | None] = mapped_column(String(60), nullable=True)

    # log | metric | trace | system | security  (extensible, not hard-coded)
    event_type: Mapped[str] = mapped_column(String(40), default="log", nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="INFO", nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Event time (from the client) and server receive time.
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    event_metadata: Mapped[dict] = mapped_column("metadata", JSONType, default=dict, nullable=False)

    # ---- Phase 2 placeholders (nullable now) ----
    fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    incident_id: Mapped[str | None] = mapped_column(String, nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String, nullable=True)
