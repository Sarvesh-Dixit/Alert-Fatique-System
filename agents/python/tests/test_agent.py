"""Agent unit tests: redaction, bounded buffer, collectors, metric prep."""
from telemetry_agent.buffer import LocalBuffer
from telemetry_agent.collectors import collect_metrics
from telemetry_agent.redact import REDACTED, redact, redact_text


def test_local_redaction():
    assert redact_text("db password=hunter2 ok") == f"db password={REDACTED} ok"
    out = redact({"api_key": "leak", "host": "db1"})
    assert out["api_key"] == REDACTED
    assert out["host"] == "db1"


def test_pii_redaction():
    assert "[EMAIL]" in redact_text("user bob@example.com logged in", redact_pii=True)


def test_buffer_is_bounded():
    buf = LocalBuffer(max_events=10)
    for i in range(100):
        buf.add({"i": i})
    assert len(buf) == 10


def test_buffer_take_and_requeue():
    buf = LocalBuffer(max_events=100)
    for i in range(5):
        buf.add({"i": i})
    taken = buf.take(5)
    assert len(taken) == 5
    buf.requeue(taken)
    assert len(buf) == 5


def test_collect_metrics_returns_items():
    # Works whether or not psutil is installed (guarded).
    events = collect_metrics({"collect_cpu": True, "collect_memory": True}, "host-1")
    assert isinstance(events, list) and len(events) >= 1
    assert all("service" in e for e in events)
