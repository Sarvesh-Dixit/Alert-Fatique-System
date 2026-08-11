from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ids import new_id
from app.database import Base
from app.models._mixins import TimestampMixin


class Application(TimestampMixin, Base):
    """A monitored application/project belonging to an organization."""

    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: new_id("app")
    )
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    environment: Mapped[str] = mapped_column(String(60), default="production", nullable=False)
    region: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    organization = relationship("Organization", back_populates="applications")
    api_keys = relationship(
        "ApplicationApiKey", back_populates="application", cascade="all, delete-orphan"
    )
    services = relationship(
        "Service", back_populates="application", cascade="all, delete-orphan"
    )


class ApplicationApiKey(TimestampMixin, Base):
    """A scoped telemetry ingestion credential for a single application.

    Only ``key_hash`` is persisted. ``key_prefix`` is a public identifier used
    for fast lookup and for producing a masked display value.
    """

    __tablename__ = "application_api_keys"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: new_id("key")
    )
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), default="default", nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    environment_scope: Mapped[str] = mapped_column(String(60), default="production", nullable=False)

    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # If this key was created by rotating another, keep a link for audit.
    rotated_from: Mapped[str | None] = mapped_column(String, nullable=True)

    application = relationship("Application", back_populates="api_keys")

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None


class Service(TimestampMixin, Base):
    """A logical service within an application (auto-registered from telemetry)."""

    __tablename__ = "services"
    __table_args__ = (
        UniqueConstraint("application_id", "name", name="uq_service_per_app"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: new_id("svc")
    )
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    application = relationship("Application", back_populates="services")
