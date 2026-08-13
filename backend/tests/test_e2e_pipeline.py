from __future__ import annotations

import pytest
from app.database import SessionLocal
from app.models.incident import Incident
from app.models.integration import Integration
from app.worker.processor import process_event
import app.notifications.base
from tests.conftest import create_app_with_key, register_org
from tests._helpers import drain_stream


def test_e2e_alert_fatigue_pipeline(client, fake_redis, db_session, monkeypatch):
    """End-to-end integration test:
    - Set up a mock Slack integration.
    - Ingest 500 semantically similar error traces.
    - Run the worker to drain the stream.
    - Assert grouping, notifications, and NRR metrics.
    """
    # 1. Mock the outbound webhook HTTP POST to avoid real network calls
    webhook_calls = []
    def mock_http_post(url, payload, timeout=None):
        webhook_calls.append((url, payload))
        return 200

    import app.notifications.base
    import app.notifications.providers
    monkeypatch.setattr(app.notifications.base, "http_post_json", mock_http_post)
    monkeypatch.setattr(app.notifications.providers, "http_post_json", mock_http_post)

    # 2. Register organization and application to get API key
    token, org_id = register_org(client)
    app_id, api_key = create_app_with_key(client, token, org_id)

    # 3. Create a Slack integration for the organization in the DB
    integration = Integration(
        organization_id=org_id,
        type="slack",
        enabled=True,
        min_severity="ERROR",
        config={"webhook_url": "https://hooks.slack.com/services/test/webhook/url"},
    )
    db_session.add(integration)
    db_session.commit()

    # 4. Ingest 500 semantically similar telemetry events
    # We will send "Database connection failed for user X" error logs.
    for i in range(500):
        resp = client.post(
            "/api/v1/telemetry",
            json={
                "service": "billing-api",
                "severity": "ERROR",
                "message": f"Database connection failed for user {1000 + i}",
                "region": "india",
                "metadata": {
                    "instance": f"db-node-{i % 3}",
                    "exception_type": "ConnectionError"
                }
            },
            headers={"X-API-Key": api_key},
        )
        assert resp.status_code == 202

    # 5. Run the worker (drain the Redis stream and process telemetry events)
    processed = drain_stream(fake_redis)
    assert processed == 500

    # 6. Verify database state
    db_session.rollback()  # Ensure session reads fresh state from SQLite
    incidents = db_session.query(Incident).filter(Incident.organization_id == org_id).all()
    # We assert that exactly 1 incident is created
    assert len(incidents) == 1
    incident = incidents[0]

    # Exactly 1 notification should be sent (the first event), and the other 499 events suppressed by cooldown
    assert incident.event_count == 500
    assert incident.notifications_sent == 1
    assert incident.events_suppressed == 499

    # Assert NRR > 99%
    assert incident.noise_reduction_ratio > 99.0

    # Assert that 1 webhook notification payload was dispatched
    assert len(webhook_calls) == 1
    url, payload = webhook_calls[0]
    assert url == "https://hooks.slack.com/services/test/webhook/url"

    # Verify that the Slack message payload formats the details nicely
    attachment = payload["attachments"][0]
    assert any(badge in attachment["title"] for badge in ["🚨", "🔴", "🟠", "🟡"])

    # Suppressed count and detail link
    fields = {f["title"]: f["value"] for f in attachment["fields"]}
    assert "Suppressed" in fields
    assert fields["Suppressed"] == "0"
    assert "Incident Details Link" in fields
