"""Deterministic error fingerprinting.

Two messages that differ only in dynamic values must produce the SAME
fingerprint, e.g.:

    "Database connection failed for user 123"
    "Database connection failed for user 456"
        -> same fingerprint

We normalize the message signature by replacing dynamic tokens (UUIDs, IPs,
numbers, hex, emails, quoted literals, request ids) with stable placeholders,
then hash ``service | event_type | error_class | signature``.

We deliberately keep meaningful words — only clearly dynamic tokens are masked.

If the GPTrace model (cosine similarity of trace embeddings >= 0.88) does not
find a match, we fall back to the exact fingerprint hashing defined here.
"""
from __future__ import annotations

import hashlib
import re

# Order matters: match more specific patterns before generic numbers.
_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"), "<uuid>"),
    (re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"), "<ip>"),
    (re.compile(r"\b[A-Fa-f0-9]{2}(?::[A-Fa-f0-9]{2}){5}\b"), "<mac>"),
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "<email>"),
    (re.compile(r"\bhttps?://[^\s]+"), "<url>"),
    (re.compile(r"\b[0-9a-fA-F]{16,}\b"), "<hex>"),               # long hex / tokens
    (re.compile(r"\b(?:req|request|trace|span|txn|order|user|session)[_-]?[a-zA-Z0-9]+\b", re.I), "<id>"),
    (re.compile(r"'[^']*'"), "<str>"),
    (re.compile(r'"[^"]*"'), "<str>"),
    (re.compile(r"\b\d+(?:\.\d+)?\b"), "<num>"),                  # numbers last
]

_WS_RE = re.compile(r"\s+")


def normalize_signature(message: str) -> str:
    """Collapse a message down to its stable structural signature."""
    sig = message or ""
    for pattern, repl in _PATTERNS:
        sig = pattern.sub(repl, sig)
    sig = _WS_RE.sub(" ", sig).strip().lower()
    return sig


def compute_fingerprint(normalized_event: dict) -> str:
    """Compute a stable 64-char hex fingerprint for a normalized event."""
    service = (normalized_event.get("service") or "unknown").lower()
    event_type = (normalized_event.get("event_type") or "log").lower()
    error_class = (normalized_event.get("_error_class") or "").lower()
    signature = normalize_signature(normalized_event.get("message") or "")

    # If there is no message at all, fall back to error class / event type so
    # empty events still group deterministically rather than each being unique.
    if not signature:
        signature = error_class or event_type

    basis = "|".join([service, event_type, error_class, signature])
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()


def build_title(normalized_event: dict) -> str:
    """Human-readable group/incident title derived from the event."""
    error_class = normalized_event.get("_error_class")
    message = normalized_event.get("message") or ""
    service = normalized_event.get("service") or "unknown"
    if message:
        short = message if len(message) <= 120 else message[:117] + "…"
        return short
    if error_class:
        return f"{error_class} in {service}"
    return f"{normalized_event.get('event_type', 'event')} in {service}"
