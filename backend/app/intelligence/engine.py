"""Incident engine — the deterministic orchestration of the intelligence layer.

Pipeline (all deterministic, no LLM):

    normalized event
      -> upsert ErrorGroup (dedup: 10k events => 1 row, count += 1)
      -> spike detection (sliding window)
      -> decide if an incident is warranted
      -> correlate/attach to an existing incident or open a new one
      -> severity engine
      -> cooldown matrix -> notify or suppress (noise reduction)
      -> timeline + realtime publish

Raw events are NEVER deleted — groups and incidents are aggregations that point
back to ``telemetry_events`` for investigation.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core import realtime
from app.intelligence import correlation, notifications
from app.intelligence.cooldown import decide as cooldown_decide
from app.intelligence.fingerprint import build_title
from app.intelligence.normalize import max_severity, severity_rank
from app.intelligence.severity import SeveritySignals, compute_severity
from app.intelligence.spike import SpikeResult, record_and_evaluate
from app.models.incident import ErrorGroup, Incident, IncidentTimelineEntry


@dataclass
class IntelligenceResult:
    group: ErrorGroup
    spike: SpikeResult
    incident: Incident | None
    notified: bool
    decision_kind: str  # created | update | suppressed | none


def _aware(dt: datetime | None) -> datetime | None:
    """Coerce a possibly-naive datetime (e.g. from SQLite) to UTC-aware."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _union(values: list, value) -> list:
    if value is not None and value not in values:
        values.append(value)
    return values


def _add_timeline(
    db: Session, incident: Incident, kind: str, message: str, when: datetime, metadata: dict | None = None
) -> None:
    db.add(
        IncidentTimelineEntry(
            incident_id=incident.id,
            kind=kind,
            message=message,
            created_at=when,
            event_metadata=metadata or {},
        )
    )


def _last_timeline_kind(db: Session, incident_id: str) -> str | None:
    return db.scalar(
        select(IncidentTimelineEntry.kind)
        .where(IncidentTimelineEntry.incident_id == incident_id)
        .order_by(IncidentTimelineEntry.created_at.desc())
        .limit(1)
    )


def _has_timeline_kind(db: Session, incident_id: str, kind: str) -> bool:
    return db.scalar(
        select(IncidentTimelineEntry.id)
        .where(
            IncidentTimelineEntry.incident_id == incident_id,
            IncidentTimelineEntry.kind == kind,
        )
        .limit(1)
    ) is not None


def _upsert_group(db: Session, ev: dict, now: datetime) -> tuple[ErrorGroup, bool]:
    fp = ev["fingerprint"]
    org, app = ev["organization_id"], ev["application_id"]
    service = ev.get("service") or "unknown"
    env = ev.get("environment") or "production"

    group = db.scalar(
        select(ErrorGroup).where(
            ErrorGroup.organization_id == org,
            ErrorGroup.application_id == app,
            ErrorGroup.service == service,
            ErrorGroup.environment == env,
            ErrorGroup.fingerprint == fp,
        )
    )
    created = False
    if group is None:
        group = ErrorGroup(
            organization_id=org,
            application_id=app,
            service=service,
            environment=env,
            fingerprint=fp,
            title=build_title(ev),
            event_type=ev.get("event_type") or "log",
            severity=ev["severity"],
            first_seen=now,
            last_seen=now,
            event_count=0,
            affected_instances=[],
            affected_regions=[],
            sample_event_id=ev["event_id"],
            sample_message=ev.get("message"),
            trace_embedding=ev.get("_trace_embedding"),
        )
        db.add(group)
        created = True
        try:
            group.event_count = 1
            db.commit()
            db.refresh(group)
        except Exception as e:
            db.rollback()
            import logging
            logging.getLogger("telemetry.api").warning(f"Error group insert failed: {e}")
    else:
        try:
            db.query(ErrorGroup).filter(ErrorGroup.id == group.id).update(
                {
                    "event_count": group.event_count + 1,
                    "last_seen": max(_aware(group.last_seen), now) if group.last_seen else now,
                    "severity": max_severity(group.severity, ev["severity"]),
                    "affected_instances": _union(list(group.affected_instances or []), ev.get("_instance")),
                    "affected_regions": _union(list(group.affected_regions or []), ev.get("region")),
                },
                synchronize_session=False
            )
            db.commit()
            db.refresh(group)
        except Exception as e:
            db.rollback()
            import logging
            logging.getLogger("telemetry.api").warning(f"Error group update failed: {e}")

    return group, created


