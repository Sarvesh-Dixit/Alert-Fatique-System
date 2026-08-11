"""Configurable data retention + purge logic (Phase 3, data privacy).

Distinguishes data classes with different lifetimes:
  * raw telemetry     — most sensitive, shortest default (7 days)
  * incident metadata — 90 days
  * audit logs        — longest (365 days)

Purge is idempotent and safe to run repeatedly (e.g. from a housekeeping loop).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.audit import AuditLog
from app.models.incident import Incident, NotificationLog
from app.models.integration import RetentionPolicy
from app.models.telemetry import TelemetryEvent


def get_policy(db: Session, organization_id: str) -> RetentionPolicy:
    policy = db.get(RetentionPolicy, organization_id)
    if policy is None:
        policy = RetentionPolicy(
            organization_id=organization_id,
            raw_telemetry_days=settings.retention_raw_telemetry_days,
            incident_days=settings.retention_incident_days,
            audit_days=settings.retention_audit_days,
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
    return policy


def purge_organization(db: Session, organization_id: str, now: datetime | None = None) -> dict:
    """Delete data older than the org's retention policy. Returns counts."""
    now = now or datetime.now(timezone.utc)
    policy = get_policy(db, organization_id)

    raw_cutoff = now - timedelta(days=policy.raw_telemetry_days)
    incident_cutoff = now - timedelta(days=policy.incident_days)
    audit_cutoff = now - timedelta(days=policy.audit_days)

    # Raw telemetry (processed events + incident summaries survive longer).
    raw_deleted = db.execute(
        delete(TelemetryEvent).where(
            TelemetryEvent.organization_id == organization_id,
            TelemetryEvent.received_at < raw_cutoff,
        )
    ).rowcount

    # Closed/resolved incidents past the incident retention window.
    stale_incident_ids = db.scalars(
        select(Incident.id).where(
            Incident.organization_id == organization_id,
            Incident.status.in_(["RESOLVED", "CLOSED"]),
            Incident.last_seen < incident_cutoff,
        )
    ).all()
    incidents_deleted = 0
    if stale_incident_ids:
        db.execute(delete(NotificationLog).where(NotificationLog.incident_id.in_(stale_incident_ids)))
        incidents_deleted = db.execute(
            delete(Incident).where(Incident.id.in_(stale_incident_ids))
        ).rowcount

    audit_deleted = db.execute(
        delete(AuditLog).where(
            AuditLog.organization_id == organization_id,
            AuditLog.created_at < audit_cutoff,
        )
    ).rowcount

    db.commit()
    return {
        "raw_telemetry_deleted": int(raw_deleted or 0),
        "incidents_deleted": int(incidents_deleted or 0),
        "audit_deleted": int(audit_deleted or 0),
    }
