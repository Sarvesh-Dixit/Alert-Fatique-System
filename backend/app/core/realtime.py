"""Real-time dashboard updates via Redis Pub/Sub.

The intelligence worker publishes incident events to a per-organization channel;
the API exposes them to the dashboard over Server-Sent Events (SSE). Fails safe:
if Redis pub/sub is unavailable, publishing is a no-op so the core pipeline is
never blocked.
"""
from __future__ import annotations

import json
import logging

from app.config import settings
from app.core import redis_client

log = logging.getLogger("telemetry.realtime")


def channel_for(organization_id: str) -> str:
    return f"{settings.incident_channel_prefix}:{organization_id}"


def publish(organization_id: str, event_type: str, payload: dict) -> None:
    """Publish a real-time update for an organization. Never raises."""
    try:
        r = redis_client.get_redis()
        r.publish(
            channel_for(organization_id),
            json.dumps({"type": event_type, "data": payload}, default=str),
        )
    except Exception:  # noqa: BLE001 - realtime is best-effort
        log.debug("realtime publish failed for org %s", organization_id)
