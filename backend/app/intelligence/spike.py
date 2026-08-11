"""Sliding-window spike detection.

Deterministic frequency analysis using a Redis sorted set per fingerprint:
each event contributes a member scored by its epoch timestamp. We then compare
the *current-window* rate against the *baseline* rate.

    spike  <=>  current_count >= min_events
                AND current_rate > baseline_rate * multiplier

Fails safe: if Redis is unavailable, returns "no spike" so the core pipeline
keeps working.
"""
from __future__ import annotations

import time
from dataclasses import dataclass

from app.config import settings
from app.core import redis_client


@dataclass
class SpikeResult:
    is_spike: bool
    current_count: int
    current_rate: float      # events per minute in the current window
    baseline_rate: float     # events per minute across the baseline window
    multiplier: float        # current_rate / baseline_rate (0 if no baseline)


def _key(scope: str) -> str:
    return f"spike:{scope}"


def record_and_evaluate(scope: str, member: str, now: float | None = None) -> SpikeResult:
    """Record one occurrence for ``scope`` and evaluate the spike condition.

    ``scope`` is typically ``org:app:service:env:fingerprint``.
    ``member`` should be unique per event (the event_id).
    """
    now = now or time.time()
    window = settings.spike_window_seconds
    baseline = settings.spike_baseline_seconds
    min_events = settings.spike_min_events
    mult = settings.spike_multiplier

    key = _key(scope)
    try:
        r = redis_client.get_redis()
        pipe = r.pipeline()
        pipe.zadd(key, {member: now})
        pipe.zremrangebyscore(key, 0, now - baseline)        # drop stale
        pipe.expire(key, baseline + window)
        pipe.zcount(key, now - window, now)                  # current window
        pipe.zcount(key, now - baseline, now - window)       # older baseline
        results = pipe.execute()
        current_count = int(results[3])
        baseline_count = int(results[4])
    except Exception:  # noqa: BLE001 - fail safe, never break ingestion
        return SpikeResult(False, 0, 0.0, 0.0, 0.0)

    current_minutes = window / 60.0
    baseline_minutes = max((baseline - window) / 60.0, 1e-9)
    current_rate = current_count / current_minutes if current_minutes else 0.0
    baseline_rate = baseline_count / baseline_minutes

    if baseline_rate <= 0:
        multiplier = float(current_rate) if current_rate else 0.0
        is_spike = current_count >= min_events
    else:
        multiplier = current_rate / baseline_rate
        is_spike = current_count >= min_events and current_rate > baseline_rate * mult

    return SpikeResult(
        is_spike=is_spike,
        current_count=current_count,
        current_rate=round(current_rate, 2),
        baseline_rate=round(baseline_rate, 2),
        multiplier=round(multiplier, 2),
    )
