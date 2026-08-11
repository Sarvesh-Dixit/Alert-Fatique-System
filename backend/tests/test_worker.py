from datetime import datetime, timezone

from app.models.application import Service
from app.models.telemetry import TelemetryEvent
from app.worker.processor import process_event


def _event(**overrides):
    base = {
        "event_id": "evt_test1",
        "organization_id": "org_1",
        "application_id": "app_1",
        "service": "payment-api",
        "source_type": "application",
        "environment": "production",
        "region": "india",
        "event_type": "log",
        "severity": "ERROR",
        "message": "db timeout",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "received_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {"k": "v"},
    }
    base.update(overrides)
    return base


def test_process_event_persists(db_session):
    process_event(db_session, _event())
    row = db_session.get(TelemetryEvent, "evt_test1")
    assert row is not None
    assert row.severity == "ERROR"
    assert row.event_metadata == {"k": "v"}


def test_process_event_is_idempotent(db_session):
    process_event(db_session, _event())
    process_event(db_session, _event(message="changed"))
    rows = db_session.query(TelemetryEvent).all()
    assert len(rows) == 1
    assert rows[0].message == "db timeout"  # first write wins


def test_process_event_auto_registers_service(db_session):
    process_event(db_session, _event(event_id="evt_a", service="svc-x"))
    process_event(db_session, _event(event_id="evt_b", service="svc-x"))
    services = db_session.query(Service).filter(Service.name == "svc-x").all()
    assert len(services) == 1  # only registered once
