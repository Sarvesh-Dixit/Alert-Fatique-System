"""Cooldown matrix — the core alert-fatigue control.

Decides whether a notification should be sent for an incident right now, based
on severity-driven cooldown windows, incident state, and notification history.

    first notification      -> ALWAYS send (created)
    within cooldown         -> SUPPRESS (count the event)
    cooldown expired        -> send an UPDATE
    resolved                -> send a resolved notice (once)

Cooldown durations per severity come from settings and are fully configurable.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.config import settings


@dataclass
class CooldownDecision:
    should_notify: bool
    kind: str          # created | update | resolved | suppressed
    reason: str
    cooldown_seconds: int


def decide(
    *,
    severity: str,
    status: str,
    notifications_sent: int,
    last_notified_at: datetime | None,
    now: datetime | None = None,
) -> CooldownDecision:
    now = now or datetime.now(timezone.utc)
    cooldown = settings.cooldown_for(severity)

    if status in {"RESOLVED", "CLOSED"}:
        return CooldownDecision(False, "suppressed", f"incident {status.lower()}", cooldown)

    # Silence acknowledged incidents — an engineer is already on it.
    if status == "ACKNOWLEDGED":
        return CooldownDecision(False, "suppressed", "incident acknowledged", cooldown)

    if notifications_sent == 0 or last_notified_at is None:
        return CooldownDecision(True, "created", "first notification", cooldown)

    if last_notified_at.tzinfo is None:
        last_notified_at = last_notified_at.replace(tzinfo=timezone.utc)

    elapsed = (now - last_notified_at).total_seconds()
    if elapsed >= cooldown:
        return CooldownDecision(
            True, "update", f"cooldown expired ({int(elapsed)}s >= {cooldown}s)", cooldown
        )

    remaining = int(cooldown - elapsed)
    return CooldownDecision(False, "suppressed", f"within cooldown ({remaining}s left)", cooldown)
