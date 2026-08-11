"""Role-based access control (RBAC).

Roles (highest → lowest privilege):

    OWNER    — all organization operations, including role management + delete
    ADMIN    — applications, devices, API keys, alert config, integrations
    ENGINEER — telemetry + incidents (acknowledge / resolve)
    VIEWER   — read-only dashboard

Permissions are enforced server-side. Legacy Phase-1 role strings
(``owner``/``admin``/``member``) are mapped forward for backward compatibility.
"""
from __future__ import annotations

from enum import Enum

from fastapi import HTTPException, status


class Role(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    ENGINEER = "ENGINEER"
    VIEWER = "VIEWER"


# Ordered by privilege (index = rank).
_RANK = {Role.VIEWER: 0, Role.ENGINEER: 1, Role.ADMIN: 2, Role.OWNER: 3}

# Backward-compatible mapping from legacy role strings.
_LEGACY = {
    "owner": Role.OWNER,
    "admin": Role.ADMIN,
    "member": Role.ENGINEER,
    "engineer": Role.ENGINEER,
    "viewer": Role.VIEWER,
}


class Permission(str, Enum):
    # read
    VIEW = "view"
    # engineer
    MANAGE_INCIDENTS = "manage_incidents"
    SEND_TELEMETRY = "send_telemetry"
    # admin
    MANAGE_APPLICATIONS = "manage_applications"
    MANAGE_DEVICES = "manage_devices"
    MANAGE_API_KEYS = "manage_api_keys"
    MANAGE_INTEGRATIONS = "manage_integrations"
    MANAGE_ALERT_CONFIG = "manage_alert_config"
    # owner
    MANAGE_MEMBERS = "manage_members"
    MANAGE_RETENTION = "manage_retention"
    MANAGE_ORGANIZATION = "manage_organization"


# Minimum role required for each permission.
_MIN_ROLE: dict[Permission, Role] = {
    Permission.VIEW: Role.VIEWER,
    Permission.MANAGE_INCIDENTS: Role.ENGINEER,
    Permission.SEND_TELEMETRY: Role.ENGINEER,
    Permission.MANAGE_APPLICATIONS: Role.ADMIN,
    Permission.MANAGE_DEVICES: Role.ADMIN,
    Permission.MANAGE_API_KEYS: Role.ADMIN,
    Permission.MANAGE_INTEGRATIONS: Role.ADMIN,
    Permission.MANAGE_ALERT_CONFIG: Role.ADMIN,
    Permission.MANAGE_MEMBERS: Role.OWNER,
    Permission.MANAGE_RETENTION: Role.OWNER,
    Permission.MANAGE_ORGANIZATION: Role.OWNER,
}


def normalize_role(raw: str | None) -> Role:
    if not raw:
        return Role.VIEWER
    try:
        return Role(raw.upper())
    except ValueError:
        return _LEGACY.get(raw.lower(), Role.VIEWER)


def role_rank(raw: str | None) -> int:
    return _RANK[normalize_role(raw)]


def has_permission(raw_role: str | None, permission: Permission) -> bool:
    return role_rank(raw_role) >= _RANK[_MIN_ROLE[permission]]


def require_permission(raw_role: str | None, permission: Permission) -> None:
    """Raise 403 if the role lacks the permission."""
    if not has_permission(raw_role, permission):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Requires role {_MIN_ROLE[permission].value} or higher for '{permission.value}'",
        )
