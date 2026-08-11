"""Agent configuration: persisted credential + endpoint, plus remote policy."""
from __future__ import annotations

import json
import os
import platform
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_CONFIG_PATH = Path(
    os.getenv("TH_AGENT_CONFIG", str(Path.home() / ".telemetry-highway" / "agent.json"))
)


@dataclass
class AgentConfig:
    endpoint: str = "http://localhost:8000"
    credential: str = ""            # device credential (th_...), stored locally only
    device_id: str = ""
    hostname: str = field(default_factory=platform.node)
    region: str | None = None
    # Remote policy (fetched from /agent/config); sensible local defaults.
    policy: dict = field(default_factory=dict)

    @classmethod
    def load(cls, path: Path | None = None) -> "AgentConfig":
        path = path or DEFAULT_CONFIG_PATH
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return cls(**{k: data.get(k, getattr(cls, k, None)) for k in
                          ("endpoint", "credential", "device_id", "hostname", "region", "policy")})
        return cls()

    def save(self, path: Path | None = None) -> None:
        path = path or DEFAULT_CONFIG_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.__dict__, indent=2), encoding="utf-8")
        # Credential is sensitive — restrict file permissions where supported.
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
