"""Deterministic severity engine.

Computes an incident severity from multiple signals — source severity,
frequency (event count), affected instances, affected services, spike
multiplier, and environment. All thresholds are configurable via settings.

Examples
--------
* 1 error in development                       -> LOW/INFO
* 500 errors in production                     -> HIGH
* 10k errors across multiple prod services     -> CRITICAL
"""
from __future__ import annotations

from dataclasses import dataclass

from app.config import settings
from app.intelligence.normalize import max_severity, severity_rank


@dataclass
class SeveritySignals:
    source_severity: str
    event_count: int
    instance_count: int
    service_count: int
    spike_multiplier: float
    environment: str


def compute_severity(sig: SeveritySignals) -> str:
    """Return one of INFO | WARNING | ERROR | HIGH | CRITICAL."""
    is_prod = sig.environment.lower() in {"production", "prod"}

    # Start from the source severity (normalized ladder includes HIGH).
    severity = sig.source_severity.upper()
    if severity not in {"DEBUG", "INFO", "WARNING", "ERROR", "HIGH", "CRITICAL"}:
        severity = "INFO"

    # Non-production dampens: an error in dev is not an emergency.
    if not is_prod:
        # Cap at ERROR outside production regardless of volume.
        if severity_rank(severity) > severity_rank("ERROR"):
            severity = "ERROR"
        return severity

    # --- Production escalation rules (only escalate error-like signals) ---
    if severity_rank(severity) >= severity_rank("WARNING"):
        if sig.event_count >= settings.severity_high_event_count:
            severity = max_severity(severity, "HIGH")
        if sig.event_count >= settings.severity_critical_event_count:
            severity = max_severity(severity, "CRITICAL")
        if sig.instance_count >= settings.severity_critical_instance_count:
            severity = max_severity(severity, "CRITICAL")
        if sig.service_count >= settings.severity_critical_service_count:
            severity = max_severity(severity, "CRITICAL")
        if sig.spike_multiplier >= settings.spike_multiplier:
            severity = max_severity(severity, "HIGH")

    return severity
