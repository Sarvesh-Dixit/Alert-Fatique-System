from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import new_id
from app.database import Base
from app.models._mixins import TimestampMixin

JSONType = JSON().with_variant(JSONB, "postgresql")

# Default agent collection policy. The agent follows the organization's policy.
DEFAULT_AGENT_CONFIG: dict = {
    "collect_cpu": True,
    "collect_memory": True,
    "collect_disk": True,
    "collect_network": True,
    "collect_uptime": True,
    "collect_processes": True,
    "collect_system_logs": True,
    "collect_security_events": False,
    "collect_application_logs": False,
    "log_paths": [],
    "collection_interval_seconds": 15,
    "heartbeat_interval_seconds": 30,
    "redact_pii": True,
}


class AgentDevice(TimestampMixin, Base):
    """An enrolled OS monitoring agent device.

    Each device is backed by a scoped Application + API key (``application_id``)
    so OS telemetry flows through the SAME gateway, canonical schema, and
    intelligence engine as application telemetry — no separate pipeline.
    The device credential can only ingest for this device's backing application.
    """

    __tablename__ = "agent_devices"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: new_id("dev")
    )
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Backing application the device credential ingests into (set at enrollment).
    application_id: Mapped[str | None] = mapped_column(
        ForeignKey("applications.id", ondelete="SET NULL"), index=True, nullable=True
    )

    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    # windows | linux | macos
    operating_system: Mapped[str | None] = mapped_column(String(40), nullable=True)
    os_version: Mapped[str | None] = mapped_column(String(120), nullable=True)
    agent_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    region: Mapped[str | None] = mapped_column(String(60), nullable=True)

    # pending | enrolled | online | offline | revoked
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)

    enrollment_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Public prefix of the issued device credential (for masked display).
    credential_prefix: Mapped[str | None] = mapped_column(String(32), nullable=True)

    enrolled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Organization-defined collection policy the agent must follow.
    config: Mapped[dict] = mapped_column(JSONType, default=lambda: dict(DEFAULT_AGENT_CONFIG), nullable=False)

    events_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    events_dropped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
