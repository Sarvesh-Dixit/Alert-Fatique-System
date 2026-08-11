from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DeviceRegister(BaseModel):
    hostname: str = Field(min_length=1, max_length=255)
    operating_system: str | None = Field(default=None, max_length=40)
    agent_version: str | None = Field(default=None, max_length=40)
    region: str | None = Field(default=None, max_length=60)
    config: dict[str, Any] | None = None


class DeviceResponse(BaseModel):
    id: str
    organization_id: str
    application_id: str | None
    hostname: str
    operating_system: str | None
    os_version: str | None
    agent_version: str | None
    region: str | None
    status: str
    credential_prefix: str | None
    last_heartbeat_at: datetime | None
    enrolled_at: datetime | None
    created_at: datetime
    events_received: int
    events_dropped: int
    config: dict[str, Any]

    class Config:
        from_attributes = True


class DeviceRegisteredResponse(DeviceResponse):
    """Includes the short-lived enrollment token ONCE at registration."""

    enrollment_token: str


class DeviceEnrollRequest(BaseModel):
    device_id: str
    enrollment_token: str
    hostname: str | None = None
    operating_system: str | None = None
    os_version: str | None = None
    agent_version: str | None = None


class DeviceEnrolledResponse(DeviceResponse):
    """Returned to the agent at enrollment — includes the device credential ONCE."""

    device_credential: str


class DeviceHeartbeat(BaseModel):
    device_id: str
    agent_version: str | None = None


class AgentHeartbeat(BaseModel):
    agent_version: str | None = None
    os_version: str | None = None


class AgentConfigResponse(BaseModel):
    device_id: str
    organization_id: str
    hostname: str
    region: str | None
    config: dict[str, Any]


class DeviceConfigUpdate(BaseModel):
    config: dict[str, Any]
