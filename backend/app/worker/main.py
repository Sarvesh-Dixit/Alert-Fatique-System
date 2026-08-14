"""Telemetry worker: consumes the Redis Stream and persists to PostgreSQL.

Run with:  python -m app.worker.main
"""
from __future__ import annotations

import json
import logging
import signal
import socket
import time

from redis.exceptions import ConnectionError as RedisConnectionError

from app.config import settings
from app.core.redis_client import ensure_consumer_group, get_redis
from app.database import SessionLocal
from app.worker.processor import process_event

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [worker] %(levelname)s %(message)s",
)
log = logging.getLogger("telemetry.worker")

_running = True


def _stop(*_args):  # pragma: no cover - signal handler
    global _running
    _running = False
    log.info("Shutdown signal received, finishing current batch...")


def run() -> None:  # pragma: no cover - long-running loop
    consumer_name = f"worker-{socket.gethostname()}-{int(time.time())}"
    stream = settings.telemetry_stream
    group = settings.telemetry_consumer_group

    # Wait for Redis to be reachable, then create the group.
    while _running:
        try:
            ensure_consumer_group()
            break
        except RedisConnectionError:
            log.warning("Redis not ready, retrying in 2s...")
            time.sleep(2)

    log.info("Worker '%s' consuming from '%s' (group '%s')", consumer_name, stream, group)
    r = get_redis()

    while _running:
        try:
            resp = r.xreadgroup(group, consumer_name, {stream: ">"}, count=50, block=2000)
        except RedisConnectionError:
            log.warning("Lost Redis connection, retrying...")
            time.sleep(2)
            continue

        if not resp:
            continue

        for _stream_name, entries in resp:
            for entry_id, fields in entries:
                _handle_entry(r, stream, group, entry_id, fields)


def _handle_entry(r, stream, group, entry_id, fields) -> None:
    db = SessionLocal()
    try:
        event = json.loads(fields["data"])
        process_event(db, event)
        r.xack(stream, group, entry_id)
    except Exception as exc:  # noqa: BLE001 - never let one bad event kill the worker
        log.exception("Failed to process entry %s", entry_id)
        from app.core import metrics

        metrics.incr("worker_failures")
        db.rollback()
        # Push the poison event onto the dead-letter stream (bounded) BEFORE
        # ack'ing the main stream. This prevents infinite retry loops while
        # keeping failed events recoverable for later inspection.
        try:
            r.xadd(
                settings.telemetry_dlq_stream,
                {
                    "data": fields.get("data", ""),
                    "error": str(exc)[:500],
                    "original_id": str(entry_id),
                },
                maxlen=settings.telemetry_dlq_max_len,
                approximate=True,
            )
        except Exception:  # noqa: BLE001
            log.warning("Could not write entry %s to DLQ", entry_id)
        r.xack(stream, group, entry_id)
    finally:
        db.close()


if __name__ == "__main__":
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)
    run()
