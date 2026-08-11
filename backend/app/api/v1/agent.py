"""Agent-facing endpoints, authenticated by the device credential only.

Least privilege: the agent never holds a user JWT. It uses its scoped device
credential (an application API key for its backing app) to fetch its policy and
send heartbeats. Telemetry itself uses the existing ``/telemetry`` endpoints.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import authenticate_api_key
from app.database import get_db
from app.models.application import ApplicationApiKey
from app.models.device import AgentDevice
from app.schemas.device import AgentConfigResponse, AgentHeartbeat

router = APIRouter(prefix="/agent", tags=["agent"])


def _device_for_key(db: Session, key: ApplicationApiKey) -> AgentDevice:
    device = db.scalar(
        select(AgentDevice).where(AgentDevice.application_id == key.application_id)
    )
    if device is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Credential is not a device credential")
    return device


@router.get("/config", response_model=AgentConfigResponse)
def get_agent_config(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    key = authenticate_api_key(db, authorization=authorization, x_api_key=x_api_key)
    device = _device_for_key(db, key)
    return AgentConfigResponse(
        device_id=device.id,
        organization_id=device.organization_id,
        hostname=device.hostname,
        region=device.region,
        config=device.config,
    )


@router.post("/heartbeat", response_model=AgentConfigResponse)
def agent_heartbeat(
    payload: AgentHeartbeat,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    key = authenticate_api_key(db, authorization=authorization, x_api_key=x_api_key)
    device = _device_for_key(db, key)
    device.last_heartbeat_at = datetime.now(timezone.utc)
    device.status = "online"
    if payload.agent_version:
        device.agent_version = payload.agent_version
    if payload.os_version:
        device.os_version = payload.os_version
    db.commit()
    return AgentConfigResponse(
        device_id=device.id,
        organization_id=device.organization_id,
        hostname=device.hostname,
        region=device.region,
        config=device.config,
    )
