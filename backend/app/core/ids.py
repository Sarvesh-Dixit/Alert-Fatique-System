"""Prefixed identifier generation.

We use human-readable, prefixed IDs (e.g. ``org_ab12...``) rather than raw
UUIDs. They are self-describing in logs and the dashboard while remaining
globally unique. This keeps the canonical telemetry schema language-neutral.
"""
import uuid


def new_id(prefix: str) -> str:
    """Return a new prefixed identifier, e.g. ``new_id("org")`` -> ``org_<hex>``."""
    return f"{prefix}_{uuid.uuid4().hex}"
