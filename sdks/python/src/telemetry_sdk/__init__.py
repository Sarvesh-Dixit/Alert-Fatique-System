"""Telemetry Highway Python SDK.

Dependency-free, failure-isolated telemetry client. Monitoring must never take
down the host application, so every network path swallows errors and falls back
to a bounded local buffer.
"""
from telemetry_sdk.client import Monitor

__all__ = ["Monitor"]
__version__ = "0.1.0"
