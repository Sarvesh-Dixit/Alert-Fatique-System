"""Telemetry Explorer — searchable, filterable event query for the dashboard.

Read path only. Always scoped to an organization the user belongs to, which
guarantees tenant isolation on reads.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_org_member
from app.database import get_db
from app.models.telemetry import TelemetryEvent
from app.models.user import User
from app.schemas.telemetry import TelemetryEventResponse

router = APIRouter(prefix="/organizations/{organization_id}/telemetry", tags=["telemetry-explorer"])


@router.get("", response_model=list[TelemetryEventResponse])
def query_telemetry(
    organization_id: str,
    application_id: str | None = None,
    service: str | None = None,
    environment: str | None = None,
    severity: str | None = None,
    event_type: str | None = None,
    region: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    search: str | None = Query(default=None, description="Substring match on message"),
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)

    stmt = select(TelemetryEvent).where(TelemetryEvent.organization_id == organization_id)
    if application_id:
        stmt = stmt.where(TelemetryEvent.application_id == application_id)
    if service:
        stmt = stmt.where(TelemetryEvent.service == service)
    if environment:
        stmt = stmt.where(TelemetryEvent.environment == environment)
    if severity:
        stmt = stmt.where(TelemetryEvent.severity == severity.upper())
    if event_type:
        stmt = stmt.where(TelemetryEvent.event_type == event_type)
    if region:
        stmt = stmt.where(TelemetryEvent.region == region)
    if start:
        stmt = stmt.where(TelemetryEvent.timestamp >= start)
    if end:
        stmt = stmt.where(TelemetryEvent.timestamp <= end)
    if search:
        stmt = stmt.where(TelemetryEvent.message.ilike(f"%{search}%"))

    stmt = stmt.order_by(TelemetryEvent.timestamp.desc()).limit(limit).offset(offset)
    rows = db.scalars(stmt).all()
    return [TelemetryEventResponse.from_model(r) for r in rows]
