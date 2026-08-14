from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class IntegrationCreate(BaseModel):
    type: str = Field(pattern="^(slack|discord|email)$")
    config: dict[str, Any]
    min_severity: str = Field(default="HIGH")
    enabled: bool = True


class IntegrationUpdate(BaseModel):
    config: dict[str, Any] | None = None
    min_severity: str | None = None
    enabled: bool | None = None


class IntegrationResponse(BaseModel):
    id: str
    type: str
    enabled: bool
    min_severity: str
    config: dict[str, Any]  # secrets masked
    last_used_at: datetime | None
    last_error: str | None
    created_at: datetime


class RetentionResponse(BaseModel):
    organization_id: str
    raw_telemetry_days: int
    incident_days: int
    audit_days: int
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class RetentionUpdate(BaseModel):
    raw_telemetry_days: int | None = Field(default=None, ge=1, le=365)
    incident_days: int | None = Field(default=None, ge=1, le=3650)
    audit_days: int | None = Field(default=None, ge=1, le=3650)


class RoleUpdate(BaseModel):
    """RBAC role change body. Kept out of the URL so RBAC changes do not leak
    into proxy access logs."""

    role: str = Field(min_length=1, max_length=20)
