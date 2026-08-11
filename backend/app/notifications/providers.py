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
        payload = {
            "attachments": [
                {
                    "color": color,
                    "title": f"{message.severity} · {message.title}",
                    "text": message.body,
                    "fields": [
                        {"title": "Events", "value": f"{message.event_count:,}", "short": True},
                        {"title": "Noise Reduction", "value": f"{message.noise_reduction_ratio}%", "short": True},
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
        payload = {
            "embeds": [
                {
                    "title": f"{message.severity} · {message.title}",
                    "description": message.body,
                    "color": color,
                    "url": message.dashboard_url,
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


def get_provider(integration_type: str, config: dict) -> NotificationProvider:
    cls = _REGISTRY.get(integration_type)
    if cls is None:
        raise ValueError(f"Unknown integration type '{integration_type}'")
    return cls(config)


def known_types() -> list[str]:
    return list(_REGISTRY)
