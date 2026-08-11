"""Local secret/PII redaction — runs on the host before telemetry is sent."""
from __future__ import annotations

import re
from typing import Any

REDACTED = "[REDACTED]"

SENSITIVE_KEYS = {
    "password", "passwd", "pwd", "secret", "api_key", "apikey", "access_token",
    "refresh_token", "authorization", "auth", "token", "client_secret", "private_key",
}

_INLINE = re.compile(r"(?i)\b(" + "|".join(map(re.escape, SENSITIVE_KEYS)) + r")\b(\s*[=:]\s*)(\S+)")

# Optional PII patterns (enabled when policy.redact_pii is true).
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_CARD = re.compile(r"\b(?:\d[ -]*?){13,16}\b")


def redact_text(text: str, redact_pii: bool = True) -> str:
    if not text:
        return text
    out = _INLINE.sub(lambda m: f"{m.group(1)}{m.group(2)}{REDACTED}", text)
    if redact_pii:
        out = _EMAIL.sub("[EMAIL]", out)
        out = _CARD.sub("[CARD]", out)
    return out


def redact(value: Any, redact_pii: bool = True) -> Any:
    if isinstance(value, dict):
        return {
            k: (REDACTED if k.strip().lower().replace("-", "_") in SENSITIVE_KEYS
                else redact(v, redact_pii))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [redact(v, redact_pii) for v in value]
    if isinstance(value, str):
        return redact_text(value, redact_pii)
    return value
