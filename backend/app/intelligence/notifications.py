"""Notification dispatch + accounting.

Phase 2 ships the *dashboard* channel and full noise-reduction accounting.
Slack/Discord/email are represented as channels here and are trivial to wire in
Phase 3 (each would consume the same NotificationLog records). Every send is
recorded so cooldown decisions and the Noise Reduction Ratio stay accurate.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core import realtime
from app.models.incident import Incident, NotificationLog


def _recompute_noise_reduction(incident: Incident) -> None:
    """noise_reduction_ratio = 1 - notifications_sent / events_received.

    In a naive system every event would trigger a notification, so
    ``event_count`` is the raw notification count.
    """
    raw = max(incident.event_count, 1)
    incident.noise_reduction_ratio = round(
        max(0.0, 1.0 - (incident.notifications_sent / raw)) * 100.0, 2
    )


def send_notification(
    db: Session,
    incident: Incident,
    *,
    kind: str,
    reason: str,
    channel: str = "dashboard",
    now: datetime | None = None,
) -> NotificationLog:
    """Record a notification, update counters, and push a realtime event."""
    now = now or datetime.now(timezone.utc)

    log = NotificationLog(
        incident_id=incident.id,
        organization_id=incident.organization_id,
        kind=kind,
        channel=channel,
        severity=incident.severity,
        event_count_at_send=incident.event_count,
        message=f"[{incident.severity}] {incident.title} — {reason} "
        f"(events={incident.event_count}, instances={len(incident.affected_instances)})",
    )
    db.add(log)

    incident.notifications_sent += 1
    incident.last_notified_at = now
    _recompute_noise_reduction(incident)

    realtime.publish(
        incident.organization_id,
        "notification",
        {
            "incident_id": incident.id,
            "kind": kind,
            "severity": incident.severity,
            "title": incident.title,
            "event_count": incident.event_count,
        },
    )

    # Fan the decision out to configured external providers (Slack/Discord/
    # email). The cooldown matrix already decided to send — providers only
    # deliver. Best-effort: never let a provider failure break processing.
    try:
        from app.core import metrics
        from app.notifications.service import dispatch_incident

        metrics.incr("notifications_sent", organization_id=incident.organization_id)
        dispatch_incident(db, incident, kind=kind, reason=reason)
    except Exception:  # noqa: BLE001
        pass

    return log


def record_suppression(incident: Incident) -> None:
    """Account for an event whose notification was suppressed by cooldown."""
    incident.events_suppressed += 1
    _recompute_noise_reduction(incident)