def _resolve_incident(db: Session, ev: dict, group: ErrorGroup, corr_id: str, now: datetime) -> tuple[Incident, bool]:
    """Return (incident, is_new). Attaches to an active correlated incident if
    one exists within the correlation window; otherwise opens a new incident."""
    # Prefer the group's own active incident.
    incident: Incident | None = None
    if group.incident_id:
        candidate = db.get(Incident, group.incident_id)
        if candidate and candidate.status in {"OPEN", "ACKNOWLEDGED"}:
            incident = candidate

    # Otherwise find an active incident sharing the correlation id in-window.
    if incident is None:
        candidate = db.scalar(
            select(Incident)
            .where(
                Incident.organization_id == ev["organization_id"],
                Incident.correlation_id == corr_id,
                Incident.status.in_(["OPEN", "ACKNOWLEDGED"]),
            )
            .order_by(Incident.last_seen.desc())
            .limit(1)
        )
        if candidate is not None:
            gap = abs((now - (_aware(candidate.last_seen) or now)).total_seconds())
            if correlation.within_window(gap):
                incident = candidate

    if incident is not None:
        return incident, False

    incident = Incident(
        organization_id=ev["organization_id"],
        application_id=ev["application_id"],
        service=group.service,
        fingerprint=group.fingerprint,
        title=group.title,
        severity=ev["severity"],
        status="OPEN",
        first_seen=now,
        last_seen=now,
        event_count=0,
        affected_instances=[],
        affected_regions=[],
        affected_services=[],
        affected_applications=[],
        correlation_id=corr_id,
    )
    db.add(incident)
    db.flush()
    return incident, True


