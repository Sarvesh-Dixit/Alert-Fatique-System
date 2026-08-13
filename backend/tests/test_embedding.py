from __future__ import annotations

from datetime import datetime, timezone
import pytest
from app.intelligence import embedding as embedding_mod
from app.intelligence.embedding import TraceEmbeddingEngine, compute_similarity
from app.models.incident import ErrorGroup
from app.models.telemetry import TelemetryEvent
from app.worker.processor import process_event


def _event(event_id: str, message: str) -> dict:
    return {
        "event_id": event_id,
        "organization_id": "org_test",
        "application_id": "app_test",
        "service": "test-service",
        "source_type": "application",
        "environment": "production",
        "region": "india",
        "event_type": "log",
        "severity": "ERROR",
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "received_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {},
    }


def test_cosine_similarity_calculation():
    """Verify that compute_similarity correctly computes cosine similarity."""
    vec1 = [1.0, 0.0, 0.0]
    vec2 = [0.0, 1.0, 0.0]
    # Orthogonal vectors should have 0 similarity
    assert abs(compute_similarity(vec1, vec2)) < 1e-6

    vec3 = [1.0, 2.0, 3.0]
    vec4 = [2.0, 4.0, 6.0]
    # Collinear vectors should have 1 similarity
    assert abs(compute_similarity(vec3, vec4) - 1.0) < 1e-6


def test_embedding_generation():
    """Verify that TraceEmbeddingEngine can generate embeddings."""
    text = "Database connection refused at 10.0.0.1:5432"
    emb = TraceEmbeddingEngine.get_embedding(text)
    assert isinstance(emb, list)
    assert len(emb) > 0
    assert all(isinstance(x, float) for x in emb)


def test_semantic_grouping_similarity(db_session, monkeypatch):
    """Verify that similar error messages cluster into the same error group via GPTrace."""
    # Mock compute_similarity to return 0.9 (>= 0.88 threshold)
    monkeypatch.setattr(embedding_mod, "compute_similarity", lambda v1, v2: 0.90)

    # First error event
    msg1 = "Database connection refused at 10.0.0.1:5432"
    event1 = _event("evt_sim1", msg1)
    
    # Process first event
    row1 = process_event(db_session, event1, commit=False)
    db_session.flush()

    # Query the created ErrorGroup
    groups_after_1 = db_session.query(ErrorGroup).all()
    assert len(groups_after_1) == 1
    g1 = groups_after_1[0]
    assert g1.sample_message == msg1
    original_fp = g1.fingerprint

    # Second error event (different string hash/regex, but semantically similar)
    msg2 = "Failed to connect to Postgres primary node"
    event2 = _event("evt_sim2", msg2)

    # Process second event
    row2 = process_event(db_session, event2, commit=False)
    db_session.flush()

    # Query ErrorGroups again
    groups_after_2 = db_session.query(ErrorGroup).all()
    # It should still be exactly 1 error group because they matched semantically!
    assert len(groups_after_2) == 1
    g2 = groups_after_2[0]
    
    # Verify both TelemetryEvents are mapped to the same fingerprint/group
    assert row2.fingerprint == original_fp
    assert g2.event_count == 2


def test_fallback_to_exact_hashing(db_session, monkeypatch):
    """Verify that if similarity < 0.88, events fall back to exact fingerprint hashing."""
    # Mock compute_similarity to return 0.5 (< 0.88 threshold)
    monkeypatch.setattr(embedding_mod, "compute_similarity", lambda v1, v2: 0.50)

    # First error event
    msg1 = "Database connection refused at 10.0.0.1:5432"
    event1 = _event("evt_sim_fail1", msg1)
    
    row1 = process_event(db_session, event1, commit=False)
    db_session.flush()

    # Second error event (completely different semantic error)
    msg2 = "Out of memory error in user service"
    event2 = _event("evt_sim_fail2", msg2)

    row2 = process_event(db_session, event2, commit=False)
    db_session.flush()

    # Should create 2 distinct error groups
    groups = db_session.query(ErrorGroup).all()
    assert len(groups) == 2
    assert row1.fingerprint != row2.fingerprint
