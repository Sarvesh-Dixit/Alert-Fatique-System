"""Organization admin: notification integrations, retention, and members/RBAC."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_org_member, require_org_permission
from app.core.audit import record_audit
from app.core.rbac import Permission, normalize_role
from app.core.retention import get_policy, purge_organization
from app.database import get_db
from app.models.integration import Integration, RetentionPolicy
from app.models.organization import OrganizationMember
from app.models.user import User
from app.notifications.providers import known_types
from app.notifications.service import send_test
from app.schemas.integration import (
    IntegrationCreate,
    IntegrationResponse,
    IntegrationUpdate,
    RetentionResponse,
    RetentionUpdate,
    RoleUpdate,
)

router = APIRouter(prefix="/organizations/{organization_id}", tags=["admin"])

_SECRET_KEYS = {"webhook_url", "password", "token", "smtp_password"}


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _mask_config(config: dict) -> dict:
    """Mask secret-bearing config values before returning to the dashboard.

    Webhook URLs reveal only their scheme+host (never the secret token/path);
    other secrets collapse to a placeholder.
    """
    out = {}
    for k, v in (config or {}).items():
        if k == "webhook_url" and isinstance(v, str) and v:
            from urllib.parse import urlparse

            parsed = urlparse(v)
            host = parsed.netloc or "webhook"
            out[k] = f"{parsed.scheme}://{host}/•••"
        elif k in _SECRET_KEYS and isinstance(v, str) and v:
            out[k] = "•••"
        else:
            out[k] = v
    return out


def _to_response(i: Integration) -> IntegrationResponse:
    return IntegrationResponse(
        id=i.id, type=i.type, enabled=i.enabled, min_severity=i.min_severity,
        config=_mask_config(i.config), last_used_at=i.last_used_at,
        last_error=i.last_error, created_at=i.created_at,
    )


# ----------------------------------------------------------- integrations
@router.get("/integrations", response_model=list[IntegrationResponse])
def list_integrations(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    rows = db.scalars(
        select(Integration).where(Integration.organization_id == organization_id)
    ).all()
    return [_to_response(i) for i in rows]


@router.put("/integrations", response_model=IntegrationResponse)
def upsert_integration(
    organization_id: str,
    payload: IntegrationCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update the org's integration of a given type (one per type)."""
    require_org_permission(organization_id, user, db, Permission.MANAGE_INTEGRATIONS)
    if payload.type not in known_types():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown integration type")

    integration = db.scalar(
        select(Integration).where(
            Integration.organization_id == organization_id, Integration.type == payload.type
        )
    )
    created = integration is None
    if integration is None:
        integration = Integration(organization_id=organization_id, type=payload.type)
        db.add(integration)
    integration.config = payload.config
    integration.min_severity = payload.min_severity.upper()
    integration.enabled = payload.enabled
    integration.last_error = None

    record_audit(
        db, action="integration.upserted", organization_id=organization_id, user_id=user.id,
        target_type="integration", target_id=payload.type,
        metadata={"created": created, "min_severity": integration.min_severity},
        ip_address=_ip(request), commit=False,
    )
    db.commit()
    db.refresh(integration)
    return _to_response(integration)


@router.post("/integrations/{integration_type}/test")
def test_integration(
    organization_id: str,
    integration_type: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_permission(organization_id, user, db, Permission.MANAGE_INTEGRATIONS)
    integration = db.scalar(
        select(Integration).where(
            Integration.organization_id == organization_id, Integration.type == integration_type
        )
    )
    if integration is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Integration not configured")
    try:
        send_test(db, integration)
        db.commit()
        return {"ok": True, "message": f"Test notification sent via {integration_type}"}
    except Exception as exc:  # noqa: BLE001
        integration.last_error = str(exc)[:500]
        db.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Provider error: {exc}")


@router.delete("/integrations/{integration_type}", status_code=status.HTTP_204_NO_CONTENT)
def delete_integration(
    organization_id: str,
    integration_type: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_permission(organization_id, user, db, Permission.MANAGE_INTEGRATIONS)
    integration = db.scalar(
        select(Integration).where(
            Integration.organization_id == organization_id, Integration.type == integration_type
        )
    )
    if integration is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Integration not configured")
    db.delete(integration)
    record_audit(
        db, action="integration.deleted", organization_id=organization_id, user_id=user.id,
        target_type="integration", target_id=integration_type, ip_address=_ip(request), commit=False,
    )
    db.commit()


# ------------------------------------------------------------- retention
@router.get("/retention", response_model=RetentionResponse)
def get_retention(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    return get_policy(db, organization_id)


@router.put("/retention", response_model=RetentionResponse)
def update_retention(
    organization_id: str,
    payload: RetentionUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_permission(organization_id, user, db, Permission.MANAGE_RETENTION)
    policy = get_policy(db, organization_id)
    if payload.raw_telemetry_days is not None:
        policy.raw_telemetry_days = payload.raw_telemetry_days
    if payload.incident_days is not None:
        policy.incident_days = payload.incident_days
    if payload.audit_days is not None:
        policy.audit_days = payload.audit_days
    record_audit(
        db, action="retention.changed", organization_id=organization_id, user_id=user.id,
        target_type="retention", target_id=organization_id,
        metadata={"raw_days": policy.raw_telemetry_days, "incident_days": policy.incident_days,
                  "audit_days": policy.audit_days},
        ip_address=_ip(request), commit=False,
    )
    db.commit()
    db.refresh(policy)
    return policy


@router.post("/retention/purge")
def run_retention_purge(
    organization_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_permission(organization_id, user, db, Permission.MANAGE_RETENTION)
    result = purge_organization(db, organization_id)
    record_audit(
        db, action="retention.purged", organization_id=organization_id, user_id=user.id,
        target_type="retention", target_id=organization_id, metadata=result, ip_address=_ip(request),
    )
    return result


# --------------------------------------------------------------- members
@router.get("/members")
def list_members(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    rows = db.scalars(
        select(OrganizationMember).where(OrganizationMember.organization_id == organization_id)
    ).all()
    out = []
    for m in rows:
        u = db.get(User, m.user_id)
        out.append({
            "user_id": m.user_id,
            "email": u.email if u else None,
            "full_name": u.full_name if u else None,
            "role": normalize_role(m.role).value,
        })
    return out


@router.post("/members/{target_user_id}/role")
def change_member_role(
    organization_id: str,
    target_user_id: str,
    payload: RoleUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_permission(organization_id, user, db, Permission.MANAGE_MEMBERS)
    new_role = normalize_role(payload.role).value
    membership = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == target_user_id,
        )
    )
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    old_role = membership.role
    membership.role = new_role
    record_audit(
        db, action="member.role_changed", organization_id=organization_id, user_id=user.id,
        target_type="user", target_id=target_user_id,
        metadata={"from": old_role, "to": new_role}, ip_address=_ip(request), commit=False,
    )
    db.commit()
    return {"user_id": target_user_id, "role": new_role}


@router.get("/audit-logs")
def list_audit_logs(
    organization_id: str,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.audit import AuditLog

    require_org_permission(organization_id, user, db, Permission.MANAGE_ORGANIZATION)
    rows = db.scalars(
        select(AuditLog)
        .where(AuditLog.organization_id == organization_id)
        .order_by(AuditLog.created_at.desc())
        .limit(min(limit, 500))
    ).all()
    return [
        {
            "id": a.id, "action": a.action, "actor": a.user_id,
            "target_type": a.target_type, "target_id": a.target_id,
            "ip_address": a.ip_address, "metadata": a.event_metadata,
            "created_at": a.created_at,
        }
        for a in rows
    ]
