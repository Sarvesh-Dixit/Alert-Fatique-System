"""Shared FastAPI dependencies for authentication and tenant isolation."""
from __future__ import annotations

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rbac import Permission, require_permission
from app.core.security import decode_access_token
from app.database import get_db
from app.models.application import Application, ApplicationApiKey
from app.models.organization import OrganizationMember
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the dashboard user from a JWT bearer token."""
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing authorization header")
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = db.get(User, payload.get("sub"))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def require_org_member(
    organization_id: str,
    user: User,
    db: Session,
) -> OrganizationMember:
    """Assert the user belongs to the organization; return the membership.

    This is the core of tenant isolation — every org-scoped route funnels
    through here so a user can never touch another org's data.
    """
    membership = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user.id,
        )
    )
    if membership is None:
        # Audit every cross-tenant access attempt, then 404 (not 403) so we
        # don't leak the existence of other organizations.
        from app.core.audit import record_audit

        try:
            record_audit(
                db,
                action="tenant.access_denied",
                organization_id=organization_id,
                user_id=user.id,
                target_type="organization",
                target_id=organization_id,
                metadata={"reason": "not a member"},
                commit=True,
            )
        except Exception:  # noqa: BLE001 - never let auditing block the 404
            db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return membership


def require_org_permission(
    organization_id: str,
    user: User,
    db: Session,
    permission: Permission,
) -> OrganizationMember:
    """Assert org membership AND that the member's role grants ``permission``."""
    membership = require_org_member(organization_id, user, db)
    require_permission(membership.role, permission)
    return membership


def get_application_for_user(
    application_id: str,
    user: User,
    db: Session,
) -> Application:
    """Fetch an application, enforcing that the user is in its organization."""
    app_obj = db.get(Application, application_id)
    if app_obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    require_org_member(app_obj.organization_id, user, db)
    return app_obj


def authenticate_api_key(
    db: Session,
    authorization: str | None = None,
    x_api_key: str | None = None,
) -> ApplicationApiKey:
    """Authenticate an ingestion request via API key.

    Accepts either ``Authorization: Bearer <key>`` or ``X-API-Key: <key>``.
    Returns the active :class:`ApplicationApiKey` or raises 401/403.
    """
    from app.core.security import hash_api_key  # local import avoids cycle

    raw_key: str | None = None
    if x_api_key:
        raw_key = x_api_key.strip()
    elif authorization and authorization.lower().startswith("bearer "):
        raw_key = authorization[7:].strip()

    if not raw_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing API key")

    key = db.scalar(
        select(ApplicationApiKey).where(
            ApplicationApiKey.key_hash == hash_api_key(raw_key)
        )
    )
    if key is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")
    if not key.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "API key has been revoked")
    return key
