"""Executive analytics, security dashboard, and platform self-observability."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_org_member
from app.config import settings
from app.core import metrics
from app.database import get_db
from app.models.application import Application, ApplicationApiKey
from app.models.audit import AuditLog
from app.models.device import AgentDevice
from app.models.incident import ErrorGroup, Incident
from app.models.telemetry import TelemetryEvent
from app.models.user import User

router = APIRouter(tags=["analytics"])


def _aware(dt):
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# --------------------------------------------------------- executive analytics
@router.get("/organizations/{organization_id}/analytics/executive")
def executive_analytics(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    org = organization_id

    total_events = db.scalar(
        select(func.count()).select_from(TelemetryEvent).where(TelemetryEvent.organization_id == org)
    ) or 0
    total_incidents = db.scalar(
        select(func.count()).select_from(Incident).where(Incident.organization_id == org)
    ) or 0
    active_incidents = db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.organization_id == org, Incident.status.in_(["OPEN", "ACKNOWLEDGED"])
        )
    ) or 0
    critical_incidents = db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.organization_id == org, Incident.severity == "CRITICAL",
            Incident.status.in_(["OPEN", "ACKNOWLEDGED"])
        )
    ) or 0
    suppressed = db.scalar(
        select(func.coalesce(func.sum(Incident.events_suppressed), 0)).where(Incident.organization_id == org)
    ) or 0
    notifications = db.scalar(
        select(func.coalesce(func.sum(Incident.notifications_sent), 0)).where(Incident.organization_id == org)
    ) or 0
    naive = db.scalar(
        select(func.coalesce(func.sum(Incident.event_count), 0)).where(Incident.organization_id == org)
    ) or 0
    noise_reduction = round(max(0.0, 1.0 - (notifications / naive)) * 100.0, 2) if naive else 0.0

    # Average incident duration (resolved incidents), in minutes.
    durations = db.execute(
        select(Incident.first_seen, Incident.resolved_at).where(
            Incident.organization_id == org, Incident.resolved_at.isnot(None)
        )
    ).all()
    avg_minutes = 0.0
    if durations:
        secs = [
            (_aware(r) - _aware(f)).total_seconds()
            for f, r in durations if f and r
        ]
        secs = [s for s in secs if s >= 0]
        if secs:
            avg_minutes = round(sum(secs) / len(secs) / 60.0, 1)

    top_services = db.execute(
        select(ErrorGroup.service, func.sum(ErrorGroup.event_count).label("c"))
        .where(ErrorGroup.organization_id == org)
        .group_by(ErrorGroup.service).order_by(func.sum(ErrorGroup.event_count).desc()).limit(5)
    ).all()
    top_fingerprints = db.execute(
        select(ErrorGroup.title, ErrorGroup.fingerprint, func.sum(ErrorGroup.event_count).label("c"))
        .where(ErrorGroup.organization_id == org)
        .group_by(ErrorGroup.title, ErrorGroup.fingerprint)
        .order_by(func.sum(ErrorGroup.event_count).desc()).limit(5)
    ).all()
    top_apps = db.execute(
        select(Application.name, func.count(TelemetryEvent.id).label("c"))
        .join(TelemetryEvent, TelemetryEvent.application_id == Application.id)
        .where(TelemetryEvent.organization_id == org)
        .group_by(Application.name).order_by(func.count(TelemetryEvent.id).desc()).limit(5)
    ).all()

    # Top devices by ingested (agent) events.
    device_rows = db.scalars(select(AgentDevice).where(AgentDevice.organization_id == org)).all()
    device_counts = []
    for d in device_rows:
        if not d.application_id:
            continue
        c = db.scalar(
            select(func.count()).select_from(TelemetryEvent).where(
                TelemetryEvent.application_id == d.application_id
            )
        ) or 0
        device_counts.append({"hostname": d.hostname, "os": d.operating_system, "events": int(c),
                              "status": d.status})
    device_counts.sort(key=lambda x: x["events"], reverse=True)

    # Regional health.
    region_rows = db.execute(
        select(TelemetryEvent.region, func.count(TelemetryEvent.id))
        .where(TelemetryEvent.organization_id == org)
        .group_by(TelemetryEvent.region)
    ).all()

    return {
        "events_received": int(total_events),
        "potential_alerts": int(naive),
        "actual_notifications": int(notifications),
        "alerts_suppressed": int(suppressed),
        "noise_reduction_ratio": noise_reduction,
        "total_incidents": int(total_incidents),
        "active_incidents": int(active_incidents),
        "critical_incidents": int(critical_incidents),
        "avg_incident_duration_minutes": avg_minutes,
        "top_noisy_services": [{"service": s or "unknown", "events": int(c)} for s, c in top_services],
        "top_error_fingerprints": [
            {"title": t, "fingerprint": fp[:12], "events": int(c)} for t, fp, c in top_fingerprints
        ],
        "top_affected_applications": [{"application": n, "events": int(c)} for n, c in top_apps],
        "top_affected_devices": device_counts[:5],
        "regional_health": [{"region": r or "unknown", "events": int(c)} for r, c in region_rows],
    }


# --------------------------------------------------------- security dashboard
@router.get("/organizations/{organization_id}/analytics/security")
def security_dashboard(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    org = organization_id

    devices = db.scalars(select(AgentDevice).where(AgentDevice.organization_id == org)).all()
    active = [d for d in devices if d.status in {"online", "enrolled"}]
    versions: dict[str, int] = {}
    for d in devices:
        if d.agent_version:
            versions[d.agent_version] = versions.get(d.agent_version, 0) + 1

    auth_failures = db.scalar(
        select(func.count()).select_from(AuditLog).where(
            AuditLog.action == "user.login_failed"
        )
    ) or 0
    denied = db.scalar(
        select(func.count()).select_from(AuditLog).where(
            AuditLog.organization_id == org, AuditLog.action == "tenant.access_denied"
        )
    ) or 0

    api_keys = db.scalars(
        select(ApplicationApiKey).where(ApplicationApiKey.organization_id == org)
    ).all()
    active_keys = [k for k in api_keys if k.revoked_at is None]

    suspicious = db.scalars(
        select(Incident).where(
            Incident.organization_id == org, Incident.spike_multiplier >= settings.spike_multiplier
        ).order_by(Incident.spike_multiplier.desc()).limit(5)
    ).all()

    return {
        "active_devices": len(active),
        "total_devices": len(devices),
        "agent_versions": versions,
        "devices": [
            {"hostname": d.hostname, "os": d.operating_system, "version": d.agent_version,
             "status": d.status, "last_heartbeat_at": d.last_heartbeat_at}
            for d in devices
        ],
        "authentication_failures": int(auth_failures),
        "cross_tenant_denials": int(denied),
        "api_keys_total": len(api_keys),
        "api_keys_active": len(active_keys),
        "rate_limit_violations": metrics.get_counter("rate_limit_violations", organization_id=org),
        "redactions": metrics.get_counter("redactions", organization_id=org),
        "suspicious_spikes": [
            {"title": i.title, "spike_multiplier": i.spike_multiplier, "severity": i.severity}
            for i in suspicious
        ],
    }


# --------------------------------------------------- platform self-observability
@router.get("/platform/health")
def platform_health(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The platform monitors itself. Requires authentication."""
    db_ok = True
    try:
        db.execute(select(1))
    except Exception:  # noqa: BLE001
        db_ok = False

    queue_depth = 0
    pending = 0
    redis_ok = True
    try:
        from app.core.redis_client import get_redis

        r = get_redis()
        queue_depth = r.xlen(settings.telemetry_stream)
        try:
            info = r.xpending(settings.telemetry_stream, settings.telemetry_consumer_group)
            pending = info["pending"] if isinstance(info, dict) else (info[0] if info else 0)
        except Exception:  # noqa: BLE001
            pending = 0
    except Exception:  # noqa: BLE001
        redis_ok = False

    devices = db.scalars(select(AgentDevice)).all()
    online = sum(1 for d in devices if d.status == "online")

    return {
        "status": "ok" if (db_ok and redis_ok) else "degraded",
        "region": settings.data_region,
        "database_healthy": db_ok,
        "redis_healthy": redis_ok,
        "queue_depth": int(queue_depth),
        "queue_pending": int(pending),
        "ingestion_rate_per_min": metrics.get_rate_per_minute("ingested"),
        "processing_rate_per_min": metrics.get_rate_per_minute("processed"),
        "events_ingested_total": metrics.get_counter("ingested"),
        "events_processed_total": metrics.get_counter("processed"),
        "processing_failures": metrics.get_counter("worker_failures"),
        "notification_failures": metrics.get_counter("notification_failures"),
        "redactions_total": metrics.get_counter("redactions"),
        "rate_limit_violations_total": metrics.get_counter("rate_limit_violations"),
        "agents_online": online,
        "agents_total": len(devices),
    }
