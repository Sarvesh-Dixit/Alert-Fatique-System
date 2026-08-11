"""Phase 2 intelligence models: error groups, incidents, timeline, notifications.

These sit *on top of* the Phase 1 canonical ``telemetry_events`` table. Raw
events are never deleted — grouping and incidents are aggregations that point
back to the underlying telemetry for investigation.
"""
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ids import new_id
from app.database import Base
from app.models._mixins import TimestampMixin, utcnow

JSONType = JSON().with_variant(JSONB, "postgresql")


class ErrorGroup(TimestampMixin, Base):
    """Deduplicated group of similar events sharing a fingerprint.

    10,000 identical errors collapse into a single row here (count += 1) while
    every raw event still lives in ``telemetry_events``.
    """

    __tablename__ = "error_groups"
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "application_id", "service", "environment", "fingerprint",
            name="uq_error_group",
        ),
        Index("ix_group_org_lastseen", "organization_id", "last_seen"),
        Index("ix_group_fingerprint", "fingerprint"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("grp"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    service: Mapped[str | None] = mapped_column(String(200), nullable=True)
    environment: Mapped[str | None] = mapped_column(String(60), nullable=True)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)

    title: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(String(40), default="log", nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="INFO", nullable=False)

    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    event_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    affected_instances: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    affected_regions: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)

    sample_event_id: Mapped[str | None] = mapped_column(String, nullable=True)
    sample_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    incident_id: Mapped[str | None] = mapped_column(
        ForeignKey("incidents.id", ondelete="SET NULL"), index=True, nullable=True
    )


class Incident(TimestampMixin, Base):
    """An operational incident aggregating one or more error groups.

    Lifecycle: OPEN -> ACKNOWLEDGED -> RESOLVED -> CLOSED.
    """

    __tablename__ = "incidents"
    __table_args__ = (
        Index("ix_incident_org_status", "organization_id", "status"),
        Index("ix_incident_updated", "organization_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("inc"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    service: Mapped[str | None] = mapped_column(String(200), nullable=True)
    fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)

    title: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="INFO", nullable=False)
    # OPEN | ACKNOWLEDGED | RESOLVED | CLOSED
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False)

    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    event_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    affected_instances: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    affected_regions: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    affected_services: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    # Cross-application correlation (one operational incident can span apps).
    affected_applications: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)

    # Spike metrics
    baseline_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    current_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    spike_multiplier: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Noise-reduction accounting
    events_suppressed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notifications_sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    noise_reduction_ratio: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Deterministic correlation grouping (multi-service incidents share this)
    correlation_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)

    last_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    timeline = relationship(
        "IncidentTimelineEntry", back_populates="incident", cascade="all, delete-orphan"
    )
    notifications = relationship(
        "NotificationLog", back_populates="incident", cascade="all, delete-orphan"
    )


class IncidentTimelineEntry(Base):
    """Ordered, human-readable timeline of what happened in an incident."""

    __tablename__ = "incident_timeline"
    __table_args__ = (Index("ix_timeline_incident", "incident_id", "created_at"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("tl"))
    incident_id: Mapped[str] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    # first_event | spike_started | incident_created | notification_sent |
    # events_suppressed | cooldown_expired | notification_updated |
    # acknowledged | resolved | closed | correlated
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    event_metadata: Mapped[dict] = mapped_column("metadata", JSONType, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    incident = relationship("Incident", back_populates="timeline")


class NotificationLog(Base):
    """Record of every notification actually sent (for history + cooldown)."""

    __tablename__ = "notification_logs"
    __table_args__ = (Index("ix_notif_incident", "incident_id", "created_at"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("ntf"))
    incident_id: Mapped[str] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # created | update | resolved
    kind: Mapped[str] = mapped_column(String(20), default="created", nullable=False)
    channel: Mapped[str] = mapped_column(String(40), default="dashboard", nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="INFO", nullable=False)
    event_count_at_send: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    incident = relationship("Incident", back_populates="notifications")
