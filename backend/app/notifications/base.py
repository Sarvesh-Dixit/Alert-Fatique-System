"""Provider abstraction + message formatting."""
from __future__ import annotations

import json
import urllib.request
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.config import settings


@dataclass
class NotificationMessage:
    """A provider-agnostic incident notification payload."""

    kind: str            # created | update | resolved | test
    severity: str
    title: str
    incident_id: str | None
    event_count: int
    affected_services: int
    affected_instances: int
    spike_multiplier: float
    noise_reduction_ratio: float
    dashboard_url: str
    body: str            # pre-rendered plain-text body
    events_suppressed: int
    gptrace_score: float | None = None


def http_post_json(url: str, payload: dict, timeout: float | None = None) -> int:
    """POST JSON to a webhook. Returns HTTP status. Isolated for testability."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout or settings.notification_timeout_seconds) as resp:
        return resp.status


def build_message(incident, kind: str, reason: str = "") -> NotificationMessage:
    """Render a NotificationMessage from an Incident ORM object."""
    url = f"{settings.dashboard_base_url}/incidents/{incident.id}"
    emoji = {"CRITICAL": "🚨", "HIGH": "🔴", "ERROR": "🟠", "WARNING": "🟡"}.get(incident.severity, "🔔")
    prefix = {"created": f"{emoji} INCIDENT", "update": "🔁 INCIDENT UPDATE",
              "resolved": "✅ RESOLVED", "test": "🧪 TEST"}.get(kind, "INCIDENT")

    score = getattr(incident, "gptrace_score", None)
    score_str = f"GPTrace Score: {score:.4f}" if score is not None else "GPTrace Score: N/A"
    suppressed = getattr(incident, "events_suppressed", 0)

    body = (
        f"{prefix}\n"
        f"{incident.title}\n"
        f"Severity: {incident.severity}\n"
        f"Events: {incident.event_count:,}\n"
        f"Suppressed Events: {suppressed:,}\n"
        f"{score_str}\n"
        f"Affected Services: {len(incident.affected_services or [])}\n"
        f"Affected Instances: {len(incident.affected_instances or [])}\n"
        f"Spike: {incident.spike_multiplier}×\n"
        f"Noise Reduction: {incident.noise_reduction_ratio}%\n"
        f"View Incident: {url}"
    )
    return NotificationMessage(
        kind=kind,
        severity=incident.severity,
        title=incident.title,
        incident_id=incident.id,
        event_count=incident.event_count,
        affected_services=len(incident.affected_services or []),
        affected_instances=len(incident.affected_instances or []),
        spike_multiplier=incident.spike_multiplier,
        noise_reduction_ratio=incident.noise_reduction_ratio,
        dashboard_url=url,
        body=body,
        events_suppressed=suppressed,
        gptrace_score=score,
    )


class NotificationProvider(ABC):
    """Base class for all notification providers."""

    type: str = "base"

    def __init__(self, config: dict):
        self.config = config or {}

    @abstractmethod
    def send(self, message: NotificationMessage) -> None:
        """Deliver the message. Raise on failure (the service isolates errors)."""
        raise NotImplementedError
