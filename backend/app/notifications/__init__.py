"""Notification provider abstraction (Phase 3).

The incident engine never talks to Slack/Discord/email directly. It emits a
final *decision* (send/suppress) via the Phase 2 cooldown matrix; the
notification service then fans that decision out to whatever providers the
organization has configured. Providers are pluggable and failure-isolated.
"""
from app.notifications.base import NotificationMessage, NotificationProvider
from app.notifications.service import dispatch_incident, send_test

__all__ = ["NotificationMessage", "NotificationProvider", "dispatch_incident", "send_test"]
