"""Telemetry demo simulator (Phase 2).

Generates realistic telemetry for a scenario and runs it through the *real*
intelligence pipeline, then returns a summary that demonstrates
``N events -> few groups -> 1 incident -> 1-2 notifications``.

Deterministic and self-contained: events are processed inline through the same
``process_event`` used by the worker, so results are visible immediately in the
dashboard even without the background worker running.
"""
from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_org_member
from app.core.ids import new_id
from app.database import get_db
from app.models.application import Application
from app.models.incident import Incident
from app.models.user import User
from app.worker.processor import process_event

router = APIRouter(prefix="/organizations/{organization_id}/demo", tags=["demo"])

REGIONS = ["india", "us-east", "eu-west"]

SCENARIOS = {
    "normal-traffic": "Low-volume mixed INFO/WARNING traffic, no incident",
    "error-burst": "A burst of identical errors in one service",
    "database-outage": "DB connection failures across multiple apps/instances",
    "cpu-spike": "System CPU spike across instances",
    "api-timeout-storm": "API gateway timeout storm",
    "multi-instance-failure": "Same error across many instances (one incident)",
    "auth-failure-storm": "Repeated failed logins → one security incident",
    "loghub-hdfs-outage": "Real-world HDFS error/warning log outage scenario from LogHub dataset",
}


def _ensure_demo_apps(db: Session, organization_id: str, n: int) -> list[Application]:
    apps = db.scalars(
        select(Application)
        .where(Application.organization_id == organization_id, Application.name.like("Demo %"))
        .order_by(Application.name)
    ).all()
    apps = list(apps)
    created = False
    for i in range(len(apps), n):
        app = Application(
            organization_id=organization_id,
            name=f"Demo Service {i + 1}",
            environment="production",
            region=REGIONS[i % len(REGIONS)],
            description="Auto-created by the demo simulator",
        )
        db.add(app)
        apps.append(app)
        created = True
    if created:
        db.flush()
    return apps[:n]


def _event(app: Application, **over) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    base = {
        "event_id": new_id("evt"),
        "organization_id": app.organization_id,
        "application_id": app.id,
        "service": over.pop("service", "api"),
        "source_type": "application",
        "environment": "production",
        "region": over.pop("region", random.choice(REGIONS)),
        "event_type": "log",
        "severity": "INFO",
        "message": "",
        "timestamp": now,
        "received_at": now,
        "metadata": {},
    }
    base.update(over)
    return base


def _generate(scenario: str, apps: list[Application], count: int) -> list[dict]:
    events: list[dict] = []
    if scenario == "normal-traffic":
        for i in range(count):
            app = random.choice(apps)
            sev = random.choices(["INFO", "WARNING", "ERROR"], weights=[80, 15, 5])[0]
            events.append(_event(app, service="api", severity=sev,
                                  message=f"Handled request {new_id('req')}",
                                  metadata={"instance": f"srv-{random.randint(1,3)}"}))
    elif scenario == "error-burst":
        app = apps[0]
        for i in range(count):
            events.append(_event(app, service="payment-api", severity="ERROR",
                                  message=f"Payment gateway rejected charge {new_id('chg')}",
                                  metadata={"instance": f"srv-{random.randint(1,4)}",
                                            "exception_type": "PaymentError"}))
    elif scenario == "database-outage":
        services = ["orders", "checkout", "billing"]
        for i in range(count):
            app = apps[i % len(apps)]
            events.append(_event(
                app,
                service=random.choice(services),
                severity="ERROR",
                message=f"Database connection failed for user {random.randint(1000, 9999)}",
                region=random.choice(REGIONS),
                metadata={"instance": f"db-node-{random.randint(1, 20)}",
                          "exception_type": "ConnectionError"},
            ))
    elif scenario == "cpu-spike":
        app = apps[0]
        for i in range(count):
            events.append(_event(app, service="host-agent", event_type="metric",
                                  severity="HIGH",
                                  message="CPU utilization critical",
                                  metadata={"instance": f"node-{random.randint(1, 8)}",
                                            "cpu": random.randint(90, 100)}))
    elif scenario == "api-timeout-storm":
        app = apps[0]
        for i in range(count):
            events.append(_event(app, service="api-gateway", severity="ERROR",
                                  message=f"Upstream request timed out after {random.randint(5000,9000)}ms",
                                  metadata={"instance": f"gw-{random.randint(1, 6)}",
                                            "exception_type": "TimeoutError"}))
    elif scenario == "multi-instance-failure":
        app = apps[0]
        for i in range(count):
            events.append(_event(app, service="auth", severity="ERROR",
                                  message=f"Token validation failed for session {new_id('sess')}",
                                  metadata={"instance": f"auth-{random.randint(1, 20)}",
                                            "exception_type": "AuthError"}))
    elif scenario == "auth-failure-storm":
        app = apps[0]
        for i in range(count):
            events.append(_event(
                app, service="sshd", event_type="security", severity="ERROR",
                source_type="agent",
                message=f"Failed password for invalid user from 10.0.{random.randint(0,255)}.{random.randint(0,255)}",
                metadata={"instance": f"srv-{random.randint(1, 3)}",
                          "exception_type": "AuthenticationFailure"},
            ))
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown scenario '{scenario}'")
    return events


@router.get("/scenarios")
def list_scenarios(
    organization_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_org_member(organization_id, user, db)
    return [{"id": k, "description": v} for k, v in SCENARIOS.items()]


@router.post("/simulate/{scenario}")
def simulate(
    organization_id: str,
    scenario: str,
    count: int = Query(default=2000, ge=1, le=20000),
    apps: int = Query(default=3, ge=1, le=10),
    noise_factor: int = Query(default=1, ge=1, le=10),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run a scenario through the real pipeline and return a summary."""
    require_org_member(organization_id, user, db)
    if scenario not in SCENARIOS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown scenario '{scenario}'")

    if scenario == "loghub-hdfs-outage":
        from app.demo.simulator import run_loghub_simulation
        return run_loghub_simulation(db, organization_id, count, noise_factor, apps)

    demo_apps = _ensure_demo_apps(db, organization_id, apps)
    events = _generate(scenario, demo_apps, count)

    for ev in events:
        process_event(db, ev, commit=False)  # intelligence side-effects applied inline
    db.commit()

    # Summarize the incidents touched by this simulation window.
    incidents = db.scalars(
        select(Incident)
        .where(Incident.organization_id == organization_id)
        .order_by(Incident.last_seen.desc())
        .limit(10)
    ).all()

    total_notifs = sum(i.notifications_sent for i in incidents)
    total_suppressed = sum(i.events_suppressed for i in incidents)

    return {
        "scenario": scenario,
        "events_generated": len(events),
        "applications": len(demo_apps),
        "incidents": [
            {
                "id": i.id,
                "title": i.title,
                "severity": i.severity,
                "status": i.status,
                "event_count": i.event_count,
                "affected_instances": len(i.affected_instances),
                "affected_services": len(i.affected_services),
                "affected_applications": len(i.affected_applications),
                "spike_multiplier": i.spike_multiplier,
                "notifications_sent": i.notifications_sent,
                "events_suppressed": i.events_suppressed,
                "noise_reduction_ratio": i.noise_reduction_ratio,
            }
            for i in incidents
            if i.last_seen and i.event_count > 0
        ][:5],
        "notifications_sent": total_notifs,
        "events_suppressed": total_suppressed,
    }
