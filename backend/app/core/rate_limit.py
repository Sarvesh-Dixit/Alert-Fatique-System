"""Redis-backed fixed-window rate limiter.

Simple and predictable for Phase 1. Phase 2 can replace the window strategy
(e.g. sliding window / token bucket) behind the same ``check`` interface.
"""
from __future__ import annotations

import time

from app.config import settings
from app.core.redis_client import get_redis


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__("Rate limit exceeded")


def check_rate_limit(identifier: str, limit: int | None = None, organization_id: str | None = None) -> None:
    """Increment the counter for ``identifier`` within the current minute.

    Raises :class:`RateLimitExceeded` when the limit is exceeded.
    """
    limit = limit or settings.rate_limit_per_minute
    window = int(time.time() // 60)
    key = f"ratelimit:{identifier}:{window}"

    r = get_redis()
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, 60)
    count, _ = pipe.execute()

    if int(count) > limit:
        from app.core import metrics

        metrics.incr("rate_limit_violations", organization_id=organization_id)
        raise RateLimitExceeded(retry_after=60 - int(time.time()) % 60)
