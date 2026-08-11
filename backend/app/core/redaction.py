"""Basic secret redaction applied at ingestion time.

Phase 1 performs *obvious* redaction only. Phase 2 can extend this with
entropy-based detection, regex catalogs, and per-organization policies.
"""
from __future__ import annotations

import re
from typing import Any

REDACTED = "[REDACTED]"

# Field names that should always have their values redacted.
SENSITIVE_KEYS = {
    "password",
    "passwd",
    "pwd",
    "secret",
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "authorization",
    "auth",
    "token",
    "client_secret",
    "private_key",
}

# Inline ``key=value`` / ``key: value`` patterns inside free-text messages.
_INLINE_PATTERN = re.compile(
    r"(?i)\b(" + "|".join(map(re.escape, SENSITIVE_KEYS)) + r")\b(\s*[=:]\s*)(\S+)"
)


def redact_text(text: str) -> str:
    """Redact ``key=value`` secrets embedded in a free-text string."""
    if not text:
        return text
    return _INLINE_PATTERN.sub(lambda m: f"{m.group(1)}{m.group(2)}{REDACTED}", text)


def _is_sensitive_key(key: str) -> bool:
    normalized = key.strip().lower().replace("-", "_")
    return normalized in SENSITIVE_KEYS


def redact_mapping(data: Any) -> Any:
    """Recursively redact sensitive keys within dicts/lists and inline strings."""
    if isinstance(data, dict):
        return {
            k: (REDACTED if _is_sensitive_key(k) else redact_mapping(v))
            for k, v in data.items()
        }
    if isinstance(data, list):
        return [redact_mapping(item) for item in data]
    if isinstance(data, str):
        return redact_text(data)
    return data
