"""Pytest fixtures.

Uses a file-based SQLite database and an in-memory fakeredis instance so the
whole ingestion pipeline can be exercised without external services.
"""
import os

# Configure the environment BEFORE importing any app module (settings is cached
# at import time, and the SQLAlchemy engine is built from these values).
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_telemetry.db")
os.environ.setdefault("JWT_SECRET", "test-secret-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "600")
os.environ.setdefault("MAX_PAYLOAD_BYTES", "4096")

import fakeredis  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.core.rate_limit as rate_limit_mod  # noqa: E402
import app.core.redis_client as redis_mod  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.db_init import init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_db():
    """Fresh schema for every test."""
    Base.metadata.drop_all(bind=engine)
    init_db()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch):
    """Swap the real Redis client for an isolated fakeredis instance."""
    fake = fakeredis.FakeStrictRedis(decode_responses=True)

    def _get():
        return fake

    monkeypatch.setattr(redis_mod, "get_redis", _get)
    monkeypatch.setattr(rate_limit_mod, "get_redis", _get)
    # Create the consumer group on the fake stream.
    redis_mod.ensure_consumer_group()
    yield fake
    fake.flushall()


@pytest.fixture
def client(fake_redis):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def register_org(client, email="owner@example.com", org="Acme"):
    """Helper: register a user + org and return (token, org_id)."""
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "supersecret",
            "full_name": "Owner",
            "organization_name": org,
        },
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    org_id = me.json()["organizations"][0]["id"]
    return token, org_id


def create_app_with_key(client, token, org_id, name="Payment API"):
    """Helper: create an application and return (app_id, full_api_key)."""
    headers = {"Authorization": f"Bearer {token}"}
    app_resp = client.post(
        f"/api/v1/organizations/{org_id}/applications",
        json={"name": name, "environment": "production", "region": "india"},
        headers=headers,
    )
    app_id = app_resp.json()["id"]
    key_resp = client.post(
        f"/api/v1/applications/{app_id}/api-keys",
        json={"name": "default", "environment_scope": "production"},
        headers=headers,
    )
    return app_id, key_resp.json()["api_key"]
