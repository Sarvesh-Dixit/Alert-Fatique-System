import json

from app.config import settings
from app.core.redaction import REDACTED
from tests.conftest import create_app_with_key, register_org


def _read_stream(fake_redis):
    entries = fake_redis.xrange(settings.telemetry_stream)
    return [json.loads(fields["data"]) for _id, fields in entries]


def test_ingest_returns_202_and_enqueues(client, fake_redis):
    token, org_id = register_org(client)
    _, api_key = create_app_with_key(client, token, org_id)

    resp = client.post(
        "/api/v1/telemetry",
        json={"service": "payment-api", "severity": "error", "message": "boom"},
        headers={"X-API-Key": api_key},
    )
    assert resp.status_code == 202
    assert resp.json()["accepted"] == 1

    events = _read_stream(fake_redis)
    assert len(events) == 1
    assert events[0]["service"] == "payment-api"
    assert events[0]["severity"] == "ERROR"  # normalized to upper
    assert events[0]["event_id"].startswith("evt_")
    assert events[0]["organization_id"] == org_id


def test_ingest_requires_api_key(client):
    resp = client.post("/api/v1/telemetry", json={"message": "x"})
    assert resp.status_code == 401


def test_ingest_invalid_api_key(client):
    resp = client.post(
        "/api/v1/telemetry", json={"message": "x"}, headers={"X-API-Key": "th_bad_key"}
    )
    assert resp.status_code == 401


def test_ingest_redacts_secrets(client, fake_redis):
    token, org_id = register_org(client)
    _, api_key = create_app_with_key(client, token, org_id)

    client.post(
        "/api/v1/telemetry",
        json={
            "message": "connecting with password=abc123",
            "metadata": {"api_key": "leaked", "host": "db1"},
        },
        headers={"X-API-Key": api_key},
    )
    event = _read_stream(fake_redis)[0]
    assert REDACTED in event["message"]
    assert event["metadata"]["api_key"] == REDACTED
    assert event["metadata"]["host"] == "db1"


def test_oversized_payload_rejected(client):
    token, org_id = register_org(client)
    _, api_key = create_app_with_key(client, token, org_id)

    big = "x" * (settings.max_payload_bytes + 100)
    resp = client.post(
        "/api/v1/telemetry",
        json={"message": big},
        headers={"X-API-Key": api_key},
    )
    assert resp.status_code == 413


def test_batch_ingest(client, fake_redis):
    token, org_id = register_org(client)
    _, api_key = create_app_with_key(client, token, org_id)

    resp = client.post(
        "/api/v1/telemetry/batch",
        json={"events": [{"message": "a"}, {"message": "b"}, {"message": "c"}]},
        headers={"X-API-Key": api_key},
    )
    assert resp.status_code == 202
    assert resp.json()["accepted"] == 3
    assert len(_read_stream(fake_redis)) == 3


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_per_minute", 3)
    token, org_id = register_org(client)
    _, api_key = create_app_with_key(client, token, org_id)

    # Send well above the limit so a minute-window rollover can't hide the 429.
    codes = [
        client.post(
            "/api/v1/telemetry", json={"message": "x"}, headers={"X-API-Key": api_key}
        ).status_code
        for _ in range(12)
    ]
    assert 429 in codes
