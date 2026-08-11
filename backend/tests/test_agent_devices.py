"""Device enrollment, credentials, agent config/heartbeat, and OS-event flow."""
from sqlalchemy import select

from app.database import SessionLocal
from app.models.incident import Incident
from tests._helpers import drain_stream
from tests.conftest import register_org


def _enroll_device(client, token, org_id, hostname="web-01"):
    h = {"Authorization": f"Bearer {token}"}
    reg = client.post(
        f"/api/v1/organizations/{org_id}/devices",
        json={"hostname": hostname, "operating_system": "linux", "region": "india"},
        headers=h,
    ).json()
    enroll = client.post(
        "/api/v1/devices/enroll",
        json={"device_id": reg["id"], "enrollment_token": reg["enrollment_token"],
              "os_version": "Ubuntu 22.04", "agent_version": "0.3.0"},
    ).json()
    return reg["id"], enroll["device_credential"]


def test_enrollment_issues_scoped_credential(client):
    token, org_id = register_org(client)
    device_id, credential = _enroll_device(client, token, org_id)
    assert credential.startswith("th_")

    # Agent fetches its config using ONLY the device credential (no JWT).
    cfg = client.get("/api/v1/agent/config", headers={"X-API-Key": credential})
    assert cfg.status_code == 200
    assert cfg.json()["device_id"] == device_id
    assert cfg.json()["config"]["collect_cpu"] is True


def test_agent_heartbeat_via_credential(client):
    token, org_id = register_org(client)
    _, credential = _enroll_device(client, token, org_id)
    hb = client.post(
        "/api/v1/agent/heartbeat",
        json={"agent_version": "0.3.1", "os_version": "Ubuntu 22.04"},
        headers={"X-API-Key": credential},
    )
    assert hb.status_code == 200


def test_credential_is_device_scoped(client):
    """A device credential must not be usable as an app/user credential."""
    token, org_id = register_org(client)
    _, credential = _enroll_device(client, token, org_id)
    # It's a valid ingest credential, but cannot list org devices (needs JWT).
    resp = client.get(
        f"/api/v1/organizations/{org_id}/devices", headers={"X-API-Key": credential}
    )
    assert resp.status_code == 401  # not a bearer JWT


def test_os_events_flow_through_same_intelligence(client, fake_redis):
    """OS agent telemetry must be processed by the SAME Phase 2 engine."""
    token, org_id = register_org(client)
    _, credential = _enroll_device(client, token, org_id)

    # Agent sends repeated OS error events (e.g. repeated service crashes).
    for i in range(80):
        client.post(
            "/api/v1/telemetry",
            json={
                "service": "systemd",
                "source_type": "agent",
                "severity": "ERROR",
                "event_type": "system",
                "message": f"service nginx crashed (pid {i})",
                "metadata": {"instance": "web-01", "exception_type": "ServiceCrash"},
            },
            headers={"X-API-Key": credential},
        )

    drain_stream(fake_redis)

    db = SessionLocal()
    try:
        incidents = db.scalars(select(Incident).where(Incident.organization_id == org_id)).all()
        assert len(incidents) == 1  # reused intelligence -> one incident
        assert incidents[0].event_count == 80
    finally:
        db.close()


def test_device_removal_revokes_credential(client):
    token, org_id = register_org(client)
    h = {"Authorization": f"Bearer {token}"}
    device_id, credential = _enroll_device(client, token, org_id)

    resp = client.delete(f"/api/v1/organizations/{org_id}/devices/{device_id}", headers=h)
    assert resp.status_code == 204

    # Revoked credential can no longer ingest.
    ingest = client.post(
        "/api/v1/telemetry", json={"message": "x"}, headers={"X-API-Key": credential}
    )
    assert ingest.status_code == 403


def test_device_tenant_isolation(client):
    token_a, org_a = register_org(client, email="a@ex.com", org="A")
    device_id, _ = _enroll_device(client, token_a, org_a)

    token_b, org_b = register_org(client, email="b@ex.com", org="B")
    # Org B cannot delete Org A's device.
    resp = client.delete(
        f"/api/v1/organizations/{org_a}/devices/{device_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp.status_code == 404
