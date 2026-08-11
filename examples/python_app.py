"""Example application using the Telemetry Highway Python SDK.

Run:
    pip install -e sdks/python
    set MONITORING_API_KEY=th_...      (Windows: use `set`, *nix: `export`)
    python examples/python_app.py
"""
import os
import random
import time

from telemetry_sdk import Monitor

monitor = Monitor(
    api_key=os.getenv("MONITORING_API_KEY", "th_replace_me"),
    endpoint=os.getenv("TELEMETRY_ENDPOINT", "http://localhost:8000"),
    service="payment-api",
    environment="production",
    region="india",
    batch_size=5,
    flush_interval=2.0,
)

monitor.info("Application started", version="1.4.2")

for i in range(20):
    roll = random.random()
    if roll < 0.1:
        try:
            raise ConnectionError("Database connection timeout")
        except ConnectionError as exc:
            monitor.exception(exc, order_id=1000 + i)
    elif roll < 0.3:
        monitor.warning("High memory usage", memory_pct=round(80 + roll * 20, 1))
    else:
        monitor.info("Processed request", request_id=f"req_{i}", latency_ms=random.randint(5, 250))
    time.sleep(0.3)

# Demonstrate an arbitrary (future) event type.
monitor.event("metric", message="cpu_utilization", value=0.63)

monitor.flush()
monitor.close()
print("Done. Check the dashboard Telemetry Explorer.")
