"""Concrete notification providers: Slack, Discord, Email."""
from __future__ import annotations

import smtplib
from email.mime.text import MIMEText

from app.config import settings
from app.notifications.base import NotificationMessage, NotificationProvider, http_post_json


class SlackProvider(NotificationProvider):
    type = "slack"

    def send(self, message: NotificationMessage) -> None:
        webhook = self.config.get("webhook_url")
        if not webhook:
            raise ValueError("Slack integration missing webhook_url")
        color = {"CRITICAL": "#dc2626", "HIGH": "#ef4444", "ERROR": "#f97316"}.get(
            message.severity, "#3b82f6"
        )
        emoji = {"CRITICAL": "🚨", "HIGH": "🔴", "ERROR": "🟠", "WARNING": "🟡"}.get(message.severity, "🔔")
        score_val = f"{message.gptrace_score:.4f}" if message.gptrace_score is not None else "N/A"
        payload = {
            "attachments": [
                {
                    "color": color,
                    "title": f"{emoji} {message.severity} · {message.title}",
                    "title_link": message.dashboard_url,
                    "text": message.body,
                    "fields": [
                        {"title": "Events", "value": f"{message.event_count:,}", "short": True},
                        {"title": "Suppressed", "value": f"{message.events_suppressed:,}", "short": True},
                        {"title": "GPTrace Match Score", "value": score_val, "short": True},
                        {"title": "Noise Reduction", "value": f"{message.noise_reduction_ratio}%", "short": True},
                        {"title": "Incident Details Link", "value": f"<{message.dashboard_url}|Click here to view incident>", "short": False},
                    ],
                }
            ]
        }
        http_post_json(webhook, payload)


class DiscordProvider(NotificationProvider):
    type = "discord"

    def send(self, message: NotificationMessage) -> None:
        webhook = self.config.get("webhook_url")
        if not webhook:
            raise ValueError("Discord integration missing webhook_url")
        color = {"CRITICAL": 0xDC2626, "HIGH": 0xEF4444, "ERROR": 0xF97316}.get(
            message.severity, 0x3B82F6
        )
        emoji = {"CRITICAL": "🚨", "HIGH": "🔴", "ERROR": "🟠", "WARNING": "🟡"}.get(message.severity, "🔔")
        score_val = f"{message.gptrace_score:.4f}" if message.gptrace_score is not None else "N/A"
        payload = {
            "embeds": [
                {
                    "title": f"{emoji} {message.severity} · {message.title}",
                    "description": message.body,
                    "color": color,
                    "url": message.dashboard_url,
                    "fields": [
                        {"name": "Total Events", "value": f"{message.event_count:,}", "inline": True},
                        {"name": "Suppressed Events", "value": f"{message.events_suppressed:,}", "inline": True},
                        {"name": "GPTrace Score", "value": score_val, "inline": True},
                        {"name": "Noise Reduction Ratio", "value": f"{message.noise_reduction_ratio}%", "inline": True},
                        {"name": "Deep-Link", "value": f"[View on Dashboard]({message.dashboard_url})", "inline": False},
                    ]
                }
            ]
        }
        http_post_json(webhook, payload)


class EmailProvider(NotificationProvider):
    type = "email"

    def send(self, message: NotificationMessage) -> None:
        recipients = self.config.get("recipients") or []
        if isinstance(recipients, str):
            recipients = [r.strip() for r in recipients.split(",") if r.strip()]
        if not recipients:
            raise ValueError("Email integration missing recipients")
        if not settings.smtp_host:
            raise ValueError("SMTP is not configured on the server")

        msg = MIMEText(message.body)
        msg["Subject"] = f"[{message.severity}] {message.title}"
        msg["From"] = settings.smtp_from
        msg["To"] = ", ".join(recipients)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port,
                          timeout=settings.notification_timeout_seconds) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, recipients, msg.as_string())


_REGISTRY: dict[str, type[NotificationProvider]] = {
    "slack": SlackProvider,
    "discord": DiscordProvider,
    "email": EmailProvider,
}

# Frozen for O(1) membership checks in the admin router.
_KNOWN_TYPES: frozenset[str] = frozenset(_REGISTRY)


def get_provider(integration_type: str, config: dict) -> NotificationProvider:
    cls = _REGISTRY.get(integration_type)
    if cls is None:
        raise ValueError(f"Unknown integration type '{integration_type}'")
    return cls(config)


def known_types() -> frozenset[str]:
    return _KNOWN_TYPES