def run_intelligence(db: Session, ev: dict) -> IntelligenceResult:
    """Run the full intelligence pipeline for one normalized event.

    ``ev`` must contain ``fingerprint`` plus the normalized helper fields
    (``_instance``, ``_error_class``) and a datetime ``timestamp``.
    """
    now: datetime = ev["timestamp"]
    fp = ev["fingerprint"]
    env = ev.get("environment") or "production"
    org = ev["organization_id"]

    # 1. Compute trace embedding for the incoming event
    from app.intelligence.embedding import TraceEmbeddingEngine
    from datetime import timedelta
    from sqlalchemy import or_

    embedding = TraceEmbeddingEngine.embed_event(ev)
    # Store embedding in the event so that if a new group is created, it inherits it
    ev["_trace_embedding"] = embedding

    # 2. Query recent active error groups in the same organization/environment
    cutoff = now - timedelta(days=14)
    stmt = (
        select(ErrorGroup)
        .outerjoin(Incident, ErrorGroup.incident_id == Incident.id)
        .where(
            ErrorGroup.organization_id == org,
            ErrorGroup.environment == env,
            or_(
                Incident.status.in_(["OPEN", "ACKNOWLEDGED"]),
                ErrorGroup.last_seen >= cutoff
            )
        )
    )
    candidates = db.scalars(stmt).all()

    best_similarity = -1.0
    best_group = None

    for candidate in candidates:
        cand_embed = candidate.trace_embedding
        if not cand_embed:
            cand_text = candidate.sample_message or ""
            cand_embed = TraceEmbeddingEngine.get_embedding(cand_text)
            candidate.trace_embedding = cand_embed
            db.flush()

        similarity = TraceEmbeddingEngine.compute_similarity(embedding, cand_embed)
        if similarity >= 0.88 and similarity > best_similarity:
            best_similarity = similarity
            best_group = candidate

    if best_group is not None:
        try:
            db.query(ErrorGroup).filter(ErrorGroup.id == best_group.id).update(
                {"gptrace_score": best_similarity}, synchronize_session=False
            )
            if best_group.incident_id:
                db.query(Incident).filter(Incident.id == best_group.incident_id).update(
                    {"gptrace_score": best_similarity}, synchronize_session=False
                )
            db.commit()
            db.refresh(best_group)
        except Exception as e:
            db.rollback()
            import logging
            logging.getLogger("telemetry.api").warning(f"Error group gptrace_score update skipped: {e}")

        # Group it under the existing incident/error_group
        fp = best_group.fingerprint
        ev["fingerprint"] = fp

        # Update the persisted TelemetryEvent's fingerprint
        from app.models.telemetry import TelemetryEvent
        row = db.get(TelemetryEvent, ev["event_id"])
        if row:
            try:
                row.fingerprint = fp
                db.commit()
            except Exception as e:
                db.rollback()
                import logging
                logging.getLogger("telemetry.api").warning(f"TelemetryEvent fingerprint update skipped: {e}")

    group, group_created = _upsert_group(db, ev, now)

    scope = f"{ev['organization_id']}:{ev['application_id']}:{group.service}:{env}:{fp}"
    spike = record_and_evaluate(scope, ev["event_id"], now=now.timestamp())

    is_error_like = severity_rank(ev["severity"]) >= severity_rank("ERROR")
    should_incident = (
        is_error_like
        or spike.is_spike
        or group.event_count >= settings.incident_trigger_event_count
        or group.incident_id is not None
    )

    if not should_incident:
        db.flush()
        return IntelligenceResult(group, spike, None, False, "none")

    family = correlation.correlation_family(ev.get("_error_class"), fp)
    corr_id = correlation.correlation_key(ev["organization_id"], env, family)
    incident, is_new = _resolve_incident(db, ev, group, corr_id, now)

    newly_linked = group.incident_id != incident.id
    group.incident_id = incident.id

    # --- aggregate updates ---
    incident.event_count += 1
    incident.last_seen = max(_aware(incident.last_seen), now) if incident.last_seen else now
    incident.affected_instances = _union(list(incident.affected_instances or []), ev.get("_instance"))
    incident.affected_regions = _union(list(incident.affected_regions or []), ev.get("region"))

    services = list(incident.affected_services or [])
    new_service = group.service and group.service not in services
    incident.affected_services = _union(services, group.service)

    apps = list(incident.affected_applications or [])
    new_app = ev["application_id"] not in apps
    incident.affected_applications = _union(apps, ev["application_id"])

    incident.baseline_rate = spike.baseline_rate
    incident.current_rate = spike.current_rate
    incident.spike_multiplier = max(incident.spike_multiplier, spike.multiplier)

    if is_new:
        _add_timeline(db, incident, "first_event", "First event observed", now,
                      {"event_id": ev["event_id"]})
        _add_timeline(db, incident, "incident_created",
                      f"Incident opened: {incident.title}", now,
                      {"correlation_id": corr_id})
    elif newly_linked and (new_service or new_app):
        _add_timeline(
            db, incident, "correlated",
            f"Correlated {group.service or 'service'} into this incident "
            f"(now {len(incident.affected_services)} services, "
            f"{len(incident.affected_applications)} applications)",
            now,
            {"service": group.service, "application_id": ev["application_id"]},
        )

    # --- spike timeline (once per incident) ---
    if spike.is_spike and not _has_timeline_kind(db, incident.id, "spike_started"):
        _add_timeline(
            db, incident, "spike_started",
            f"Spike detected: {spike.current_rate}/min vs baseline "
            f"{spike.baseline_rate}/min ({spike.multiplier}× )",
            now,
            {"current_rate": spike.current_rate, "baseline_rate": spike.baseline_rate,
             "multiplier": spike.multiplier},
        )

    # --- severity engine ---
    computed = compute_severity(
        SeveritySignals(
            source_severity=group.severity,
            event_count=incident.event_count,
            instance_count=len(incident.affected_instances),
            service_count=len(incident.affected_services),
            spike_multiplier=incident.spike_multiplier,
            environment=env,
        )
    )
    escalated = max_severity(incident.severity, computed)
    if escalated != incident.severity:
        prev = incident.severity
        incident.severity = escalated
        _add_timeline(db, incident, "severity_changed",
                      f"Severity escalated {prev} → {escalated}", now,
                      {"from": prev, "to": escalated})

    # --- cooldown matrix -> notify or suppress ---
    decision = cooldown_decide(
        severity=incident.severity,
        status=incident.status,
        notifications_sent=incident.notifications_sent,
        last_notified_at=incident.last_notified_at,
        now=now,
    )

    notified = False
    if decision.should_notify:
        if decision.kind == "update":
            _add_timeline(db, incident, "cooldown_expired",
                          f"Cooldown expired ({decision.cooldown_seconds}s)", now)
        notifications.send_notification(db, incident, kind=decision.kind, reason=decision.reason, now=now)
        _add_timeline(
            db, incident,
            "notification_sent" if decision.kind == "created" else "notification_updated",
            f"Notification sent ({decision.kind}) at {incident.event_count} events", now,
            {"event_count": incident.event_count},
        )
        notified = True
    else:
        notifications.record_suppression(incident)
        # Add a single suppression marker per cooldown window (avoid timeline spam).
        if _last_timeline_kind(db, incident.id) != "events_suppressed":
            _add_timeline(db, incident, "events_suppressed",
                          "Additional matching events suppressed during cooldown", now,
                          {"suppressed_total": incident.events_suppressed})

    realtime.publish(
        incident.organization_id,
        "incident_updated",
        {
            "incident_id": incident.id,
            "status": incident.status,
            "severity": incident.severity,
            "title": incident.title,
            "event_count": incident.event_count,
            "affected_instances": len(incident.affected_instances),
            "affected_services": len(incident.affected_services),
            "spike_multiplier": incident.spike_multiplier,
            "notifications_sent": incident.notifications_sent,
            "events_suppressed": incident.events_suppressed,
            "noise_reduction_ratio": incident.noise_reduction_ratio,
        },
    )

    if incident.last_notified_at:
        try:
            last_notified = incident.last_notified_at
            if last_notified.tzinfo is None:
                last_notified = last_notified.replace(tzinfo=timezone.utc)
            cooldown_sec = settings.cooldown_for(incident.severity)
            elapsed = (now - last_notified).total_seconds()
            remaining = max(0, int(cooldown_sec - elapsed))
            expiry = datetime.fromtimestamp(last_notified.timestamp() + cooldown_sec, tz=timezone.utc)
            status_str = "ACTIVE_SUPPRESSION" if remaining > 0 else "COOLDOWN_EXPIRED"
            app_name = incident.affected_applications[0] if (incident.affected_applications and len(incident.affected_applications) > 0) else "Unknown"

            realtime.publish(
                incident.organization_id,
                "cooldown_update",
                {
                    "incident_id": incident.id,
                    "service": incident.service or "global",
                    "application_name": app_name,
                    "title": incident.title,
                    "trigger_time": last_notified.isoformat(),
                    "expiry_time": expiry.isoformat(),
                    "remaining_seconds": remaining,
                    "severity": incident.severity,
                    "suppressed_count": incident.events_suppressed,
                    "status": status_str,
                },
            )
        except Exception as e:
            import logging
            logging.getLogger("telemetry.api").error(f"Failed to publish cooldown_update: {e}")

    db.flush()
    return IntelligenceResult(group, spike, incident, notified,
                              decision.kind if decision.should_notify else "suppressed")
