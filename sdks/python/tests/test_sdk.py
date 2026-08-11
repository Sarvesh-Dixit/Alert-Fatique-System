"""Tests for the Python SDK: delivery + failure isolation."""
import json
import time

import telemetry_sdk.client as client_mod
from telemetry_sdk import Monitor


def test_delivery_batches_events(monkeypatch):
    sent = []

    class _Resp:
        status = 202

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout=None):
        sent.append(json.loads(req.data.decode()))
        return _Resp()

    monkeypatch.setattr(client_mod.urllib.request, "urlopen", fake_urlopen)

    m = Monitor(api_key="th_test", endpoint="http://x", flush_interval=0.2, batch_size=2)
    m.info("one")
    m.error("two")
    m.flush(timeout=3)
    m.close()

    all_events = [e for batch in sent for e in batch["events"]]
    assert len(all_events) == 2
    assert {e["severity"] for e in all_events} == {"INFO", "ERROR"}


def test_failure_isolation_never_raises(monkeypatch):
    def boom(req, timeout=None):
        raise ConnectionRefusedError("platform down")

    monkeypatch.setattr(client_mod.urllib.request, "urlopen", boom)

    # Endpoint is effectively down. The application must not crash.
    m = Monitor(
        api_key="th_test",
        endpoint="http://localhost:59999",
        flush_interval=0.1,
        batch_size=1,
        max_retries=1,
    )
    m.info("still running")
    m.error("still running")
    time.sleep(0.5)
    m.close()  # returns cleanly despite all sends failing


def test_bounded_buffer_does_not_grow_unbounded():
    m = Monitor(api_key="th_test", endpoint="http://localhost:59999", max_buffer=10)
    # Stop the worker so the queue is not drained, then overflow it.
    m._stop.set()
    m._worker.join(timeout=2)
    for i in range(100):
        m.info(f"event {i}")
    assert m._queue.qsize() <= 10
