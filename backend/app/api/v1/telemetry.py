"""Secure telemetry ingestion gateway.

Pipeline (per spec section 9):
  authenticate -> identify org/app -> validate -> size limit -> redact
  -> add server metadata -> generate event_id -> push to Redis Stream
  -> return 202 quickly (no expensive DB work on the hot path).
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import authenticate_api_key
from app.config import settings
from app.core import metrics
from app.core.ids import new_id
from app.core.rate_limit import RateLimitExceeded, check_rate_limit
from app.core.redaction import redact_mapping, redact_text
from app.core.redis_client import publish_event
from app.database import get_db
from app.models._mixins import utcnow
from app.models.application import ApplicationApiKey
from app.schemas.telemetry import (
    IngestAccepted,
    TelemetryBatchIngest,
    TelemetryIngest,
)

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


async def _read_limited_body(request: Request) -> bytes:
    body = await request.body()
    if len(body) > settings.max_payload_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Payload exceeds {settings.max_payload_bytes} bytes",
        )
    return body


def _canonicalize(item: TelemetryIngest, key: ApplicationApiKey) -> dict:
    """Turn a validated ingest item into a canonical, redacted event dict."""
    raw_message = item.message
    redacted_message = redact_text(raw_message) if raw_message else raw_message
    raw_metadata = item.metadata or {}
    redacted_metadata = redact_mapping(raw_metadata)

    # Count redactions for the security dashboard (message + metadata changed).
    if (raw_message and redacted_message != raw_message) or (redacted_metadata != raw_metadata):
        metrics.incr("redactions", organization_id=key.organization_id)

    event = {
        "event_id": item.event_id or new_id("evt"),
        "organization_id": key.organization_id,
        "application_id": key.application_id,
        "service": item.service,
        "source_type": item.source_type,
        # Fall back to the key's environment scope when the client omits it.
        "environment": item.environment or key.environment_scope,
        "region": item.region,
        "event_type": item.event_type,
        "severity": (item.severity or "INFO").upper(),
        "message": redacted_message,
        "timestamp": (item.timestamp or utcnow()).isoformat(),
        "received_at": datetime.now(timezone.utc).isoformat(),
        "metadata": redacted_metadata,
        # Phase 2 placeholders travel through the pipeline as nulls.
        "fingerprint": None,
        "incident_id": None,
        "correlation_id": None,
    }
    metrics.incr("ingested", organization_id=key.organization_id)
    return event


def _touch_key(db: Session, key: ApplicationApiKey) -> None:
    key.last_used_at = datetime.now(timezone.utc)
    db.commit()


@router.post("", response_model=IngestAccepted, status_code=status.HTTP_202_ACCEPTED)
async def ingest(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    key = authenticate_api_key(db, authorization=authorization, x_api_key=x_api_key)

    try:
        check_rate_limit(f"apikey:{key.id}", organization_id=key.organization_id)
    except RateLimitExceeded as exc:
        response.headers["Retry-After"] = str(exc.retry_after)
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded")

    body = await _read_limited_body(request)
    try:
        item = TelemetryIngest.model_validate_json(body)
    except ValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, exc.errors())

    event = _canonicalize(item, key)
    publish_event(event)
    _touch_key(db, key)

    return IngestAccepted(accepted=1, event_ids=[event["event_id"]])


@router.post("/batch", response_model=IngestAccepted, status_code=status.HTTP_202_ACCEPTED)
async def ingest_batch(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    key = authenticate_api_key(db, authorization=authorization, x_api_key=x_api_key)

    try:
        check_rate_limit(f"apikey:{key.id}", organization_id=key.organization_id)
    except RateLimitExceeded as exc:
        response.headers["Retry-After"] = str(exc.retry_after)
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded")

    body = await _read_limited_body(request)
    try:
        batch = TelemetryBatchIngest.model_validate_json(body)
    except ValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, exc.errors())

    if len(batch.events) > settings.max_batch_size:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Batch exceeds {settings.max_batch_size} events",
        )

    event_ids: list[str] = []
    for item in batch.events:
        event = _canonicalize(item, key)
        publish_event(event)
        event_ids.append(event["event_id"])

    _touch_key(db, key)
    return IngestAccepted(accepted=len(event_ids), event_ids=event_ids)
