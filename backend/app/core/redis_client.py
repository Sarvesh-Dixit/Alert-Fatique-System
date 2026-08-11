"""Redis connection helpers and the telemetry stream abstraction.

The API only ever *produces* to the stream; the worker *consumes* from it.
Keeping this in one place means Phase 2 can swap the transport (e.g. Kafka)
without touching the API or worker business logic.
"""
from __future__ import annotations

import json
from functools import lru_cache

import redis

from app.config import settings


@lru_cache
def get_redis() -> redis.Redis:
    """Return a shared, decoded Redis client."""
    return redis.Redis.from_url(settings.redis_url, decode_responses=True)


def publish_event(event: dict) -> str:
    """Push a single canonical telemetry event onto the Redis Stream.

    The event dict is serialized under a single ``data`` field so arbitrary
    nested JSON survives the stream (which only stores flat string maps).
    Returns the generated stream entry ID.
    """
    r = get_redis()
    return r.xadd(settings.telemetry_stream, {"data": json.dumps(event)})


def ensure_consumer_group() -> None:
    """Create the consumer group if it does not already exist (idempotent)."""
    r = get_redis()
    try:
        r.xgroup_create(
            name=settings.telemetry_stream,
            groupname=settings.telemetry_consumer_group,
            id="0",
            mkstream=True,
        )
    except redis.ResponseError as exc:  # pragma: no cover - depends on redis state
        if "BUSYGROUP" not in str(exc):
            raise
