"""Notification service — fans an incident *decision* out to providers.

Receives a final send decision from the incident engine (the cooldown matrix
already decided send vs suppress). The service never re-decides noisiness; it
only delivers, records per-channel history, and isolates provider failures.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import metrics
from app.intelligence.normalize import severity_rank
from app.models.incident import Incident, NotificationLog
from app.models.integration import Integration
from app.notifications.base import build_message
from app.notifications.providers import get_provider

log = logging.getLogger("telemetry.notifications")


def _eligible(integration: Integration, incident: Incident) -> bool:
    if not integration.enabled:
        return False
    return severity_rank(incident.severity) >= severity_rank(integration.min_severity)


def dispatch_incident(db: Session, incident: Incident, *, kind: str, reason: str = "") -> int:
    """Send an incident notification to all eligible providers for the org.

    Returns the number of providers that delivered successfully. Best-effort:
    provider failures are recorded but never propagate to the pipeline.
    """
    integrations = db.scalars(
        select(Integration).where(Integration.organization_id == incident.organization_id)
    ).all()
    if not integrations:
        return 0

    message = build_message(incident, kind, reason)
    now = datetime.now(timezone.utc)
    delivered = 0

    for integration in integrations:
        if not _eligible(integration, incident):
            continue
        try:
            provider = get_provider(integration.type, integration.config)
            provider.send(message)
            integration.last_used_at = now
            integration.last_error = None
            delivered += 1
            db.add(
                NotificationLog(
                    incident_id=incident.id,
                    organization_id=incident.organization_id,
                    kind=kind,
                    channel=integration.type,
                    severity=incident.severity,
                    event_count_at_send=incident.event_count,
                    message=f"Delivered via {integration.type}: {incident.title}",
                )
            )
        except Exception as exc:  # noqa: BLE001 - isolate provider failures
            integration.last_error = str(exc)[:500]
            metrics.incr("notification_failures", organization_id=incident.organization_id)
            log.warning("notification provider '%s' failed: %s", integration.type, exc)

    return delivered


def send_test(db: Session, integration: Integration) -> None:
    """Send a synthetic test notification through a single integration."""
    class _Fake:
        id = "inc_test"
        title = "Test notification from Telemetry Highway"
        severity = "CRITICAL"
        event_count = 1234
        affected_services = ["orders", "checkout"]
        affected_instances = ["srv-1", "srv-2", "srv-3"]
        spike_multiplier = 12.5
        noise_reduction_ratio = 99.9

    message = build_message(_Fake(), "test", "manual test")
    provider = get_provider(integration.type, integration.config)
    provider.send(message)
    integration.last_used_at = datetime.now(timezone.utc)
    integration.last_error = None
