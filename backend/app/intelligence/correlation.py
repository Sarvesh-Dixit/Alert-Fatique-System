"""Deterministic, rule-based incident correlation.

Goal (spec §8, §12): recognize that the *same operational problem* observed
across many instances, services, or applications is ONE incident — not N.

Correlation key
---------------
Two error groups belong to the same incident when they share a
**correlation key** and occur within the correlation window:

    (organization_id, environment, correlation_family)

``correlation_family`` is the error class when available (e.g.
``ConnectionError``), otherwise the fingerprint. This makes multi-instance and
multi-service/app failures of the same kind collapse into a single incident,
while unrelated errors stay separate.

A small, explicit rule table lets operators declare that *different* error
families co-occurring (e.g. DB failure + API timeout + payment failure) should
be treated as one incident. Rules are deterministic — no LLM involved. AI can
later propose new rules or summaries on top of this.
"""
from __future__ import annotations

import hashlib

from app.config import settings

# Explicit correlation rules: each set of families maps to a shared "theme".
# Deterministic and configurable. Default includes a common outage pattern.
CORRELATION_RULES: list[tuple[str, set[str]]] = [
    (
        "backend-outage",
        {"connectionerror", "timeouterror", "operationalerror", "database", "connectiontimeout"},
    ),
    (
        "hdfs-outage",
        {
            "ioexception",
            "sockettimeoutexception",
            "verificationexception",
            "redundantblockrequest",
            "blocknotfoundexception",
            "invalidblockexception",
            "directoryscannererror",
        },
    ),
]


def correlation_family(error_class: str | None, fingerprint: str) -> str:
    """Return the family token used for correlation."""
    if error_class:
        fam = error_class.strip().lower()
        for theme, members in CORRELATION_RULES:
            if fam in members:
                return f"rule:{theme}"
        return f"class:{fam}"
    return f"fp:{fingerprint}"


def correlation_key(organization_id: str, environment: str | None, family: str) -> str:
    """Deterministic correlation id derived from org + environment + family."""
    basis = f"{organization_id}|{(environment or 'production').lower()}|{family}"
    digest = hashlib.sha256(basis.encode("utf-8")).hexdigest()[:24]
    return f"corr_{digest}"


def within_window(seconds_apart: float) -> bool:
    return seconds_apart <= settings.correlation_window_seconds
