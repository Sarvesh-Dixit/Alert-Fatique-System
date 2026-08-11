"""Notification providers: config, masking, test send, cooldown-gated dispatch."""
from sqlalchemy import select

import app.notifications.providers as providers_mod
from app.database import SessionLocal
from app.models.incident import NotificationLog
from tests.conftest import register_org


def _configure_slack(client, token, org_id, min_severity="INFO"):
    return client.put(
        f"/api/v1/organizations/{org_id}/integrations",
        json={"type": "slack", "config": {"webhook_url": "https://hooks.slack.com/services/XXX/secret"},
              "min_severity": min_severity},
        headers={"Authorization": f"Bearer {token}"},
    )


def test_integration_config_is_masked(client):
    token, org_id = register_org(client)
    resp = _configure_slack(client, token, org_id)
    assert resp.status_code == 200
    # The webhook secret must be masked in responses.
    listed = client.get(
        f"/api/v1/organizations/{org_id}/integrations",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    masked = listed[0]["config"]["webhook_url"]
    assert masked == "https://hooks.slack.com/•••"
    assert "secret" not in masked


def test_integration_test_send(client, monkeypatch):
    calls = []
    monkeypatch.setattr(providers_mod, "http_post_json", lambda url, payload, timeout=None: calls.append(url) or 200)

    token, org_id = register_org(client)
    _configure_slack(client, token, org_id)
    resp = client.post(
        f"/api/v1/organizations/{org_id}/integrations/slack/test",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert len(calls) == 1


def test_incident_dispatches_to_provider(client, monkeypatch):
    posted = []
    monkeypatch.setattr(providers_mod, "http_post_json", lambda url, payload, timeout=None: posted.append(payload) or 200)

    token, org_id = register_org(client)
    _configure_slack(client, token, org_id, min_severity="INFO")

    # Generate an incident through the real pipeline (inline demo).
    client.post(
        f"/api/v1/organizations/{org_id}/demo/simulate/error-burst?count=120&apps=1",
        headers={"Authorization": f"Bearer {token}"},
    )

    # At least one Slack delivery happened, and it's recorded per-channel.
    assert len(posted) >= 1
    db = SessionLocal()
    try:
        slack_logs = db.scalars(
            select(NotificationLog).where(
                NotificationLog.organization_id == org_id, NotificationLog.channel == "slack"
            )
        ).all()
        assert len(slack_logs) >= 1
    finally:
        db.close()


def test_provider_failure_is_isolated(client, monkeypatch):
    def boom(url, payload, timeout=None):
        raise ConnectionError("slack down")

    monkeypatch.setattr(providers_mod, "http_post_json", boom)
    token, org_id = register_org(client)
    _configure_slack(client, token, org_id, min_severity="INFO")

    # Pipeline must still succeed even though the provider errors.
    resp = client.post(
        f"/api/v1/organizations/{org_id}/demo/simulate/error-burst?count=60&apps=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["incidents"][0]["event_count"] == 60
