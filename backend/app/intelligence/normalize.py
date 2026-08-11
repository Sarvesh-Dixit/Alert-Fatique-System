"""Telemetry normalization.

Produces a predictable internal structure from a canonical event before the
intelligence pipeline runs. Does NOT change the external SDK contract — it only
fills defaults and derives helper fields (normalized severity, instance id,
error class) used by fingerprinting/grouping/severity.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

# Map raw/source severities onto the internal ladder.
_SEVERITY_ALIASES = {
    "TRACE": "DEBUG",
    "DEBUG": "DEBUG",
    "INFO": "INFO",
    "INFORMATION": "INFO",
    "NOTICE": "INFO",
    "WARN": "WARNING",
    "WARNING": "WARNING",
    "ERR": "ERROR",
    "ERROR": "ERROR",
    "HIGH": "HIGH",
    "CRIT": "CRITICAL",
    "CRITICAL": "CRITICAL",
    "FATAL": "CRITICAL",
    "EMERGENCY": "CRITICAL",
}

# Ordered ladder (low -> high) for comparisons.
SEVERITY_ORDER = ["DEBUG", "INFO", "WARNING", "ERROR", "HIGH", "CRITICAL"]


def normalize_severity(value: str | None) -> str:
    if not value:
        return "INFO"
    return _SEVERITY_ALIASES.get(value.strip().upper(), "INFO")


def severity_rank(value: str) -> int:
    try:
        return SEVERITY_ORDER.index(value.upper())
    except ValueError:
        return SEVERITY_ORDER.index("INFO")


def max_severity(a: str, b: str) -> str:
    return a if severity_rank(a) >= severity_rank(b) else b


def parse_dt(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if value:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


# Common patterns for extracting an error class from a message.
_ERROR_CLASS_RE = re.compile(r"([A-Z][A-Za-z0-9]*(?:Error|Exception|Timeout|Failure|Warning))")


def derive_error_class(message: str | None, metadata: dict) -> str | None:
    """Best-effort error class, e.g. ``ConnectionError`` / ``TimeoutError``."""
    if metadata.get("exception_type"):
        return str(metadata["exception_type"])
    if message:
        m = _ERROR_CLASS_RE.search(message)
        if m:
            return m.group(1)
    return None


def derive_instance(event: dict) -> str | None:
    """Identify the emitting instance/host from metadata (for correlation)."""
    md = event.get("metadata") or {}
    for key in ("instance", "instance_id", "host", "hostname", "pod", "node", "server"):
        if md.get(key):
            return str(md[key])
    return None


def normalize_event(event: dict) -> dict:
    """Return a normalized copy of a canonical event with helper fields."""
    metadata = event.get("metadata") or {}
    severity = normalize_severity(event.get("severity"))
    message = (event.get("message") or "").strip()

    normalized = dict(event)
    normalized["severity"] = severity
    normalized["service"] = event.get("service") or "unknown"
    normalized["environment"] = event.get("environment") or "production"
    normalized["source_type"] = event.get("source_type") or "application"
    normalized["event_type"] = event.get("event_type") or "log"
    normalized["message"] = message
    normalized["timestamp"] = parse_dt(event.get("timestamp"))
    normalized["_instance"] = derive_instance(event)
    normalized["_error_class"] = derive_error_class(message, metadata)
    return normalized
