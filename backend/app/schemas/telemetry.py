from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TelemetryIngest(BaseModel):
    """Incoming telemetry event from an SDK/agent.

    Only the essentials are required — the gateway fills in server-side
    metadata (org/app/ids/received_at) after authenticating the API key.
    """

    event_id: str | None = None
    service: str | None = Field(default=None, max_length=200)
    source_type: str = Field(default="application", max_length=40)
    environment: str | None = Field(default=None, max_length=60)
    region: str | None = Field(default=None, max_length=60)
    event_type: str = Field(default="log", max_length=40)
    severity: str = Field(default="INFO", max_length=20)
    message: str | None = None
    timestamp: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class TelemetryBatchIngest(BaseModel):
    events: list[TelemetryIngest]


class IngestAccepted(BaseModel):
    accepted: int
    event_ids: list[str]


class TelemetryEventResponse(BaseModel):
    event_id: str
    organization_id: str
    application_id: str
    service: str | None
    source_type: str
    environment: str | None
    region: str | None
    event_type: str
    severity: str
    message: str | None
    timestamp: datetime
    received_at: datetime
    metadata: dict[str, Any]

    @classmethod
    def from_model(cls, m) -> "TelemetryEventResponse":
        return cls(
            event_id=m.id,
            organization_id=m.organization_id,
            application_id=m.application_id,
            service=m.service,
            source_type=m.source_type,
            environment=m.environment,
            region=m.region,
            event_type=m.event_type,
            severity=m.severity,
            message=m.message,
            timestamp=m.timestamp,
            received_at=m.received_at,
            metadata=m.event_metadata,
        )
