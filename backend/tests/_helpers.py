"""Shared helpers for Phase 3 tests."""
from __future__ import annotations

import json

from app.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.organization import OrganizationMember
from app.models.user import User
from app.worker.processor import process_event


def add_member(organization_id: str, email: str, role: str, password: str = "supersecret123") -> str:
    """Insert a user + membership with a given role. Returns user_id."""
    db = SessionLocal()
    try:
        user = User(email=email.lower(), full_name="Member", hashed_password=hash_password(password))
        db.add(user)
        db.flush()
        db.add(OrganizationMember(organization_id=organization_id, user_id=user.id, role=role))
        db.commit()
        return user.id
    finally:
        db.close()


def login(client, email: str, password: str = "supersecret123") -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def drain_stream(fake_redis) -> int:
    """Simulate the worker: consume the stream and persist each event."""
    group = settings.telemetry_consumer_group
    resp = fake_redis.xreadgroup(group, "test-worker", {settings.telemetry_stream: ">"}, count=10000)
    db = SessionLocal()
    processed = 0
    try:
        for _stream, entries in resp or []:
            for entry_id, fields in entries:
                process_event(db, json.loads(fields["data"]), commit=False)
                fake_redis.xack(settings.telemetry_stream, group, entry_id)
                processed += 1
        db.commit()
    finally:
        db.close()
    return processed
