"""End-to-end: SDK-style ingest -> Redis -> worker -> PostgreSQL -> dashboard."""
import json

from app.config import settings
from app.database import SessionLocal
from app.worker.processor import process_event
from tests.conftest import create_app_with_key, register_org


def _drain_worker(fake_redis):
    """Simulate the worker: consume the stream and persist each event."""
    group = settings.telemetry_consumer_group
    resp = fake_redis.xreadgroup(group, "test-worker", {settings.telemetry_stream: ">"}, count=100)
    db = SessionLocal()
    try:
        for _stream, entries in resp or []:
            for entry_id, fields in entries:
                process_event(db, json.loads(fields["data"]))
                fake_redis.xack(settings.telemetry_stream, group, entry_id)
    finally:
        db.close()


def test_full_pipeline(client, fake_redis):
    token, org_id = register_org(client)
    headers = {"Authorization": f"Bearer {token}"}
    app_id, api_key = create_app_with_key(client, token, org_id)

    # 1. Application sends telemetry through the gateway.
    for i in range(3):
        r = client.post(
            "/api/v1/telemetry",
            json={
                "service": "payment-api",
                "severity": "ERROR" if i == 0 else "INFO",
                "message": f"event {i}",
                "region": "india",
            },
            headers={"X-API-Key": api_key},
        )
        assert r.status_code == 202

    # 2. Worker moves events from Redis into PostgreSQL.
    _drain_worker(fake_redis)

    # 3. Events are visible in the Telemetry Explorer (dashboard read path).
    events = client.get(
        f"/api/v1/organizations/{org_id}/telemetry", headers=headers
    ).json()
    assert len(events) == 3
    assert {e["service"] for e in events} == {"payment-api"}

    # 4. Filtering works.
    errors = client.get(
        f"/api/v1/organizations/{org_id}/telemetry?severity=ERROR", headers=headers
    ).json()
    assert len(errors) == 1

    # 5. Application stats reflect the ingested data.
    stats = client.get(f"/api/v1/applications/{app_id}/stats", headers=headers).json()
    assert stats["total_events"] == 3
    assert stats["error_count"] == 1
