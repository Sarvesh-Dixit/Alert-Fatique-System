"""Security primitives: password hashing, JWT, and API key handling.

Design notes
------------
* Dashboard users authenticate with email/password and receive a JWT.
* Applications authenticate with a *scoped API key* of the form
  ``th_<prefix>_<secret>``. Only a SHA-256 hash of the full key is stored;
  the plaintext is shown exactly once, at creation time.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

API_KEY_PREFIX = "th"


# ---------------------------------------------------------------------------
# Password hashing (dashboard users)
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT (dashboard sessions)
# ---------------------------------------------------------------------------
def create_access_token(subject: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Decode a JWT. Raises ``jwt.PyJWTError`` on failure."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


# ---------------------------------------------------------------------------
# API keys (application telemetry credentials)
# ---------------------------------------------------------------------------
def generate_api_key() -> tuple[str, str, str]:
    """Generate a new API key.

    Returns a tuple of ``(full_key, key_prefix, key_hash)``:
      * ``full_key``   — shown to the user exactly once.
      * ``key_prefix`` — a short public identifier used for lookup + masking.
      * ``key_hash``   — SHA-256 hash stored in the database.
    """
    key_prefix = secrets.token_hex(4)          # 8 chars, public
    secret = secrets.token_urlsafe(32)         # the sensitive part
    full_key = f"{API_KEY_PREFIX}_{key_prefix}_{secret}"
    return full_key, key_prefix, hash_api_key(full_key)


def hash_api_key(full_key: str) -> str:
    """Deterministic SHA-256 hash used for storage + lookup."""
    return hashlib.sha256(full_key.encode("utf-8")).hexdigest()


def verify_api_key(full_key: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_api_key(full_key), stored_hash)


def mask_api_key(key_prefix: str) -> str:
    """Return a masked representation safe to show in the dashboard."""
    return f"{API_KEY_PREFIX}_{key_prefix}_{'•' * 8}"


def generate_enrollment_token() -> tuple[str, str]:
    """Short-lived device enrollment token. Returns ``(token, token_hash)``."""
    token = secrets.token_urlsafe(24)
    return token, hashlib.sha256(token.encode("utf-8")).hexdigest()
