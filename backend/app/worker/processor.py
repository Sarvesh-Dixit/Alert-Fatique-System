"""Telemetry processing: persist the raw event, then run the intelligence layer.

Order of operations per event (at-least-once, idempotent on ``event_id``):

    normalize -> fingerprint -> persist raw TelemetryEvent
              -> intelligence engine (group/dedup/spike/incident/cooldown)
              -> back-fill event.fingerprint / incident_id / correlation_id

Raw events are always persisted first so telemetry stays fully investigable
even if the intelligence layer changes.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.intelligence.engine import run_intelligence
from app.intelligence.fingerprint import compute_fingerprint
from app.intelligence.normalize import normalize_event
from app.models.application import Service
from app.models.telemetry import TelemetryEvent


def _ensure_service(db: Session, event: dict) -> None:
    """Auto-register a service the first time we see its name for an app."""
    name = event.get("service")
    if not name:
        return
    exists = db.scalar(
        select(Service).where(
            Service.application_id == event["application_id"],
            Service.name == name,
        )
    )
    if exists is None:
        db.add(
            Service(
                organization_id=event["organization_id"],
                application_id=event["application_id"],
                name=name,
            )
        )


def process_event(db: Session, event: dict, *, commit: bool = True) -> TelemetryEvent:
    """Persist one canonical telemetry event and run the intelligence pipeline.

    Idempotent on ``event_id`` (safe under at-least-once stream delivery).
    Pass ``commit=False`` to batch many events into a single transaction
    (used by the demo simulator); the caller is then responsible for commit.
    """
    event_id = event["event_id"]

    existing = db.get(TelemetryEvent, event_id)
    if existing is not None:
        return existing  # dedup on retry — do not double-count intelligence

    # --- normalize + fingerprint ---
    normalized = normalize_event(event)
    fingerprint = compute_fingerprint(normalized)
    normalized["fingerprint"] = fingerprint

    _ensure_service(db, normalized)

    ts: datetime = normalized["timestamp"]
    received = normalized.get("received_at")
    received_dt = ts
    if received:
        from app.intelligence.normalize import parse_dt

        received_dt = parse_dt(received)

    row = TelemetryEvent(
        id=event_id,
        organization_id=normalized["organization_id"],
        application_id=normalized["application_id"],
        service=normalized.get("service"),
        source_type=normalized.get("source_type", "application"),
        environment=normalized.get("environment"),
        region=normalized.get("region"),
        event_type=normalized.get("event_type", "log"),
        severity=normalized["severity"],
        message=normalized.get("message"),
        timestamp=ts,
        received_at=received_dt,
        event_metadata=event.get("metadata") or {},
        fingerprint=fingerprint,
    )
    db.add(row)
    db.flush()

    # --- intelligence layer ---
    result = run_intelligence(db, normalized)
    if result.incident is not None:
        row.incident_id = result.incident.id
        row.correlation_id = result.incident.correlation_id

    if commit:
        db.commit()
    else:
        db.flush()

    from app.core import metrics

    metrics.incr("processed", organization_id=normalized["organization_id"])
    return row
