"""Application onboarding, per-application API keys, and application stats."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_application_for_user, get_current_user, require_org_member
from app.core.audit import record_audit
from app.core.security import generate_api_key, mask_api_key
from app.database import get_db
from app.models.application import Application, ApplicationApiKey
from app.models.telemetry import TelemetryEvent
from app.models.user import User
from app.schemas.application import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyResponse,
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStats,
)

router = APIRouter(tags=["applications"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _api_key_response(key: ApplicationApiKey) -> ApiKeyResponse:
    return ApiKeyResponse(
        id=key.id,
        application_id=key.application_id,
        name=key.name,
        masked_key=mask_api_key(key.key_prefix),
        environment_scope=key.environment_scope,
        last_used_at=key.last_used_at,
        revoked_at=key.revoked_at,
        created_at=key.created_at,
        is_active=key.is_active,
    )


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
@router.post(
    "/organizations/{organization_id}/applications",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_application(
    organization_id: str,
    payload: ApplicationCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    app_obj = Application(
        organization_id=organization_id,
        name=payload.name,
        environment=payload.environment,
        region=payload.region,
        description=payload.description,
    )
    db.add(app_obj)
    db.flush()
    record_audit(
        db,
        action="application.create",
        organization_id=organization_id,
        user_id=user.id,
        target_type="application",
        target_id=app_obj.id,
        ip_address=_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(app_obj)
    return app_obj


@router.get(
    "/organizations/{organization_id}/applications",
    response_model=list[ApplicationResponse],
)
def list_applications(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    return db.scalars(
        select(Application)
        .where(Application.organization_id == organization_id)
        .order_by(Application.created_at.desc())
    ).all()


@router.get("/applications/{application_id}", response_model=ApplicationResponse)
def get_application(
    application_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_application_for_user(application_id, user, db)


@router.get("/applications/{application_id}/stats", response_model=ApplicationStats)
def application_stats(
    application_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app_obj = get_application_for_user(application_id, user, db)
    now = datetime.now(timezone.utc)
    one_min_ago = now - timedelta(minutes=1)
    five_min_ago = now - timedelta(minutes=5)

    base = select(func.count()).select_from(TelemetryEvent).where(
        TelemetryEvent.application_id == app_obj.id
    )
    total = db.scalar(base) or 0
    errors = db.scalar(base.where(TelemetryEvent.severity.in_(["ERROR", "CRITICAL", "FATAL"]))) or 0
    warnings = db.scalar(base.where(TelemetryEvent.severity == "WARNING")) or 0
    last_minute = db.scalar(base.where(TelemetryEvent.received_at >= one_min_ago)) or 0
    recent = db.scalar(base.where(TelemetryEvent.received_at >= five_min_ago)) or 0

    return ApplicationStats(
        total_events=total,
        events_per_minute=float(last_minute),
        error_count=errors,
        warning_count=warnings,
        connected=recent > 0,
    )


# ---------------------------------------------------------------------------
# API keys (scoped per application)
# ---------------------------------------------------------------------------
@router.get(
    "/applications/{application_id}/api-keys",
    response_model=list[ApiKeyResponse],
)
def list_api_keys(
    application_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app_obj = get_application_for_user(application_id, user, db)
    keys = db.scalars(
        select(ApplicationApiKey)
        .where(ApplicationApiKey.application_id == app_obj.id)
        .order_by(ApplicationApiKey.created_at.desc())
    ).all()
    return [_api_key_response(k) for k in keys]


@router.post(
    "/applications/{application_id}/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_api_key(
    application_id: str,
    payload: ApiKeyCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app_obj = get_application_for_user(application_id, user, db)
    full_key, prefix, key_hash = generate_api_key()
    key = ApplicationApiKey(
        organization_id=app_obj.organization_id,
        application_id=app_obj.id,
        name=payload.name,
        key_prefix=prefix,
        key_hash=key_hash,
        environment_scope=payload.environment_scope,
    )
    db.add(key)
    db.flush()
    record_audit(
        db,
        action="apikey.create",
        organization_id=app_obj.organization_id,
        user_id=user.id,
        target_type="api_key",
        target_id=key.id,
        ip_address=_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(key)

    resp = _api_key_response(key)
    return ApiKeyCreatedResponse(**resp.model_dump(), api_key=full_key)


@router.post(
    "/applications/{application_id}/api-keys/{key_id}/revoke",
    response_model=ApiKeyResponse,
)
def revoke_api_key(
    application_id: str,
    key_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app_obj = get_application_for_user(application_id, user, db)
    key = db.get(ApplicationApiKey, key_id)
    if key is None or key.application_id != app_obj.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found")
    if key.revoked_at is None:
        key.revoked_at = datetime.now(timezone.utc)
    record_audit(
        db,
        action="apikey.revoke",
        organization_id=app_obj.organization_id,
        user_id=user.id,
        target_type="api_key",
        target_id=key.id,
        ip_address=_ip(request),
        commit=False,
    )
    db.commit()
    db.refresh(key)
    return _api_key_response(key)


@router.post(
    "/applications/{application_id}/api-keys/{key_id}/rotate",
    response_model=ApiKeyCreatedResponse,
)
def rotate_api_key(
    application_id: str,
    key_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke the old key and issue a fresh one carrying the same scope."""
    app_obj = get_application_for_user(application_id, user, db)
    old = db.get(ApplicationApiKey, key_id)
    if old is None or old.application_id != app_obj.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found")

    if old.revoked_at is None:
        old.revoked_at = datetime.now(timezone.utc)

    full_key, prefix, key_hash = generate_api_key()
    new_key = ApplicationApiKey(
        organization_id=app_obj.organization_id,
        application_id=app_obj.id,
        name=old.name,
        key_prefix=prefix,
        key_hash=key_hash,
        environment_scope=old.environment_scope,
        rotated_from=old.id,
    )
    db.add(new_key)
    db.flush()
    record_audit(
        db,
        action="apikey.rotate",
        organization_id=app_obj.organization_id,
        user_id=user.id,
        target_type="api_key",
        target_id=new_key.id,
        ip_address=_ip(request),
        metadata={"rotated_from": old.id},
        commit=False,
    )
    db.commit()
    db.refresh(new_key)

    resp = _api_key_response(new_key)
    return ApiKeyCreatedResponse(**resp.model_dump(), api_key=full_key)
