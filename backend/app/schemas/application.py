from datetime import datetime

from pydantic import BaseModel, Field


class ApplicationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    environment: str = Field(default="production", max_length=60)
    region: str | None = Field(default=None, max_length=60)
    description: str | None = None


class ApplicationResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    environment: str
    region: str | None
    description: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationStats(BaseModel):
    total_events: int
    events_per_minute: float
    error_count: int
    warning_count: int
    connected: bool


# ---- API keys ----
class ApiKeyCreate(BaseModel):
    name: str = Field(default="default", max_length=120)
    environment_scope: str = Field(default="production", max_length=60)


class ApiKeyResponse(BaseModel):
    id: str
    application_id: str
    name: str
    masked_key: str
    environment_scope: str
    last_used_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class ApiKeyCreatedResponse(ApiKeyResponse):
    """Returned only at creation/rotation — includes the plaintext key ONCE."""

    api_key: str
