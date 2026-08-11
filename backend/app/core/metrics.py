"""Lightweight platform self-observability counters (Redis-backed).

The platform monitors itself: ingestion rate, redactions, rate-limit
violations, notification failures, dropped events, worker processing. These are
cheap Redis counters (fail-safe: a Redis hiccup never breaks a request).

Counters are namespaced per organization where relevant, plus global ones for
the internal health dashboard.
"""
from __future__ import annotations

import time

from app.core import redis_client

_PREFIX = "metrics"


def _safe(fn):
    try:
        return fn()
    except Exception:  # noqa: BLE001 - metrics are best-effort
        return None


def incr(name: str, amount: int = 1, organization_id: str | None = None) -> None:
    """Increment a global counter and (optionally) a per-org counter."""
    def _do():
        r = redis_client.get_redis()
        pipe = r.pipeline()
        pipe.incrby(f"{_PREFIX}:global:{name}", amount)
        if organization_id:
            pipe.incrby(f"{_PREFIX}:org:{organization_id}:{name}", amount)
        # Per-minute bucket for rate calculations (10 min TTL).
        minute = int(time.time() // 60)
        pipe.incrby(f"{_PREFIX}:rate:{name}:{minute}", amount)
        pipe.expire(f"{_PREFIX}:rate:{name}:{minute}", 600)
        pipe.execute()

    _safe(_do)


def get_counter(name: str, organization_id: str | None = None) -> int:
    def _do():
        r = redis_client.get_redis()
        key = f"{_PREFIX}:org:{organization_id}:{name}" if organization_id else f"{_PREFIX}:global:{name}"
        val = r.get(key)
        return int(val) if val else 0

    return _safe(_do) or 0


def get_rate_per_minute(name: str, minutes: int = 5) -> float:
    """Average per-minute rate over the last ``minutes`` buckets."""
    def _do():
        r = redis_client.get_redis()
        now_min = int(time.time() // 60)
        keys = [f"{_PREFIX}:rate:{name}:{now_min - i}" for i in range(minutes)]
        vals = r.mget(keys)
        total = sum(int(v) for v in vals if v)
        return round(total / minutes, 2)

    return _safe(_do) or 0.0
