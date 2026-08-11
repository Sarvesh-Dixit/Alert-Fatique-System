"""Unit tests for the deterministic intelligence primitives."""
from app.intelligence.fingerprint import compute_fingerprint, normalize_signature
from app.intelligence.normalize import normalize_event, normalize_severity
from app.intelligence.severity import SeveritySignals, compute_severity


def test_fingerprint_ignores_dynamic_values():
    a = normalize_event({"service": "db", "message": "Database connection failed for user 123"})
    b = normalize_event({"service": "db", "message": "Database connection failed for user 456"})
    assert compute_fingerprint(a) == compute_fingerprint(b)


def test_fingerprint_distinguishes_different_errors():
    a = normalize_event({"service": "db", "message": "Database connection failed"})
    b = normalize_event({"service": "db", "message": "Out of memory"})
    assert compute_fingerprint(a) != compute_fingerprint(b)


def test_fingerprint_masks_uuid_ip_and_numbers():
    sig = normalize_signature("failed 550e8400-e29b-41d4-a716-446655440000 from 10.0.0.1 code 42")
    assert "<uuid>" in sig and "<ip>" in sig and "<num>" in sig


def test_severity_alias_normalization():
    assert normalize_severity("warn") == "WARNING"
    assert normalize_severity("fatal") == "CRITICAL"
    assert normalize_severity(None) == "INFO"


def test_severity_engine_dev_vs_prod():
    dev = compute_severity(SeveritySignals("ERROR", 10000, 20, 5, 50.0, "development"))
    assert dev == "ERROR"  # capped outside production

    prod_high = compute_severity(SeveritySignals("ERROR", 500, 1, 1, 1.0, "production"))
    assert prod_high == "HIGH"

    prod_crit = compute_severity(SeveritySignals("ERROR", 10000, 10, 3, 20.0, "production"))
    assert prod_crit == "CRITICAL"
