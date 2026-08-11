"""Phase 2 acceptance scenarios (spec §19), exercised through the real pipeline."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.core.ids import new_id
from app.intelligence.spike import record_and_evaluate
from app.models.incident import ErrorGroup, Incident
from app.worker.processor import process_event

ORG = "org_scenario"
APP = "app_scenario"


def make_event(message, *, severity="ERROR", service="svc", instance=None,
               ts=None, exception_type=None, region="india", app=APP, org=ORG,
               environment="production"):
    md = {}
    if instance:
        md["instance"] = instance
    if exception_type:
        md["exception_type"] = exception_type
    iso = (ts or datetime.now(timezone.utc)).isoformat()
    return {
        "event_id": new_id("evt"),
        "organization_id": org,
        "application_id": app,
        "service": service,
        "source_type": "application",
        "environment": environment,
        "region": region,
        "event_type": "log",
        "severity": severity,
        "message": message,
        "timestamp": iso,
        "received_at": iso,
        "metadata": md,
    }


def run(db, events):
    for ev in events:
        process_event(db, ev, commit=False)
    db.commit()


def group_count(db, org=ORG):
    return db.scalar(select(func.count()).select_from(ErrorGroup).where(ErrorGroup.organization_id == org))


def incident_count(db, org=ORG):
    return db.scalar(select(func.count()).select_from(Incident).where(Incident.organization_id == org))


# --- Scenario 1: 100 identical events -> 1 error group ------------------------
def test_scenario1_dedup_into_one_group(db_session):
    run(db_session, [make_event(f"Database connection failed for user {i}") for i in range(100)])
    assert group_count(db_session) == 1
    grp = db_session.scalar(select(ErrorGroup))
    assert grp.event_count == 100


# --- Scenario 2: 10000 identical events -> 1 incident -------------------------
def test_scenario2_many_events_one_incident(db_session):
    run(db_session, [make_event(f"Database connection failed for user {i}",
                                 exception_type="ConnectionError") for i in range(10000)])
    assert incident_count(db_session) == 1
    inc = db_session.scalar(select(Incident))
    assert inc.event_count == 10000
    # Notification storm prevented: at most a couple of notifications.
    assert inc.notifications_sent <= 3
    assert inc.noise_reduction_ratio >= 99.0


# --- Scenario 3: 500/min vs baseline 5/min -> spike ---------------------------
def test_scenario3_spike_detected():
    now = datetime.now(timezone.utc).timestamp()
    scope = "org:app:svc:prod:fp1"
    # Baseline: a few events well before the current window.
    for i in range(5):
        record_and_evaluate(scope, f"base-{i}", now=now - 700 + i)
    # Current window burst.
    result = None
    for i in range(500):
        result = record_and_evaluate(scope, f"cur-{i}", now=now)
    assert result.is_spike is True
    assert result.current_rate > result.baseline_rate


# --- Scenario 4: same error across 20 instances -> one incident ---------------
def test_scenario4_multi_instance_one_incident(db_session):
    run(db_session, [
        make_event("Token validation failed", instance=f"auth-{i % 20}",
                   exception_type="AuthError")
        for i in range(200)
    ])
    assert incident_count(db_session) == 1
    inc = db_session.scalar(select(Incident))
    assert len(inc.affected_instances) == 20


# --- Scenario 5: duplicates during cooldown are suppressed --------------------
def test_scenario5_cooldown_suppresses(db_session, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "cooldown_critical_seconds", 600)
    monkeypatch.setattr(settings, "cooldown_high_seconds", 600)

    base = datetime.now(timezone.utc)
    # All within the same cooldown window (seconds apart).
    run(db_session, [
        make_event("Payment gateway rejected charge", severity="ERROR",
                   exception_type="PaymentError", ts=base + timedelta(seconds=i))
        for i in range(300)
    ])
    inc = db_session.scalar(select(Incident))
    assert inc.notifications_sent == 1          # only the first fired
    assert inc.events_suppressed >= 290         # the rest suppressed


# --- Scenario 6: cooldown expires -> notification update ----------------------
def test_scenario6_cooldown_expiry_updates(db_session, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "cooldown_critical_seconds", 60)
    monkeypatch.setattr(settings, "cooldown_high_seconds", 60)

    base = datetime.now(timezone.utc)
    # Spread events across several cooldown windows (2 minutes apart each burst).
    events = []
    for window in range(4):
        t = base + timedelta(minutes=2 * window)
        for i in range(30):
            events.append(make_event("Upstream request timed out", severity="ERROR",
                                      exception_type="TimeoutError",
                                      ts=t + timedelta(seconds=i)))
    run(db_session, events)
    inc = db_session.scalar(select(Incident))
    assert inc.notifications_sent >= 2          # created + at least one update
