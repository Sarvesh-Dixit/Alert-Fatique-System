"""The agent main loop: heartbeat + collect + redact + buffer + send."""
from __future__ import annotations

import logging
import signal
import time
from pathlib import Path

from telemetry_agent import __version__
from telemetry_agent.buffer import LocalBuffer
from telemetry_agent.client import GatewayClient
from telemetry_agent.collectors import collect_logs, collect_metrics, os_info
from telemetry_agent.config import AgentConfig
from telemetry_agent.redact import redact, redact_text

log = logging.getLogger("th-agent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [agent] %(levelname)s %(message)s")


class Agent:
    def __init__(self, config: AgentConfig):
        self.config = config
        self.client = GatewayClient(config.endpoint, config.credential)
        self.buffer = LocalBuffer(
            max_events=10_000,
            spill_path=Path.home() / ".telemetry-highway" / "buffer.jsonl",
        )
        self.running = True
        self._log_state: dict = {}
        self._info = os_info()

    def _policy(self) -> dict:
        return self.config.policy or {}

    def _prepare(self, item: dict, redact_pii: bool) -> dict:
        item["source_type"] = "agent"
        item["region"] = self.config.region
        if item.get("message"):
            item["message"] = redact_text(item["message"], redact_pii)
        item["metadata"] = redact(item.get("metadata", {}), redact_pii)
        return item

    def collect_once(self) -> None:
        policy = self._policy()
        redact_pii = policy.get("redact_pii", True)
        instance = self.config.hostname
        items = collect_metrics(policy, instance) + collect_logs(policy, instance, self._log_state)
        for item in items:
            self.buffer.add(self._prepare(item, redact_pii))

    def flush(self) -> None:
        batch = self.buffer.take(200)
        if not batch:
            return
        try:
            status = self.client.send_batch(batch)
            if status not in (200, 202):
                self.buffer.requeue(batch)
        except Exception as exc:  # noqa: BLE001 - retry later, never crash
            log.warning("send failed (%s); buffering %d events (dropped=%d)",
                        exc, len(batch), self.buffer.dropped)
            self.buffer.requeue(batch)

    def refresh_policy(self) -> None:
        try:
            cfg = self.client.fetch_config()
            self.config.policy = cfg.get("config", self.config.policy)
        except Exception as exc:  # noqa: BLE001
            log.debug("policy refresh failed: %s", exc)

    def heartbeat(self) -> None:
        try:
            body = self.client.heartbeat(__version__, self._info.get("os_version", ""))
            if body.get("config"):
                self.config.policy = body["config"]
        except Exception as exc:  # noqa: BLE001
            log.debug("heartbeat failed: %s", exc)

    def run(self) -> None:  # pragma: no cover - long-running loop
        signal.signal(signal.SIGINT, self._stop)
        signal.signal(signal.SIGTERM, self._stop)

        self.refresh_policy()
        self.heartbeat()
        policy = self._policy()
        collect_interval = policy.get("collection_interval_seconds", 15)
        hb_interval = policy.get("heartbeat_interval_seconds", 30)

        log.info("Agent %s started for %s (endpoint=%s)", __version__, self.config.hostname, self.config.endpoint)
        last_hb = 0.0
        while self.running:
            now = time.time()
            if now - last_hb >= hb_interval:
                self.heartbeat()
                last_hb = now
            self.collect_once()
            self.flush()
            time.sleep(max(1, collect_interval))

        self.buffer.flush_to_disk()
        log.info("Agent stopped; %d events spilled to disk", len(self.buffer))

    def _stop(self, *_a):  # pragma: no cover
        self.running = False
