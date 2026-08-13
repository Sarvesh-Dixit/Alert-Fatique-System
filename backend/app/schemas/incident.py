from datetime import datetime
from typing import Any

from pydantic import BaseModel


class IncidentSummary(BaseModel):
    id: str
    organization_id: str
    application_id: str
    service: str | None
    fingerprint: str | None
    title: str
    severity: str
    status: str
    first_seen: datetime
    last_seen: datetime
    event_count: int
    affected_instances: list[str]
    affected_regions: list[str]
    affected_services: list[str]
    affected_applications: list[str]
    baseline_rate: float
    current_rate: float
    spike_multiplier: float
    events_suppressed: int
    notifications_sent: int
    noise_reduction_ratio: float
    correlation_id: str | None
    last_notified_at: datetime | None = None

    class Config:
        from_attributes = True


class TimelineEntry(BaseModel):
    id: str
    kind: str
    message: str
    metadata: dict[str, Any]
    created_at: datetime

    @classmethod
    def from_model(cls, m) -> "TimelineEntry":
        return cls(id=m.id, kind=m.kind, message=m.message,
                   metadata=m.event_metadata, created_at=m.created_at)


class NotificationEntry(BaseModel):
    id: str
    kind: str
    channel: str
    severity: str
    event_count_at_send: int
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class IncidentDetail(IncidentSummary):
    timeline: list[TimelineEntry]
    notifications: list[NotificationEntry]


class ErrorGroupSummary(BaseModel):
    id: str
    application_id: str
    service: str | None
    environment: str | None
    fingerprint: str
    title: str
    severity: str
    event_count: int
    first_seen: datetime
    last_seen: datetime
    affected_instances: list[str]
    affected_regions: list[str]
    sample_event_id: str | None
    sample_message: str | None
    incident_id: str | None

    class Config:
        from_attributes = True


class IncidentStatusUpdate(BaseModel):
    status: str  # ACKNOWLEDGED | RESOLVED | CLOSED | OPEN


class NoiseReductionKPIs(BaseModel):
    events_received: int
    events_grouped: int
    events_suppressed: int
    notifications_sent: int
    naive_notifications: int
    noise_reduction_ratio: float
    active_incidents: int
    total_incidents: int
    total_groups: int
    total_events: int | None = None
    actionable_incidents: int | None = None
    suppressed_events: int | None = None


class CooldownState(BaseModel):
    incident_id: str
    service: str | None
    application_name: str | None
    title: str
    trigger_time: datetime | None
    expiry_time: datetime | None
    remaining_seconds: int
    severity: str
    suppressed_count: int
    status: str
