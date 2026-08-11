#!/usr/bin/env bash
# Send a single telemetry event with curl.
#   export MONITORING_API_KEY=th_...
#   ./examples/curl_telemetry.sh
set -euo pipefail

API_KEY="${MONITORING_API_KEY:?set MONITORING_API_KEY}"
ENDPOINT="${TELEMETRY_ENDPOINT:-http://localhost:8000}"

# Single event
curl -s -X POST "$ENDPOINT/api/v1/telemetry" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "service": "payment-api",
    "event_type": "log",
    "severity": "ERROR",
    "message": "Database connection timeout (password=hunter2 will be redacted)",
    "region": "india",
    "metadata": { "order_id": 42, "api_key": "sk_live_secret" }
  }'
echo

# Batch of events
curl -s -X POST "$ENDPOINT/api/v1/telemetry/batch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "events": [
      { "service": "payment-api", "severity": "INFO",  "message": "startup" },
      { "service": "payment-api", "severity": "WARNING", "message": "slow query" }
    ]
  }'
echo
