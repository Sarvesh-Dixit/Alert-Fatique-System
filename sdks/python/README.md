# Telemetry Highway — Python SDK

Dependency-free, failure-isolated telemetry client. If the platform is down,
your application keeps running; events are buffered (bounded) and dropped
gracefully rather than raising.

## Install

```bash
pip install -e sdks/python
```

## Usage

```python
import os
from telemetry_sdk import Monitor

monitor = Monitor(
    api_key=os.getenv("MONITORING_API_KEY"),
    endpoint="http://localhost:8000",
    service="payment-api",
    environment="production",
    region="india",
)

monitor.info("Application started")
monitor.warning("High memory usage", memory_pct=91)
monitor.error("Database connection failed", db="primary")

try:
    1 / 0
except ZeroDivisionError as exc:
    monitor.exception(exc)

# Arbitrary future event types (metrics/traces/system/security)
monitor.event("metric", severity="INFO", message="cpu", value=0.72)

monitor.flush()   # block until buffer drains (optional)
monitor.close()   # flush + stop background worker (auto-called at exit)
```

## Guarantees

- Non-blocking: events are queued and sent from a background thread.
- Batched: events are grouped into `POST /api/v1/telemetry/batch`.
- Retried with backoff; permanent 4xx errors are dropped, not retried.
- Bounded buffer: oldest events are dropped when the buffer is full.
- Never raises from `info/warning/error/exception/event`.
