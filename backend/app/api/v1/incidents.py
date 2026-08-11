"""Incident, error-group, KPI, and real-time (SSE) endpoints (Phase 2)."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_org_member
from app.core import realtime
from app.core.security import decode_access_token
from app.database import get_db
from app.intelligence import notifications
from app.models.incident import (
    ErrorGroup,
    Incident,
    IncidentTimelineEntry,
    NotificationLog,
)
from app.models.telemetry import TelemetryEvent
from app.models.user import User
from app.schemas.incident import (
    ErrorGroupSummary,
    IncidentDetail,
    IncidentStatusUpdate,
    IncidentSummary,
    NoiseReductionKPIs,
    NotificationEntry,
    TimelineEntry,
)
from app.schemas.telemetry import TelemetryEventResponse

router = APIRouter(prefix="/organizations/{organization_id}", tags=["incidents"])

_VALID_STATUSES = {"OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"}


# ---------------------------------------------------------------- incidents
@router.get("/incidents", response_model=list[IncidentSummary])
def list_incidents(
    organization_id: str,
    status_filter: str | None = Query(default=None, alias="status"),
    severity: str | None = None,
    application_id: str | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    stmt = select(Incident).where(Incident.organization_id == organization_id)
    if status_filter:
        stmt = stmt.where(Incident.status == status_filter.upper())
    if severity:
        stmt = stmt.where(Incident.severity == severity.upper())
    if application_id:
        stmt = stmt.where(Incident.application_id == application_id)
    stmt = stmt.order_by(Incident.last_seen.desc()).limit(limit).offset(offset)
    return db.scalars(stmt).all()


@router.get("/incidents/{incident_id}", response_model=IncidentDetail)
def get_incident(
    organization_id: str,
    incident_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    incident = db.get(Incident, incident_id)
    if incident is None or incident.organization_id != organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")

    timeline = db.scalars(
        select(IncidentTimelineEntry)
        .where(IncidentTimelineEntry.incident_id == incident_id)
        .order_by(IncidentTimelineEntry.created_at.asc())
    ).all()
    notifs = db.scalars(
        select(NotificationLog)
        .where(NotificationLog.incident_id == incident_id)
        .order_by(NotificationLog.created_at.asc())
    ).all()

    detail = IncidentDetail(
        **IncidentSummary.model_validate(incident).model_dump(),
        timeline=[TimelineEntry.from_model(t) for t in timeline],
        notifications=[NotificationEntry.model_validate(n) for n in notifs],
    )
    return detail


@router.get("/incidents/{incident_id}/events", response_model=list[TelemetryEventResponse])
def incident_events(
    organization_id: str,
    incident_id: str,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Drill from incident -> underlying raw (sanitized) telemetry."""
    require_org_member(organization_id, user, db)
    incident = db.get(Incident, incident_id)
    if incident is None or incident.organization_id != organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    rows = db.scalars(
        select(TelemetryEvent)
        .where(TelemetryEvent.incident_id == incident_id)
        .order_by(TelemetryEvent.timestamp.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [TelemetryEventResponse.from_model(r) for r in rows]


@router.post("/incidents/{incident_id}/status", response_model=IncidentSummary)
def update_incident_status(
    organization_id: str,
    incident_id: str,
    payload: IncidentStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    incident = db.get(Incident, incident_id)
    if incident is None or incident.organization_id != organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")

    new_status = payload.status.upper()
    if new_status not in _VALID_STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid status")

    now = datetime.now(timezone.utc)
    incident.status = new_status
    kind_map = {
        "ACKNOWLEDGED": ("acknowledged", "Incident acknowledged"),
        "RESOLVED": ("resolved", "Incident resolved"),
        "CLOSED": ("closed", "Incident closed"),
        "OPEN": ("reopened", "Incident reopened"),
    }
    tl_kind, tl_msg = kind_map[new_status]
    if new_status == "ACKNOWLEDGED":
        incident.acknowledged_at = now
    elif new_status == "RESOLVED":
        incident.resolved_at = now
        notifications.send_notification(db, incident, kind="resolved",
                                        reason="incident resolved", now=now)
    elif new_status == "CLOSED":
        incident.closed_at = now

    db.add(IncidentTimelineEntry(incident_id=incident.id, kind=tl_kind, message=tl_msg, created_at=now))
    db.commit()
    db.refresh(incident)
    realtime.publish(organization_id, "incident_status", {"incident_id": incident.id, "status": new_status})
    return incident


# ------------------------------------------------------------- error groups
@router.get("/error-groups", response_model=list[ErrorGroupSummary])
def list_error_groups(
    organization_id: str,
    application_id: str | None = None,
    incident_id: str | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    stmt = select(ErrorGroup).where(ErrorGroup.organization_id == organization_id)
    if application_id:
        stmt = stmt.where(ErrorGroup.application_id == application_id)
    if incident_id:
        stmt = stmt.where(ErrorGroup.incident_id == incident_id)
    stmt = stmt.order_by(ErrorGroup.last_seen.desc()).limit(limit).offset(offset)
    return db.scalars(stmt).all()


@router.get("/error-groups/{group_id}/events", response_model=list[TelemetryEventResponse])
def error_group_events(
    organization_id: str,
    group_id: str,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Drill from error group -> underlying raw telemetry (same fingerprint)."""
    require_org_member(organization_id, user, db)
    group = db.get(ErrorGroup, group_id)
    if group is None or group.organization_id != organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Error group not found")
    rows = db.scalars(
        select(TelemetryEvent)
        .where(
            TelemetryEvent.organization_id == organization_id,
            TelemetryEvent.application_id == group.application_id,
            TelemetryEvent.fingerprint == group.fingerprint,
        )
        .order_by(TelemetryEvent.timestamp.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [TelemetryEventResponse.from_model(r) for r in rows]


# --------------------------------------------------------------------- KPIs
@router.get("/kpis", response_model=NoiseReductionKPIs)
def noise_reduction_kpis(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)

    events_received = db.scalar(
        select(func.count()).select_from(TelemetryEvent).where(
            TelemetryEvent.organization_id == organization_id
        )
    ) or 0
    total_groups = db.scalar(
        select(func.count()).select_from(ErrorGroup).where(
            ErrorGroup.organization_id == organization_id
        )
    ) or 0
    grouped = db.scalar(
        select(func.coalesce(func.sum(ErrorGroup.event_count), 0)).where(
            ErrorGroup.organization_id == organization_id
        )
    ) or 0
    suppressed = db.scalar(
        select(func.coalesce(func.sum(Incident.events_suppressed), 0)).where(
            Incident.organization_id == organization_id
        )
    ) or 0
    notifications_sent = db.scalar(
        select(func.coalesce(func.sum(Incident.notifications_sent), 0)).where(
            Incident.organization_id == organization_id
        )
    ) or 0
    total_incidents = db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.organization_id == organization_id
        )
    ) or 0
    active_incidents = db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.organization_id == organization_id,
            Incident.status.in_(["OPEN", "ACKNOWLEDGED"]),
        )
    ) or 0

    # Naive systems notify once per event routed to an incident.
    naive = db.scalar(
        select(func.coalesce(func.sum(Incident.event_count), 0)).where(
            Incident.organization_id == organization_id
        )
    ) or 0
    ratio = round(max(0.0, 1.0 - (notifications_sent / naive)) * 100.0, 2) if naive else 0.0

    return NoiseReductionKPIs(
        events_received=int(events_received),
        events_grouped=int(grouped),
        events_suppressed=int(suppressed),
        notifications_sent=int(notifications_sent),
        naive_notifications=int(naive),
        noise_reduction_ratio=ratio,
        active_incidents=int(active_incidents),
        total_incidents=int(total_incidents),
        total_groups=int(total_groups),
    )


# ----------------------------------------------------------- realtime (SSE)
def _authorize_stream(token: str | None, organization_id: str, db: Session) -> None:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.get(User, payload.get("sub"))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    require_org_member(organization_id, user, db)


@router.get("/stream")
async def incident_stream(
    organization_id: str,
    request: Request,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Server-Sent Events stream of incident/notification updates for an org.

    EventSource cannot set headers, so the JWT is passed as ``?token=``.
    """
    _authorize_stream(token, organization_id, db)
    from app.core.redis_client import get_redis

    async def event_generator():
        pubsub = get_redis().pubsub()
        pubsub.subscribe(realtime.channel_for(organization_id))
        try:
            yield ": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                msg = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg.get("type") == "message":
                    yield f"data: {msg['data']}\n\n"
                else:
                    yield ": keep-alive\n\n"
                await asyncio.sleep(0.2)
        finally:
            pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
