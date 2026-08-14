"""Application configuration loaded from environment variables.

All settings are centralized here so Phase 2 / Phase 3 can extend behavior
without hunting through the codebase for magic values.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "Telemetry Highway"
    environment: str = "development"
    # Comma-separated CORS origins. Use "*" for a permissive dev config; set an
    # explicit list (e.g. "https://dashboard.example.com") in production so the
    # frontend can still reach the API through the browser's same-origin policy.
    cors_origins: str = "*"

    # Security
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # Database
    database_url: str = (
        "postgresql+psycopg://telemetry:telemetry@localhost:5432/telemetry_highway"
    )

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    telemetry_stream: str = "telemetry:events"
    telemetry_consumer_group: str = "telemetry-workers"
    # Dead-letter stream for events the worker fails to process. Kept separate
    # so poison-pill loops are prevented while data loss is still recoverable.
    telemetry_dlq_stream: str = "telemetry:dlq"
    telemetry_dlq_max_len: int = 10_000

    # Ingestion limits
    max_payload_bytes: int = 262_144  # 256 KiB
    max_batch_size: int = 500
    rate_limit_per_minute: int = 600

    # ---- Phase 2: intelligence layer ----
    # Real-time pub/sub channel prefix for dashboard updates.
    incident_channel_prefix: str = "incidents"

    # Spike detection (sliding window frequency analysis).
    spike_window_seconds: int = 60          # "current rate" window
    spike_baseline_seconds: int = 900       # baseline lookback (15 min)
    spike_multiplier: float = 5.0           # current > baseline * multiplier => spike
    spike_min_events: int = 10              # ignore tiny volumes

    # Cooldown matrix (seconds) per severity — configurable.
    cooldown_critical_seconds: int = 120
    cooldown_high_seconds: int = 300
    cooldown_medium_seconds: int = 900
    cooldown_low_seconds: int = 1800
    cooldown_info_seconds: int = 3600

    # Severity engine thresholds (event counts within an active incident).
    severity_high_event_count: int = 100
    severity_critical_event_count: int = 1000
    severity_critical_instance_count: int = 5
    severity_critical_service_count: int = 3

    # Deterministic correlation window (seconds) for multi-service incidents.
    correlation_window_seconds: int = 300

    # An incident is opened when any of these hold: the event is error-like
    # (>= ERROR), a spike is detected, or a group's volume crosses this count.
    incident_trigger_event_count: int = 50

    # ---- Phase 3: agent, notifications, retention, region ----
    # Default data region for this gateway instance (region-aware, not multi-DC).
    data_region: str = "global"

    # Retention (days). Raw telemetry is the most sensitive → shortest default.
    retention_raw_telemetry_days: int = 7
    retention_incident_days: int = 90
    retention_audit_days: int = 365

    # Notification dispatch
    notification_timeout_seconds: float = 5.0
    dashboard_base_url: str = "http://localhost:5173"

    # SMTP for email notifications (no hardcoded secrets — configure via env).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "alerts@telemetry-highway.local"
    smtp_use_tls: bool = True

    # Agent defaults
    agent_heartbeat_interval_seconds: int = 30
    agent_collection_interval_seconds: int = 15

    # Incident auto-resolve: close incidents with no events for this long
    # (used by the housekeeping pass; not required for the core pipeline).
    incident_stale_seconds: int = 1800

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    def cooldown_for(self, severity: str) -> int:
        return {
            "CRITICAL": self.cooldown_critical_seconds,
            "HIGH": self.cooldown_high_seconds,
            "ERROR": self.cooldown_high_seconds,
            "MEDIUM": self.cooldown_medium_seconds,
            "WARNING": self.cooldown_medium_seconds,
            "LOW": self.cooldown_low_seconds,
            "INFO": self.cooldown_info_seconds,
        }.get(severity.upper(), self.cooldown_medium_seconds)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
