"""Retention purge, executive analytics, security dashboard, platform health."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.retention import purge_organization
from app.database import SessionLocal
from app.models.telemetry import TelemetryEvent
from tests.conftest import register_org


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def test_retention_policy_crud(client):
    token, org_id = register_org(client)
    default = client.get(f"/api/v1/organizations/{org_id}/retention", headers=_h(token)).json()
    assert default["raw_telemetry_days"] == 7

    updated = client.put(
        f"/api/v1/organizations/{org_id}/retention",
        json={"raw_telemetry_days": 1},
        headers=_h(token),
    ).json()
    assert updated["raw_telemetry_days"] == 1


def test_retention_purge_deletes_old_raw_events(client):
    token, org_id = register_org(client)
    # Seed one old and one fresh raw event directly.
    db = SessionLocal()
    try:
        old = TelemetryEvent(
            id="evt_old", organization_id=org_id, application_id="app_x",
            severity="INFO", event_type="log",
            timestamp=datetime.now(timezone.utc) - timedelta(days=40),
            received_at=datetime.now(timezone.utc) - timedelta(days=40),
            event_metadata={},
        )
        fresh = TelemetryEvent(
            id="evt_fresh", organization_id=org_id, application_id="app_x",
            severity="INFO", event_type="log",
            timestamp=datetime.now(timezone.utc), received_at=datetime.now(timezone.utc),
            event_metadata={},
        )
        db.add_all([old, fresh])
        db.commit()

        result = purge_organization(db, org_id)
        assert result["raw_telemetry_deleted"] == 1
        remaining = db.scalars(select(TelemetryEvent.id).where(TelemetryEvent.organization_id == org_id)).all()
        assert "evt_fresh" in remaining and "evt_old" not in remaining
    finally:
        db.close()


def test_executive_analytics(client):
    token, org_id = register_org(client)
    client.post(
        f"/api/v1/organizations/{org_id}/demo/simulate/database-outage?count=300&apps=3",
        headers=_h(token),
    )
    ex = client.get(f"/api/v1/organizations/{org_id}/analytics/executive", headers=_h(token)).json()
    assert ex["events_received"] == 300
    assert ex["noise_reduction_ratio"] >= 90.0
    assert len(ex["top_noisy_services"]) >= 1
    assert len(ex["regional_health"]) >= 1


def test_security_dashboard(client):
    token, org_id = register_org(client)
    # A failed login should show up as an authentication failure.
    client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "wrong"})
    sec = client.get(f"/api/v1/organizations/{org_id}/analytics/security", headers=_h(token)).json()
    assert "active_devices" in sec
    assert sec["authentication_failures"] >= 1
    assert "agent_versions" in sec


def test_platform_health(client):
    token, org_id = register_org(client)
    health = client.get("/api/v1/platform/health", headers=_h(token)).json()
    assert health["status"] in {"ok", "degraded"}
    assert health["database_healthy"] is True
    assert "queue_depth" in health
