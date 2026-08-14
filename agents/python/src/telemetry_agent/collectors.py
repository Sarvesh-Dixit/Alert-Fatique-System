"""Read-only telemetry collectors: system metrics + logs.

All collectors are strictly read-only. Cross-platform metrics come from psutil
(guarded import so the agent still runs without it). Log collection is limited
to explicitly configured sources.
"""
from __future__ import annotations

import os
import platform
import time
from datetime import datetime, timezone

import logging

log = logging.getLogger("th-agent.collectors")

try:
    import psutil  # type: ignore

    _HAS_PSUTIL = True
except Exception:  # noqa: BLE001
    _HAS_PSUTIL = False

# Only surface the "psutil missing" warning as telemetry at most once per hour;
# every collection cycle otherwise would flood the gateway (~4 events/min).
_LAST_PSUTIL_WARN_AT: float = 0.0
_PSUTIL_WARN_INTERVAL_SECONDS: int = 3600


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def os_info() -> dict:
    return {
        "operating_system": platform.system().lower(),   # linux | windows | darwin
        "os_version": platform.version(),
        "hostname": platform.node(),
    }


def _severity_for_usage(pct: float) -> str:
    if pct >= 95:
        return "CRITICAL"
    if pct >= 90:
        return "HIGH"
    if pct >= 80:
        return "ERROR"
    if pct >= 70:
        return "WARNING"
    return "INFO"


def collect_metrics(policy: dict, instance: str) -> list[dict]:
    """Collect enabled system metrics as canonical-ish telemetry items."""
    if not _HAS_PSUTIL:
        global _LAST_PSUTIL_WARN_AT

        now = time.time()
        # Always log locally so operators notice; only forward telemetry once
        # per hour to avoid flooding the gateway with identical warnings.
        log.warning("psutil not installed; metric collection limited")
        if now - _LAST_PSUTIL_WARN_AT < _PSUTIL_WARN_INTERVAL_SECONDS:
            return []
        _LAST_PSUTIL_WARN_AT = now
        return [{
            "service": "host-agent", "event_type": "system", "severity": "WARNING",
            "message": "psutil not installed; metric collection limited",
            "metadata": {"instance": instance},
        }]

    events: list[dict] = []
    md_base = {"instance": instance}

    if policy.get("collect_cpu", True):
        cpu = psutil.cpu_percent(interval=0.2)
        events.append({
            "service": "host-cpu", "event_type": "metric", "severity": _severity_for_usage(cpu),
            "message": f"CPU utilization {cpu}%",
            "metadata": {**md_base, "cpu_percent": cpu},
        })
    if policy.get("collect_memory", True):
        mem = psutil.virtual_memory()
        events.append({
            "service": "host-memory", "event_type": "metric", "severity": _severity_for_usage(mem.percent),
            "message": f"Memory utilization {mem.percent}%",
            "metadata": {**md_base, "memory_percent": mem.percent, "available_mb": int(mem.available / 1e6)},
        })
    if policy.get("collect_disk", True):
        try:
            disk = psutil.disk_usage("/" if os.name != "nt" else "C:\\")
            events.append({
                "service": "host-disk", "event_type": "metric", "severity": _severity_for_usage(disk.percent),
                "message": f"Disk utilization {disk.percent}%",
                "metadata": {**md_base, "disk_percent": disk.percent, "free_gb": round(disk.free / 1e9, 1)},
            })
        except Exception:  # noqa: BLE001
            pass
    if policy.get("collect_network", True):
        net = psutil.net_io_counters()
        events.append({
            "service": "host-network", "event_type": "metric", "severity": "INFO",
            "message": "Network counters",
            "metadata": {**md_base, "bytes_sent": net.bytes_sent, "bytes_recv": net.bytes_recv},
        })
    if policy.get("collect_uptime", True):
        uptime = int(time.time() - psutil.boot_time())
        events.append({
            "service": "host-uptime", "event_type": "metric", "severity": "INFO",
            "message": f"Uptime {uptime}s",
            "metadata": {**md_base, "uptime_seconds": uptime},
        })
    if policy.get("collect_processes", True):
        count = len(psutil.pids())
        events.append({
            "service": "host-processes", "event_type": "metric", "severity": "INFO",
            "message": f"Process count {count}",
            "metadata": {**md_base, "process_count": count},
        })
    return events


def collect_logs(policy: dict, instance: str, state: dict) -> list[dict]:
    """Tail explicitly configured log files (read-only). Bounded per cycle.

    ``state`` holds per-path byte offsets across cycles. Windows Event Log and
    journald readers are documented extension points (guarded, opt-in).
    """
    events: list[dict] = []
    if not policy.get("collect_application_logs") and not policy.get("collect_system_logs"):
        return events

    for path in policy.get("log_paths", []) or []:
        try:
            if not os.path.exists(path):
                continue
            offset = state.get(path, 0)
            size = os.path.getsize(path)
            if size < offset:  # file rotated
                offset = 0
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                fh.seek(offset)
                lines = fh.readlines()[:500]  # bound per cycle
                state[path] = fh.tell()
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                sev = "ERROR" if ("error" in line.lower() or "fail" in line.lower()) else "INFO"
                events.append({
                    "service": os.path.basename(path), "event_type": "log", "severity": sev,
                    "message": line[:2000],
                    "metadata": {"instance": instance, "source": path},
                })
        except Exception:  # noqa: BLE001 - never let one log source break collection
            continue
    return events
