"""Bounded local buffer with retry backoff and dropped-event accounting.

If the platform is unavailable, events are held in a size-capped in-memory
buffer (spilled to disk optionally). The agent must never consume unbounded
disk/memory, so the oldest events are dropped once the cap is reached.
"""
from __future__ import annotations

import collections
import json
import threading
from pathlib import Path


class LocalBuffer:
    def __init__(self, max_events: int = 10_000, spill_path: Path | None = None):
        self.max_events = max_events
        self.spill_path = spill_path
        self._dq: collections.deque = collections.deque(maxlen=max_events)
        self._lock = threading.Lock()
        self.dropped = 0
        self._load_spill()

    def _load_spill(self) -> None:
        if self.spill_path and self.spill_path.exists():
            try:
                for line in self.spill_path.read_text(encoding="utf-8").splitlines():
                    if line.strip():
                        self._dq.append(json.loads(line))
                self.spill_path.unlink()
            except Exception:  # noqa: BLE001
                pass

    def add(self, event: dict) -> None:
        with self._lock:
            if len(self._dq) >= self.max_events:
                self.dropped += 1  # deque(maxlen) drops oldest automatically
            self._dq.append(event)

    def take(self, n: int) -> list[dict]:
        with self._lock:
            out = []
            for _ in range(min(n, len(self._dq))):
                out.append(self._dq.popleft())
            return out

    def requeue(self, events: list[dict]) -> None:
        """Put failed events back at the front (bounded)."""
        with self._lock:
            for ev in reversed(events):
                if len(self._dq) >= self.max_events:
                    self.dropped += 1
                    break
                self._dq.appendleft(ev)

    def __len__(self) -> int:
        with self._lock:
            return len(self._dq)

    def flush_to_disk(self, max_bytes: int = 8 * 1024 * 1024) -> None:
        """Persist buffered events to a single JSONL file, capped at ``max_bytes``.

        Rewrites (does not append) so repeated crashes cannot grow the file
        without bound. Newest events are prioritized when the cap would be
        exceeded — older events are dropped and counted.
        """
        if not self.spill_path:
            return
        with self._lock:
            if not self._dq:
                return
            self.spill_path.parent.mkdir(parents=True, exist_ok=True)
            # Serialize newest→oldest so we can truncate to the cap while
            # keeping the freshest events.
            payloads: list[str] = []
            total = 0
            for ev in reversed(self._dq):
                line = json.dumps(ev) + "\n"
                size = len(line.encode("utf-8"))
                if total + size > max_bytes:
                    self.dropped += 1
                    continue
                payloads.append(line)
                total += size
            payloads.reverse()  # restore chronological order on disk
            with self.spill_path.open("w", encoding="utf-8") as fh:
                fh.writelines(payloads)
