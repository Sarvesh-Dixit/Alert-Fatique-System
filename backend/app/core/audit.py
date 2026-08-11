"""Helper for recording audit log entries."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def record_audit(
    db: Session,
    *,
    action: str,
    organization_id: str | None = None,
    user_id: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    ip_address: str | None = None,
    metadata: dict | None = None,
    commit: bool = True,
) -> AuditLog:
    entry = AuditLog(
        action=action,
        organization_id=organization_id,
        user_id=user_id,
        target_type=target_type,
        target_id=target_id,
        ip_address=ip_address,
        event_metadata=metadata or {},
    )
    db.add(entry)
    if commit:
        db.commit()
    return entry
