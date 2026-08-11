"""API tests: demo simulator, incidents, drill-down, KPIs, lifecycle, SSE auth."""
from tests.conftest import register_org


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_demo_database_outage_creates_one_correlated_incident(client):
    token, org_id = register_org(client)
    h = _headers(token)

    resp = client.post(
        f"/api/v1/organizations/{org_id}/demo/simulate/database-outage?count=300&apps=3",
        headers=h,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["events_generated"] == 300
    # 300 events collapse to a single correlated incident with few notifications.
    assert len(body["incidents"]) == 1
    inc = body["incidents"][0]
    assert inc["event_count"] == 300
    assert inc["affected_applications"] == 3
    assert inc["notifications_sent"] <= 3
    assert inc["noise_reduction_ratio"] >= 95.0


def test_incidents_list_detail_and_drilldown(client):
    token, org_id = register_org(client)
    h = _headers(token)
    client.post(f"/api/v1/organizations/{org_id}/demo/simulate/error-burst?count=120&apps=1", headers=h)

    incidents = client.get(f"/api/v1/organizations/{org_id}/incidents", headers=h).json()
    assert len(incidents) >= 1
    inc_id = incidents[0]["id"]

    detail = client.get(f"/api/v1/organizations/{org_id}/incidents/{inc_id}", headers=h).json()
    assert detail["id"] == inc_id
    kinds = {t["kind"] for t in detail["timeline"]}
    assert "incident_created" in kinds
    assert len(detail["notifications"]) >= 1

    # Incident -> underlying raw telemetry
    raw = client.get(f"/api/v1/organizations/{org_id}/incidents/{inc_id}/events", headers=h).json()
    assert len(raw) >= 1

    # Error group -> underlying raw telemetry
    groups = client.get(f"/api/v1/organizations/{org_id}/error-groups", headers=h).json()
    assert len(groups) >= 1
    g_events = client.get(
        f"/api/v1/organizations/{org_id}/error-groups/{groups[0]['id']}/events", headers=h
    ).json()
    assert len(g_events) >= 1


def test_kpis(client):
    token, org_id = register_org(client)
    h = _headers(token)
    client.post(f"/api/v1/organizations/{org_id}/demo/simulate/multi-instance-failure?count=200&apps=1", headers=h)

    kpis = client.get(f"/api/v1/organizations/{org_id}/kpis", headers=h).json()
    assert kpis["events_received"] == 200
    assert kpis["notifications_sent"] >= 1
    assert kpis["noise_reduction_ratio"] >= 95.0
    assert kpis["active_incidents"] >= 1


# --- Scenario 7: incident resolves -------------------------------------------
def test_scenario7_incident_resolution(client):
    token, org_id = register_org(client)
    h = _headers(token)
    client.post(f"/api/v1/organizations/{org_id}/demo/simulate/api-timeout-storm?count=100&apps=1", headers=h)

    inc_id = client.get(f"/api/v1/organizations/{org_id}/incidents", headers=h).json()[0]["id"]

    resp = client.post(
        f"/api/v1/organizations/{org_id}/incidents/{inc_id}/status",
        json={"status": "RESOLVED"},
        headers=h,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "RESOLVED"

    detail = client.get(f"/api/v1/organizations/{org_id}/incidents/{inc_id}", headers=h).json()
    assert {t["kind"] for t in detail["timeline"]} & {"resolved"}
    assert any(n["kind"] == "resolved" for n in detail["notifications"])


def test_incident_isolation_between_orgs(client):
    token_a, org_a = register_org(client, email="a@ex.com", org="A")
    client.post(f"/api/v1/organizations/{org_a}/demo/simulate/error-burst?count=80&apps=1", headers=_headers(token_a))

    token_b, org_b = register_org(client, email="b@ex.com", org="B")
    # Org B sees none of Org A's incidents.
    incidents_b = client.get(f"/api/v1/organizations/{org_b}/incidents", headers=_headers(token_b)).json()
    assert incidents_b == []
    # And cannot query Org A's incident list.
    resp = client.get(f"/api/v1/organizations/{org_a}/incidents", headers=_headers(token_b))
    assert resp.status_code == 404


def test_sse_requires_token(client):
    token, org_id = register_org(client)
    # No token query param -> unauthorized (before streaming begins).
    resp = client.get(f"/api/v1/organizations/{org_id}/stream")
    assert resp.status_code == 401


def test_auth_failure_storm_creates_security_incident(client):
    token, org_id = register_org(client)
    h = _headers(token)
    resp = client.post(
        f"/api/v1/organizations/{org_id}/demo/simulate/auth-failure-storm?count=500&apps=1",
        headers=h,
    )
    assert resp.status_code == 200
    body = resp.json()
    # 500 failed logins collapse into a single security incident.
    assert len(body["incidents"]) == 1
    assert body["incidents"][0]["event_count"] == 500
    assert body["incidents"][0]["noise_reduction_ratio"] >= 99.0
