"""OS agent device lifecycle: register → enroll (issue credential) → operate.

Devices are backed by a scoped Application + API key so their OS telemetry
flows through the SAME gateway and intelligence engine as application telemetry.
The device credential can only ingest for its own backing application.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_org_member, require_org_permission
from app.core.audit import record_audit
from app.core.rbac import Permission
from app.core.security import generate_api_key, generate_enrollment_token
from app.database import get_db
from app.models.application import Application, ApplicationApiKey
from app.models.device import DEFAULT_AGENT_CONFIG, AgentDevice
from app.models.user import User
from app.schemas.device import (
    AgentConfigResponse,
    DeviceConfigUpdate,
    DeviceEnrolledResponse,
    DeviceEnrollRequest,
    DeviceHeartbeat,
    DeviceRegister,
    DeviceRegisteredResponse,
    DeviceResponse,
)

router = APIRouter(tags=["devices"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("/organizations/{organization_id}/devices", response_model=list[DeviceResponse])
def list_devices(
    organization_id: str,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    return db.scalars(
        select(AgentDevice)
        .where(AgentDevice.organization_id == organization_id)
        .order_by(AgentDevice.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()


@router.post(
    "/organizations/{organization_id}/devices",
    response_model=DeviceRegisteredResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_device(
    organization_id: str,
    payload: DeviceRegister,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_permission(organization_id, user, db, Permission.MANAGE_DEVICES)
    token, token_hash = generate_enrollment_token()
    config = {**DEFAULT_AGENT_CONFIG, **(payload.config or {})}
    device = AgentDevice(
        organization_id=organization_id,
        hostname=payload.hostname,
        operating_system=payload.operating_system,
        agent_version=payload.agent_version,
        region=payload.region,
        status="pending",
        enrollment_token_hash=token_hash,
        config=config,
    )
    db.add(device)
    db.flush()
    record_audit(
        db, action="device.register", organization_id=organization_id, user_id=user.id,
        target_type="device", target_id=device.id, ip_address=_ip(request), commit=False,
    )
    db.commit()
    db.refresh(device)
    return DeviceRegisteredResponse(
        **DeviceResponse.model_validate(device).model_dump(), enrollment_token=token
    )


@router.post("/devices/enroll", response_model=DeviceEnrolledResponse)
def enroll_device(payload: DeviceEnrollRequest, request: Request, db: Session = Depends(get_db)):
    """Agent-side: exchange the single-use enrollment token for a device credential.

    Creates the device's backing application + scoped API key and returns the
    credential exactly once. The enrollment token is consumed.
    """
    device = db.get(AgentDevice, payload.device_id)
    if device is None or device.enrollment_token_hash is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found or already enrolled")

    provided = hashlib.sha256(payload.enrollment_token.encode()).hexdigest()
    if provided != device.enrollment_token_hash:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid enrollment token")

    # Update identity from the agent's self-report.
    if payload.hostname:
        device.hostname = payload.hostname
    if payload.operating_system:
        device.operating_system = payload.operating_system
    if payload.os_version:
        device.os_version = payload.os_version
    if payload.agent_version:
        device.agent_version = payload.agent_version

    # Backing application for this device (source_type=agent flows through it).
    backing = Application(
        organization_id=device.organization_id,
        name=f"host:{device.hostname}",
        environment=device.region or "production",
        region=device.region,
        description=f"Auto-created backing application for device {device.id}",
    )
    db.add(backing)
    db.flush()

    full_key, prefix, key_hash = generate_api_key()
    api_key = ApplicationApiKey(
        organization_id=device.organization_id,
        application_id=backing.id,
        name=f"device:{device.hostname}",
        key_prefix=prefix,
        key_hash=key_hash,
        environment_scope=device.region or "production",
    )
    db.add(api_key)

    device.application_id = backing.id
    device.credential_prefix = prefix
    device.status = "enrolled"
    device.enrolled_at = datetime.now(timezone.utc)
    device.enrollment_token_hash = None  # single-use consumed

    record_audit(
        db, action="device.enrolled", organization_id=device.organization_id,
        target_type="device", target_id=device.id, ip_address=_ip(request), commit=False,
    )
    db.commit()
    db.refresh(device)
    return DeviceEnrolledResponse(
        **DeviceResponse.model_validate(device).model_dump(), device_credential=full_key
    )


@router.post("/devices/heartbeat", response_model=DeviceResponse)
def device_heartbeat(payload: DeviceHeartbeat, db: Session = Depends(get_db)):
    """Legacy heartbeat by device id (kept for backward compatibility)."""
    device = db.get(AgentDevice, payload.device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    device.last_heartbeat_at = datetime.now(timezone.utc)
    if payload.agent_version:
        device.agent_version = payload.agent_version
    if device.enrolled_at:
        device.status = "online"
    db.commit()
    db.refresh(device)
    return device


@router.put("/organizations/{organization_id}/devices/{device_id}/config", response_model=DeviceResponse)
def update_device_config(
    organization_id: str,
    device_id: str,
    payload: DeviceConfigUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_permission(organization_id, user, db, Permission.MANAGE_DEVICES)
    device = db.get(AgentDevice, device_id)
    if device is None or device.organization_id != organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    device.config = {**DEFAULT_AGENT_CONFIG, **device.config, **payload.config}
    record_audit(
        db, action="device.config_changed", organization_id=organization_id, user_id=user.id,
        target_type="device", target_id=device.id, ip_address=_ip(request), commit=False,
    )
    db.commit()
    db.refresh(device)
    return device


@router.delete("/organizations/{organization_id}/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_device(
    organization_id: str,
    device_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_permission(organization_id, user, db, Permission.MANAGE_DEVICES)
    device = db.get(AgentDevice, device_id)
    if device is None or device.organization_id != organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    # Revoke the device credential (do not delete telemetry history).
    if device.application_id:
        for key in db.scalars(
            select(ApplicationApiKey).where(ApplicationApiKey.application_id == device.application_id)
        ).all():
            if key.revoked_at is None:
                key.revoked_at = datetime.now(timezone.utc)
    device.status = "revoked"
    record_audit(
        db, action="device.removed", organization_id=organization_id, user_id=user.id,
        target_type="device", target_id=device.id, ip_address=_ip(request), commit=False,
    )
    db.commit()
