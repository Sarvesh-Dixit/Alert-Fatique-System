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
from fastapi.concurrency import run_in_threadpool
from app.schemas.incident import (
    ErrorGroupSummary,
    IncidentDetail,
    IncidentStatusUpdate,
    IncidentSummary,
    NoiseReductionKPIs,
    NotificationEntry,
    TimelineEntry,
    CooldownState,
    DashboardFeedResponse,
)
from app.schemas.telemetry import TelemetryEventResponse

router = APIRouter(prefix="/organizations/{organization_id}", tags=["incidents"])

_VALID_STATUSES = {"OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"}


# ---------------------------------------------------------------- incidents
@router.get("/incidents", response_model=list[IncidentSummary])
async def list_incidents(
    organization_id: str,
    status_filter: str | None = Query(default=None, alias="status"),
    severity: str | None = None,
    application_id: str | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    def _query():
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

    return await run_in_threadpool(_query)


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
async def noise_reduction_kpis(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    def _query():
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
            total_events=int(events_received),
            actionable_incidents=int(active_incidents),
            suppressed_events=int(suppressed),
        )

    return await run_in_threadpool(_query)


@router.get("/cooldown-matrix", response_model=list[CooldownState])
async def get_cooldown_matrix(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    def _query():
        require_org_member(organization_id, user, db)

        # Active suppression matrix: open incidents with last_notified_at set.
        stmt = select(Incident).where(
            Incident.organization_id == organization_id,
            Incident.status == "OPEN",
            Incident.last_notified_at.is_not(None)
        )
        incidents = db.scalars(stmt).all()

        from app.config import settings
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        cooldowns = []
        for inc in incidents:
            last_notified = inc.last_notified_at
            if last_notified.tzinfo is None:
                last_notified = last_notified.replace(tzinfo=timezone.utc)

            cooldown_sec = settings.cooldown_for(inc.severity)
            elapsed = (now - last_notified).total_seconds()
            remaining = max(0, int(cooldown_sec - elapsed))
            expiry = datetime.fromtimestamp(last_notified.timestamp() + cooldown_sec, tz=timezone.utc)

            status_str = "ACTIVE_SUPPRESSION" if remaining > 0 else "COOLDOWN_EXPIRED"

            app_name = inc.affected_applications[0] if (inc.affected_applications and len(inc.affected_applications) > 0) else "Unknown"

            cooldowns.append(
                CooldownState(
                    incident_id=inc.id,
                    service=inc.service or "global",
                    application_name=app_name,
                    title=inc.title,
                    trigger_time=last_notified,
                    expiry_time=expiry,
                    remaining_seconds=remaining,
                    severity=inc.severity,
                    suppressed_count=inc.events_suppressed,
                    status=status_str,
                )
            )

        return cooldowns

    return await run_in_threadpool(_query)


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

    channel = realtime.channel_for(organization_id)

    async def event_generator():
        pubsub = get_redis().pubsub()
        # subscribe() is synchronous — run it in a thread so we never block
        # the event loop even briefly.
        await asyncio.to_thread(pubsub.subscribe, channel)
        try:
            yield ": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                # get_message with a timeout is a synchronous blocking call in
                # redis-py; offloading it keeps the asyncio loop responsive for
                # every other SSE client and API request.
                msg = await asyncio.to_thread(
                    pubsub.get_message, ignore_subscribe_messages=True, timeout=1.0
                )
                if msg and msg.get("type") == "message":
                    yield f"data: {msg['data']}\n\n"
                else:
                    yield ": keep-alive\n\n"
                await asyncio.sleep(0.2)
        finally:
            # Cleanly release the server-side subscription before closing.
            try:
                await asyncio.to_thread(pubsub.unsubscribe, channel)
            except Exception:  # noqa: BLE001
                pass
            try:
                await asyncio.to_thread(pubsub.close)
            except Exception:  # noqa: BLE001
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _fetch_all_dashboard_data(organization_id: str, db: Session):
    # 1. Fetch KPIs
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

    naive = db.scalar(
        select(func.coalesce(func.sum(Incident.event_count), 0)).where(
            Incident.organization_id == organization_id
        )
    ) or 0
    ratio = round(max(0.0, 1.0 - (notifications_sent / naive)) * 100.0, 2) if naive else 0.0

    kpis = NoiseReductionKPIs(
        events_received=int(events_received),
        events_grouped=int(grouped),
        events_suppressed=int(suppressed),
        notifications_sent=int(notifications_sent),
        naive_notifications=int(naive),
        noise_reduction_ratio=ratio,
        active_incidents=int(active_incidents),
        total_incidents=int(total_incidents),
        total_groups=int(total_groups),
        total_events=int(events_received),
        actionable_incidents=int(active_incidents),
        suppressed_events=int(suppressed),
    )

    # 2. Fetch Cooldown Matrix
    stmt = select(Incident).where(
        Incident.organization_id == organization_id,
        Incident.status == "OPEN",
        Incident.last_notified_at.is_not(None)
    )
    cooldown_incidents = db.scalars(stmt).all()

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    cooldowns = []
    for inc in cooldown_incidents:
        last_notified = inc.last_notified_at
        if last_notified.tzinfo is None:
            last_notified = last_notified.replace(tzinfo=timezone.utc)

        cooldown_sec = settings.cooldown_for(inc.severity)
        elapsed = (now - last_notified).total_seconds()
        remaining = max(0, int(cooldown_sec - elapsed))
        expiry = datetime.fromtimestamp(last_notified.timestamp() + cooldown_sec, tz=timezone.utc)

        status_str = "ACTIVE_SUPPRESSION" if remaining > 0 else "COOLDOWN_EXPIRED"

        app_name = inc.affected_applications[0] if (inc.affected_applications and len(inc.affected_applications) > 0) else "Unknown"

        cooldowns.append(
            CooldownState(
                incident_id=inc.id,
                service=inc.service or "global",
                application_name=app_name,
                title=inc.title,
                trigger_time=last_notified,
                expiry_time=expiry,
                remaining_seconds=remaining,
                severity=inc.severity,
                suppressed_count=inc.events_suppressed,
                status=status_str,
            )
        )

    # 3. Fetch Incidents (limit = 8)
    stmt_inc = (
        select(Incident)
        .where(Incident.organization_id == organization_id, Incident.status == "OPEN")
        .order_by(Incident.last_seen.desc())
        .limit(8)
    )
    incidents = db.scalars(stmt_inc).all()
    incidents_serialized = [IncidentSummary.model_validate(i) for i in incidents]

    # 4. Fetch Applications
    from app.models.application import Application
    from app.schemas.application import ApplicationResponse
    apps = db.scalars(
        select(Application)
        .where(Application.organization_id == organization_id)
        .order_by(Application.created_at.desc())
    ).all()
    applications = [ApplicationResponse.model_validate(a) for a in apps]

    return {
        "kpis": kpis,
        "cooldown_matrix": cooldowns,
        "incidents": incidents_serialized,
        "applications": applications
    }


@router.get("/dashboard-feed", response_model=DashboardFeedResponse)
async def get_dashboard_feed(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetches KPIs, active incidents, cooldown matrix, and apps in a SINGLE query pass."""
    def _query():
        require_org_member(organization_id, user, db)
        return _fetch_all_dashboard_data(organization_id, db)

    return await run_in_threadpool(_query)
