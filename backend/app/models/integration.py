"""Notification integrations + per-organization retention policy (Phase 3)."""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import new_id
from app.database import Base
from app.models._mixins import TimestampMixin, utcnow

JSONType = JSON().with_variant(JSONB, "postgresql")


class Integration(TimestampMixin, Base):
    """A configured notification provider for an organization.

    ``config`` holds provider settings (e.g. webhook URL, email recipients).
    Secrets in ``config`` are never returned verbatim by the API (masked) and
    never written to audit logs.
    """

    __tablename__ = "integrations"
    __table_args__ = (
        UniqueConstraint("organization_id", "type", name="uq_org_integration"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("int"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # slack | discord | email
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Minimum severity that triggers this integration (INFO..CRITICAL).
    min_severity: Mapped[str] = mapped_column(String(20), default="HIGH", nullable=False)
    config: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)

    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)


class RetentionPolicy(Base):
    """Per-organization data retention (days). One row per organization."""

    __tablename__ = "retention_policies"

    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True
    )
    raw_telemetry_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    incident_days: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    audit_days: Mapped[int] = mapped_column(Integer, default=365, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
