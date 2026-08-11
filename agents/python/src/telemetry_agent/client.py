"""HTTP client for the agent → gateway (uses only the device credential)."""
from __future__ import annotations

import json
import urllib.error
import urllib.request


class GatewayClient:
    def __init__(self, endpoint: str, credential: str, timeout: float = 5.0):
        self.endpoint = endpoint.rstrip("/")
        self.credential = credential
        self.timeout = timeout

    def _post(self, path: str, payload: dict) -> tuple[int, dict]:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.endpoint}{path}", data=data, method="POST",
            headers={"Content-Type": "application/json", "X-API-Key": self.credential},
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            body = resp.read().decode("utf-8") or "{}"
            return resp.status, json.loads(body)

    def _get(self, path: str) -> tuple[int, dict]:
        req = urllib.request.Request(
            f"{self.endpoint}{path}", method="GET", headers={"X-API-Key": self.credential}
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8") or "{}")

    def fetch_config(self) -> dict:
        _, body = self._get("/api/v1/agent/config")
        return body

    def heartbeat(self, agent_version: str, os_version: str) -> dict:
        _, body = self._post("/api/v1/agent/heartbeat",
                             {"agent_version": agent_version, "os_version": os_version})
        return body

    def send_batch(self, events: list[dict]) -> int:
        status, _ = self._post("/api/v1/telemetry/batch", {"events": events})
        return status


def enroll(endpoint: str, device_id: str, token: str, identity: dict) -> dict:
    """Exchange an enrollment token for a device credential (one-time)."""
    payload = {"device_id": device_id, "enrollment_token": token, **identity}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{endpoint.rstrip('/')}/api/v1/devices/enroll", data=data, method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))
