"""Failure-isolated telemetry client with background batching."""
from __future__ import annotations

import atexit
import json
import logging
import queue
import threading
import time
import traceback
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger("telemetry_sdk")

_SEVERITIES = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")


class Monitor:
    """Telemetry client.

    Parameters
    ----------
    api_key: str
        Scoped application API key (``th_...``).
    endpoint: str
        Base URL of the Telemetry Highway gateway, e.g. ``http://localhost:8000``.
    service: str | None
        Logical service name attached to every event.
    environment / region: str | None
        Optional scope hints. The gateway also has defaults per API key.
    batch_size: int
        Flush when this many events are buffered.
    flush_interval: float
        Max seconds between automatic flushes.
    max_buffer: int
        Hard cap on locally buffered events (oldest are dropped when full).
    timeout: float
        Per-request network timeout in seconds.
    max_retries: int
        Retry attempts per batch before events are dropped.
    """

    def __init__(
        self,
        api_key: str,
        endpoint: str = "http://localhost:8000",
        *,
        service: str | None = None,
        environment: str | None = None,
        region: str | None = None,
        source_type: str = "application",
        batch_size: int = 20,
        flush_interval: float = 5.0,
        max_buffer: int = 10_000,
        timeout: float = 5.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.service = service
        self.environment = environment
        self.region = region
        self.source_type = source_type
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.timeout = timeout
        self.max_retries = max_retries

        self._queue: queue.Queue = queue.Queue(maxsize=max_buffer)
        self._stop = threading.Event()
        self._worker = threading.Thread(target=self._run, name="telemetry-sdk", daemon=True)
        self._worker.start()
        atexit.register(self.close)

    # ------------------------------------------------------------------ API
    def log(self, severity: str, message: str, **metadata: Any) -> None:
        """Enqueue a log event. Never raises."""
        severity = severity.upper()
        if severity not in _SEVERITIES:
            severity = "INFO"
        self._enqueue(
            {
                "event_id": f"evt_{uuid.uuid4().hex}",
                "service": self.service,
                "source_type": self.source_type,
                "environment": self.environment,
                "region": self.region,
                "event_type": "log",
                "severity": severity,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": metadata or {},
            }
        )

    def debug(self, message: str, **md: Any) -> None:
        self.log("DEBUG", message, **md)

    def info(self, message: str, **md: Any) -> None:
        self.log("INFO", message, **md)

    def warning(self, message: str, **md: Any) -> None:
        self.log("WARNING", message, **md)

    def error(self, message: str, **md: Any) -> None:
        self.log("ERROR", message, **md)

    def critical(self, message: str, **md: Any) -> None:
        self.log("CRITICAL", message, **md)

    def exception(self, exc: BaseException, message: str | None = None, **md: Any) -> None:
        """Capture an exception with its traceback."""
        md = {
            **md,
            "exception_type": type(exc).__name__,
            "traceback": "".join(
                traceback.format_exception(type(exc), exc, exc.__traceback__)
            ),
        }
        self.log("ERROR", message or str(exc), **md)

    def event(self, event_type: str, severity: str = "INFO", message: str | None = None, **md: Any) -> None:
        """Emit an arbitrary event type (metric/trace/system/security)."""
        self._enqueue(
            {
                "event_id": f"evt_{uuid.uuid4().hex}",
                "service": self.service,
                "source_type": self.source_type,
                "environment": self.environment,
                "region": self.region,
                "event_type": event_type,
                "severity": severity.upper(),
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": md or {},
            }
        )

    def flush(self, timeout: float = 5.0) -> None:
        """Block until the current buffer is drained (best effort)."""
        deadline = time.time() + timeout
        while not self._queue.empty() and time.time() < deadline:
            time.sleep(0.05)

    def close(self) -> None:
        """Flush and stop the background worker."""
        if self._stop.is_set():
            return
        self._stop.set()
        try:
            self._worker.join(timeout=self.timeout + 1)
        except RuntimeError:  # pragma: no cover
            pass

    # -------------------------------------------------------------- internal
    def _enqueue(self, event: dict) -> None:
        try:
            self._queue.put_nowait(event)
        except queue.Full:
            # Buffer full: drop the oldest event to make room (bounded memory).
            try:
                self._queue.get_nowait()
                self._queue.put_nowait(event)
            except queue.Empty:  # pragma: no cover
                pass

    def _run(self) -> None:
        buffer: list[dict] = []
        last_flush = time.time()
        while not self._stop.is_set() or not self._queue.empty() or buffer:
            timeout = max(0.0, self.flush_interval - (time.time() - last_flush))
            try:
                buffer.append(self._queue.get(timeout=min(timeout, 1.0) or 0.1))
            except queue.Empty:
                pass

            due = (time.time() - last_flush) >= self.flush_interval
            if buffer and (len(buffer) >= self.batch_size or due or self._stop.is_set()):
                self._send_batch(buffer)
                buffer = []
                last_flush = time.time()

    def _send_batch(self, events: list[dict]) -> None:
        payload = json.dumps({"events": events}).encode("utf-8")
        url = f"{self.endpoint}/api/v1/telemetry/batch"
        headers = {"Content-Type": "application/json", "X-API-Key": self.api_key}

        for attempt in range(self.max_retries):
            try:
                req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    if 200 <= resp.status < 300:
                        return
            except urllib.error.HTTPError as e:
                # 4xx (except 429) won't be fixed by retrying — drop and move on.
                if e.code != 429 and 400 <= e.code < 500:
                    log.debug("telemetry dropped (%s): %s", e.code, e.reason)
                    return
            except Exception as e:  # noqa: BLE001 - monitoring must never crash the app
                log.debug("telemetry send failed: %s", e)
            time.sleep(min(2 ** attempt * 0.2, 2.0))
        log.debug("telemetry batch dropped after %d retries", self.max_retries)
