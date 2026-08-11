# 🛰️ Telemetry Highway — Phase 1

A secure, multi-tenant observability middleware platform. **Phase 1** delivers
the secure foundation and the telemetry ingestion pipeline that Phase 2
(fingerprinting, deduplication, spike detection, incidents) and Phase 3 (OS
monitoring agents) build on **without rewriting the architecture**.

```
Applications / Backend
        │  Python SDK / Node.js SDK
        ▼  HTTPS
Secure Telemetry Gateway (FastAPI)
  auth → authz → rate limit → validation → redaction
        ▼
Redis Stream  ──►  Telemetry Worker  ──►  PostgreSQL  ──►  Dashboard (React)
```

The API and the canonical telemetry schema are language-independent, so the
future OS agent flows through the **same** gateway and pipeline.

---

## Quick start (Docker)

```bash
cp .env.example .env          # adjust secrets if you like
docker compose up --build
```

| Service   | URL                            |
|-----------|--------------------------------|
| Dashboard | http://localhost:5173          |
| API       | http://localhost:8000          |
| API docs  | http://localhost:8000/docs     |
| Health    | http://localhost:8000/health   |

Then: open the dashboard → **Create account** (this also creates your first
organization) → **Create application** → **Manage API keys** → generate a key →
run an example app (below) → watch events appear in the **Telemetry Explorer**.

## Quick start (local, no Docker)

```bash
# 1. Start Postgres + Redis (docker is easiest)
docker compose up -d postgres redis

# 2. Backend
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements-dev.txt
set DATABASE_URL=postgresql+psycopg://telemetry:telemetry@localhost:5432/telemetry_highway
set REDIS_URL=redis://localhost:6379/0
python -m app.db_init                                # create tables
uvicorn app.main:app --reload                        # API on :8000

# 3. Worker (separate terminal, same env)
python -m app.worker.main

# 4. Frontend (separate terminal)
cd frontend && npm install && npm run dev            # dashboard on :5173
```

---

## Architecture summary

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| Dashboard | React + TypeScript + Vite + Tailwind (+ Recharts) | Org/app management, API keys, telemetry explorer, devices |
| Gateway | FastAPI + Pydantic | AuthN/Z, validation, rate limit, redaction, enqueue |
| Buffer | Redis Streams (consumer groups) | Decouple ingestion latency from processing |
| Worker | Python consumer | Persist canonical events; **Phase 2 hook point** |
| Store | PostgreSQL + SQLAlchemy | Canonical telemetry + tenant data |
| SDKs | Python (stdlib-only) + Node/TS | Failure-isolated, batched delivery |

**Key design decisions**

- The gateway returns **HTTP 202** and never performs DB writes on the hot
  path — the sending app is decoupled from processing latency.
- The worker's persistence logic lives in `app/worker/processor.py`, isolated
  from the transport so Phase 2 can insert fingerprint/dedup/correlation before
  the persist step.
- Canonical `telemetry_events` already carries nullable `fingerprint`,
  `incident_id`, `correlation_id` columns — Phase 2 needs **no schema rewrite**.
- Tenant isolation is enforced centrally in `app/api/deps.py`
  (`require_org_member`) — every org-scoped route funnels through it.

---

## Files created

```
.
├── docker-compose.yml            # postgres, redis, api, worker, frontend
├── .env.example                  # all environment variables
├── README.md                     # this file
├── backend/
│   ├── Dockerfile  requirements*.txt  pytest.ini
│   └── app/
│       ├── main.py               # FastAPI app + lifespan (create tables, group)
│       ├── config.py  database.py  db_init.py
│       ├── core/                 # ids, security, redaction, rate_limit,
│       │                         #   redis_client, audit
│       ├── models/               # organization, user, application, telemetry,
│       │                         #   device, audit
│       ├── schemas/              # pydantic request/response models
│       ├── api/deps.py           # auth + tenant-isolation dependencies
│       ├── api/v1/               # auth, organizations, applications,
│       │                         #   telemetry, explorer, devices
│       └── worker/               # processor.py (pure) + main.py (consumer loop)
│   └── tests/                    # auth, api_keys, isolation, redaction,
│                                 #   telemetry ingest, worker, devices, integration
├── sdks/
│   ├── python/                   # telemetry_sdk (stdlib-only) + tests
│   └── node/                     # @telemetry-highway/node (TS) + tests + middleware
├── frontend/                     # React dashboard (Vite + Tailwind)
└── examples/                     # python_app.py, node_app.mjs, curl_*
```

---

## Database schema

| Table | Purpose | Notable columns / indexes |
|-------|---------|---------------------------|
| `organizations` | Tenant root | `slug` unique |
| `users` | Dashboard users | `email` unique |
| `organization_members` | User↔Org with role | unique(`org_id`,`user_id`) |
| `applications` | Monitored apps | `organization_id` (idx) |
| `application_api_keys` | Scoped ingest creds | `key_prefix`/`key_hash` unique; `revoked_at`, `rotated_from`, `last_used_at` |
| `services` | Auto-registered per app | unique(`application_id`,`name`) |
| `telemetry_events` | **Canonical events** | idx on `(org,ts)`,`(app,ts)`,`severity`,`event_type`,`service`,`fingerprint` |
| `agent_devices` | OS agent registration | `status`, `last_heartbeat_at`, `enrollment_token_hash` |
| `audit_logs` | Security-sensitive actions | idx `(org, created_at)` |

`telemetry_events` includes **nullable** `fingerprint`, `incident_id`,
`correlation_id` reserved for Phase 2.

### Canonical telemetry event

```json
{
  "event_id": "evt_...",
  "organization_id": "org_...",
  "application_id": "app_...",
  "service": "payment-api",
  "source_type": "application",        // application | agent | system
  "environment": "production",
  "region": "india",
  "event_type": "log",                 // log | metric | trace | system | security
  "severity": "ERROR",
  "message": "Database connection timeout",
  "timestamp": "2026-01-01T00:00:00Z",
  "received_at": "2026-01-01T00:00:00Z",
  "metadata": {},
  "fingerprint": null,                 // Phase 2
  "incident_id": null,                 // Phase 2
  "correlation_id": null               // Phase 2
}
```

---

## API documentation

Base path: `/api/v1`. Interactive docs at `/docs`.

### Auth (dashboard, JWT)
| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/register` | Creates user + first org, returns JWT |
| POST | `/auth/login` | Returns JWT |
| GET  | `/auth/me` | Current user + organizations |

### Organizations
| Method | Path |
|--------|------|
| GET  | `/organizations` |
| POST | `/organizations?name=...` |

### Applications & API keys (JWT, org-scoped)
| Method | Path |
|--------|------|
| POST | `/organizations/{org_id}/applications` |
| GET  | `/organizations/{org_id}/applications` |
| GET  | `/applications/{app_id}` |
| GET  | `/applications/{app_id}/stats` |
| GET  | `/applications/{app_id}/api-keys` |
| POST | `/applications/{app_id}/api-keys` → returns plaintext **once** |
| POST | `/applications/{app_id}/api-keys/{key_id}/revoke` |
| POST | `/applications/{app_id}/api-keys/{key_id}/rotate` |

### Telemetry ingestion (API key, `X-API-Key` or `Authorization: Bearer`)
| Method | Path | Returns |
|--------|------|---------|
| POST | `/telemetry` | **202** `{accepted, event_ids}` |
| POST | `/telemetry/batch` | **202** `{accepted, event_ids}` |

### Telemetry Explorer (JWT, org-scoped)
`GET /organizations/{org_id}/telemetry` with filters:
`application_id, service, environment, severity, event_type, region, start, end, search, limit, offset`.

### Devices (Phase 3 foundation)
| Method | Path | Auth |
|--------|------|------|
| GET  | `/organizations/{org_id}/devices` | JWT |
| POST | `/organizations/{org_id}/devices` | JWT → returns enrollment token once |
| POST | `/devices/enroll` | enrollment token |
| POST | `/devices/heartbeat` | device id |

---

## SDK usage

**Python**
```python
from telemetry_sdk import Monitor
monitor = Monitor(api_key=os.getenv("MONITORING_API_KEY"), endpoint="http://localhost:8000",
                  service="payment-api", environment="production")
monitor.info("Application started")
monitor.error("Database connection failed")
try: risky()
except Exception as e: monitor.exception(e)
```

**Node.js / TypeScript**
```ts
import { Monitor } from "@telemetry-highway/node";
const monitor = new Monitor({ apiKey: process.env.MONITORING_API_KEY!, endpoint: "http://localhost:8000" });
monitor.info("Application started");
monitor.error("Database connection failed");
```

Both SDKs: batching, retry+backoff, timeout, bounded local buffer, and
**failure isolation** — monitoring never crashes the host app.

---

## Environment variables

See [`.env.example`](.env.example). Key ones:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql+psycopg://telemetry:telemetry@postgres:5432/telemetry_highway` | Postgres DSN |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection |
| `JWT_SECRET` | `change-me...` | Dashboard token signing |
| `MAX_PAYLOAD_BYTES` | `262144` | Ingest payload size limit |
| `MAX_BATCH_SIZE` | `500` | Max events per batch |
| `RATE_LIMIT_PER_MINUTE` | `600` | Per-API-key ingest limit |
| `TELEMETRY_STREAM` | `telemetry:events` | Redis stream name |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Dashboard → API base URL |

---

## How to run the examples

```bash
# Python
pip install -e sdks/python
set MONITORING_API_KEY=th_...        # from the dashboard
python examples/python_app.py

# Node
cd sdks/node && npm install && npm run build && cd ../..
set MONITORING_API_KEY=th_...
node examples/node_app.mjs

# curl (bash) / PowerShell
export MONITORING_API_KEY=th_... && ./examples/curl_telemetry.sh
$env:MONITORING_API_KEY="th_..."; .\examples\curl_telemetry.ps1
```

---

## Tests completed

Backend (`cd backend && pytest`) — **28 passing**, covering:
authentication, API-key validation, **organization isolation**, invalid
telemetry, **oversized payload (413)**, **secret redaction**, **Redis
ingestion**, **worker processing** (persist + idempotent dedup + service
auto-register), API-key revocation & rotation, rate limiting (429), device
enrollment, and a full **integration test** (ingest → Redis → worker →
Postgres → explorer → stats).

SDK tests — Python (`pytest sdks/python/tests`, 3 passing) and Node
(`cd sdks/node && npm test`, 3 passing): delivery, **failure isolation**
(never raises when platform is down), bounded buffer.

```bash
cd backend && pytest                 # 28 passed
pytest ../sdks/python/tests          # 3 passed
cd ../sdks/node && npm test          # 3 passed
```

---

## Phase 1 acceptance criteria

- [x] User can create/login to organization
- [x] User can create application
- [x] Application receives scoped API key
- [x] API key can be revoked/rotated
- [x] Python SDK works
- [x] Node.js SDK works
- [x] Telemetry API accepts events
- [x] Telemetry API validates credentials
- [x] Events enter Redis
- [x] Worker processes events
- [x] Events appear in PostgreSQL
- [x] Events appear in dashboard
- [x] Multiple organizations are isolated
- [x] Basic secrets are redacted
- [x] Rate limiting exists
- [x] Audit logging exists
- [x] OS agent registration foundation exists
- [x] Monitoring failure does not break customer applications
- [x] Docker-based local setup works

---

## Known limitations (intentional for Phase 1)

- **Schema management** uses SQLAlchemy `create_all` (idempotent) rather than
  Alembic migrations. Structured so Alembic drops in cleanly for Phase 2.
- **Rate limiting** is a fixed-window Redis counter (simple, slightly bursty at
  window edges). Interface allows a sliding-window/token-bucket swap.
- **Redaction** covers obvious key names + inline `key=value` only; no
  entropy/regex catalogs yet.
- **No dead-letter stream** — malformed events are ack'd to avoid poison-pill
  loops; a DLQ is the natural Phase 2 addition.
- **CORS** is open in development; locked down when `ENVIRONMENT=production`.
- **HTTPS** is expected to be terminated by a reverse proxy in production
  (the app is HTTPS-ready, not HTTPS-terminating).
- Dashboard charts are minimal; the advanced incident dashboard is Phase 2.

---

## Recommended Phase 2 integration points

1. **`app/worker/processor.py::process_event`** — insert fingerprinting,
   deduplication, spike detection, correlation, and cooldown here, *before*
   the row is persisted. Populate the reserved `fingerprint`, `incident_id`,
   `correlation_id` columns.
2. **`telemetry_events`** is the stable canonical contract — Phase 2 consumes
   these rows; do not change the ingestion schema.
3. **Redis Stream** (`telemetry:events`) + consumer group is the transport;
   add a `telemetry:dead-letter` stream for poison events.
4. **New tables** (`incidents`, `fingerprints`, `notifications`) reference
   existing `organization_id`/`application_id` foreign keys.
5. **Audit log** + **rate limiter** interfaces are stable extension points.
6. Notifications (Slack/Discord/email) consume incidents created in Phase 2;
   Phase 3 OS agents reuse the device model + the same gateway.
```


---

# 🧠 Phase 2 — Telemetry Intelligence & Alert-Fatigue Reduction

Phase 2 adds a **deterministic intelligence layer** on top of the Phase 1
pipeline. Nothing from Phase 1 was replaced — the worker now runs the
intelligence engine *after* persisting each raw event, so telemetry stays fully
investigable.

```
canonical event
  → normalize → fingerprint → group (dedup) → spike detect
  → severity engine → incident engine → correlation
  → cooldown matrix → notify / suppress → timeline + SSE → dashboard
```

**Headline:** `10,000 events → 1 incident → 1–2 notifications` (≈99.98% noise reduction).

## Architecture changes

- New package `app/intelligence/` — all deterministic, **no LLM**:
  `normalize.py`, `fingerprint.py`, `spike.py`, `severity.py`, `cooldown.py`,
  `correlation.py`, `notifications.py`, and the orchestrator `engine.py`.
- `app/worker/processor.py` now persists the raw event **then** calls
  `run_intelligence(...)`, back-filling `fingerprint / incident_id /
  correlation_id` on the event row. Same Redis-Stream→worker transport.
- `app/core/realtime.py` — Redis Pub/Sub for real-time dashboard updates,
  exposed to the browser as **Server-Sent Events** (`GET .../stream`).
- The HTTP ingestion path is unchanged and still returns 202 immediately — all
  intelligence runs in the worker, never in the request.

## Database changes (new tables)

| Table | Purpose |
|-------|---------|
| `error_groups` | Deduplicated events sharing a fingerprint (count, first/last seen, affected instances/regions, sample). Unique on `(org, app, service, env, fingerprint)`. |
| `incidents` | Operational incident aggregating groups. Lifecycle `OPEN→ACKNOWLEDGED→RESOLVED→CLOSED`; spike metrics; affected instances/regions/services/**applications**; `events_suppressed`, `notifications_sent`, `noise_reduction_ratio`, `correlation_id`. |
| `incident_timeline` | Ordered, human-readable events (first_event, spike_started, incident_created, notification_sent/updated, cooldown_expired, events_suppressed, correlated, severity_changed, acknowledged/resolved/closed). |
| `notification_logs` | Every notification actually sent (drives cooldown + history). |

The Phase 1 `telemetry_events.fingerprint / incident_id / correlation_id`
columns (previously reserved) are now populated. No Phase 1 column changed type.

## Algorithms implemented

- **Fingerprinting** — masks dynamic tokens (UUIDs, IPs, MACs, emails, URLs,
  long hex, request/order/session ids, quoted literals, numbers) then hashes
  `service | event_type | error_class | signature`. Similar errors collapse;
  distinct errors stay separate.
- **Grouping / dedup** — atomic upsert into `error_groups` (count += 1); raw
  events are never deleted.
- **Spike detection** — Redis sorted-set sliding window: `is_spike` when
  `current_count ≥ min_events` and `current_rate > baseline_rate × multiplier`.
  Fails safe (no Redis → no spike).
- **Severity engine** — combines source severity, event count, affected
  instances/services, spike multiplier, environment (dev capped at ERROR; prod
  escalates to HIGH/CRITICAL). All thresholds configurable.
- **Correlation** — deterministic key `(org, environment, family)` where
  `family` is the error class (via a small rule table, e.g. connection/timeout
  → one backend-outage theme) else the fingerprint. Collapses multi-instance,
  multi-service, and multi-application failures of the same kind into ONE
  incident within a configurable window.
- **Cooldown matrix** — per-severity windows (CRITICAL 2m / HIGH 5m / MEDIUM
  15m / LOW 30m, all configurable): first event notifies, duplicates within the
  window are suppressed, cooldown expiry sends an update, acknowledged/resolved
  silence further alerts.
- **Noise Reduction Ratio** — `1 − notifications_sent / events_received`,
  tracked per incident and aggregated for the org KPI.

## New APIs (all under `/api/v1`, org-scoped, JWT)

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/organizations/{org}/incidents` | List (filter `status`, `severity`, `application_id`) |
| GET  | `/organizations/{org}/incidents/{id}` | Detail + timeline + notifications |
| GET  | `/organizations/{org}/incidents/{id}/events` | Incident → raw telemetry |
| POST | `/organizations/{org}/incidents/{id}/status` | ACK / RESOLVE / CLOSE / reopen |
| GET  | `/organizations/{org}/error-groups` | List error groups |
| GET  | `/organizations/{org}/error-groups/{id}/events` | Group → raw telemetry |
| GET  | `/organizations/{org}/kpis` | Noise-reduction KPIs |
| GET  | `/organizations/{org}/stream` | **SSE** real-time updates (`?token=`) |
| GET  | `/organizations/{org}/demo/scenarios` | List demo scenarios |
| POST | `/organizations/{org}/demo/simulate/{scenario}` | Run a simulation (`count`, `apps`) |

## Demo simulator scenarios

`normal-traffic`, `error-burst`, `database-outage`, `cpu-spike`,
`api-timeout-storm`, `multi-instance-failure`. Runs events through the *real*
pipeline inline and returns a summary. Example:

```
POST /api/v1/organizations/{org}/demo/simulate/database-outage?count=10000&apps=3
→ 10,000 events across 3 apps / 20 db-nodes → 1 CRITICAL incident → ~1–2 notifications
```

Use it from the **Demo Simulator** page in the dashboard.

## New dashboard pages

- **Overview** — live KPIs (events received, active incidents, notifications,
  noise-reduction %) + signal-vs-noise chart + active incidents, auto-updating
  over SSE.
- **Incidents** — list with severity/status, event counts, spike magnitude,
  notifications sent, events suppressed, noise reduction.
- **Incident detail** — stats, affected services/instances/regions, live
  **timeline**, **notification history**, lifecycle actions (ack/resolve/close),
  and drill-down to underlying raw telemetry.
- **Demo Simulator** — one-click scenario runner with a results panel.

## Phase 2 tests (spec §19)

`cd backend && pytest` — **45 passing** total (28 Phase 1 + 17 Phase 2):

- Unit: fingerprint stability/discrimination + token masking; severity dev-vs-prod.
- Scenario 1 — 100 identical events → **1 error group**.
- Scenario 2 — 10,000 identical events → **1 incident**, event_count 10,000, ≥99% noise reduction.
- Scenario 3 — 500/min vs 5/min baseline → **spike detected**.
- Scenario 4 — same error across 20 instances → **one incident**, 20 affected instances.
- Scenario 5 — duplicates during cooldown → **suppressed** (1 notification).
- Scenario 6 — cooldown expiry → **notification update** (≥2 notifications).
- Scenario 7 — resolve incident → status **RESOLVED** + resolved notification/timeline.
- API: demo simulator, incidents list/detail/drill-down, error-group drill-down,
  KPIs, cross-org isolation, SSE auth.

## Phase 2 acceptance criteria

- [x] Canonical events are normalized
- [x] Fingerprinting works
- [x] Similar events are grouped
- [x] Duplicate events are suppressed
- [x] Raw telemetry remains investigable
- [x] Spike detection works
- [x] Multi-instance correlation works
- [x] Incident lifecycle works
- [x] Cooldown matrix works
- [x] Severity engine works
- [x] Noise Reduction Ratio works
- [x] Incident dashboard works
- [x] Incident timeline works
- [x] Real-time updates work (SSE)
- [x] Demo simulator works
- [x] All Phase 1 functionality still works (28/28 Phase 1 tests green)

## Phase 3 integration points

1. **Notification channels** — `app/intelligence/notifications.py` +
   `notification_logs` already model channel/kind. Phase 3 adds Slack/Discord/
   email senders that consume the same records (cooldown accounting stays intact).
2. **OS agents** (Phase 1 device model) emit through the same gateway; their
   events flow through the identical intelligence pipeline (`source_type=agent`).
3. **AI augmentation** — the deterministic outputs (groups, incidents,
   timelines) are ready for AI *summaries / root-cause hypotheses / recommended
   actions* without touching the core filter. `correlation.CORRELATION_RULES`
   is where learned rules would plug in.
4. **Real-time transport** — the SSE channel (`incidents:{org}`) can back a
   richer live incident console.
5. **Configurability** — every threshold (spike, cooldown, severity,
   correlation window, incident trigger) is in `app/config.py`, ready to become
   per-organization policy.

## Known limitations (Phase 2)

- Correlation defaults to same-error-family; cross-error-type correlation is
  supported via the explicit `CORRELATION_RULES` table (one default rule
  provided) rather than learned automatically.
- Spike state lives in Redis sorted sets with TTL; it is not persisted across a
  full Redis flush (fails safe to "no spike").
- SSE uses a simple polling bridge over Redis Pub/Sub (fine for the dashboard;
  a dedicated async client would scale further).
- The demo simulator processes events inline for immediate results; very large
  counts are bounded to 20,000 per call.


---

# 🛡️ Phase 3 — OS Agent, Notifications, Security & Production Readiness

Phase 3 extends the platform to **infrastructure monitoring**, **external
notifications**, and **enterprise security** — all reusing the Phase 1 gateway
and Phase 2 intelligence engine. Nothing was rebuilt.

## Final architecture

```
Applications ──SDK──┐
                    ├─► Telemetry Gateway ─► Redis Stream ─► Intelligence Worker
OS / Servers ─Agent─┘        (auth, RBAC,        (canonical      (normalize→fingerprint→
                              rate limit,          events)         group→spike→severity→
                              redaction)                           incident→correlation→
                                                                   cooldown)
                                                                        │
                          ┌─────────────────────────────────────────────┤
                          ▼                     ▼                        ▼
                   PostgreSQL            Notification Service        SSE / Dashboard
                                          ├─ SlackProvider
                                          ├─ DiscordProvider
                                          └─ EmailProvider
```

**Architectural rule honored:** application logs *and* OS logs enter the SAME
highway → SAME canonical event → SAME intelligence engine → SAME incident
engine → SAME cooldown → SAME notification system. OS agents are backed by a
scoped application, so their telemetry needs no separate pipeline.

## Complete component list

| Area | Components |
|------|-----------|
| Gateway | `api/v1/telemetry.py` (+ redaction/rate-limit/metrics) |
| Intelligence | `intelligence/{normalize,fingerprint,spike,severity,cooldown,correlation,notifications,engine}.py` |
| OS Agent | `agents/python/` — `config, redact, buffer, collectors, client, agent, __main__` |
| Agent API | `api/v1/agent.py` (credential-auth config + heartbeat), `api/v1/devices.py` (lifecycle) |
| Notifications | `notifications/{base,providers,service}.py` (Slack/Discord/Email) |
| Security | `core/rbac.py`, `core/audit.py`, `core/redaction.py`, `core/rate_limit.py`, `core/metrics.py` |
| Admin | `api/v1/admin.py` (integrations, retention, members/RBAC, audit logs) |
| Analytics | `api/v1/analytics.py` (executive, security, platform health) |
| Retention | `core/retention.py`, `worker/housekeeping.py` |

## New APIs (Phase 3)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/organizations/{org}/devices` | ADMIN | Register device → enrollment token |
| POST | `/devices/enroll` | enrollment token | Issue device credential (once) |
| PUT  | `/organizations/{org}/devices/{id}/config` | ADMIN | Update collection policy |
| DELETE | `/organizations/{org}/devices/{id}` | ADMIN | Revoke device + credential |
| GET  | `/agent/config` | device credential | Fetch collection policy |
| POST | `/agent/heartbeat` | device credential | Heartbeat + version/OS |
| GET/PUT | `/organizations/{org}/integrations` | ADMIN | Configure Slack/Discord/Email |
| POST | `/organizations/{org}/integrations/{type}/test` | ADMIN | Send a test notification |
| GET/PUT | `/organizations/{org}/retention` | OWNER | Retention policy |
| POST | `/organizations/{org}/retention/purge` | OWNER | Run purge now |
| GET  | `/organizations/{org}/members` | member | List members + roles |
| POST | `/organizations/{org}/members/{uid}/role` | OWNER | Change a member's role |
| GET  | `/organizations/{org}/audit-logs` | OWNER | Audit trail |
| GET  | `/organizations/{org}/analytics/executive` | member | Executive analytics |
| GET  | `/organizations/{org}/analytics/security` | member | Security dashboard |
| GET  | `/platform/health` | member | Platform self-observability |

## Database changes (Phase 3)

- `agent_devices` extended: `application_id` (backing app), `os_version`,
  `region`, `credential_prefix`, `config` (policy JSON), `events_received`,
  `events_dropped`.
- `integrations` — one notification provider per type per org (secrets never
  returned verbatim; masked in API).
- `retention_policies` — per-org retention (raw/incident/audit days).

## Agent architecture

`th-agent enroll` (exchanges a single-use token for a scoped credential, stored
chmod-600) then `th-agent run`:
`fetch policy → heartbeat → collect (psutil metrics + configured logs) →
local redact (secrets + PII) → bounded buffer (retry/backoff, dropped counter)
→ POST /telemetry/batch`. **Read-only, no shell, no command execution.** Linux
& Windows via psutil; macOS ready; Windows Event Log / journald are guarded
opt-in extension points.

## Security architecture

Least privilege · defense in depth · tenant isolation (`require_org_member`
audits every cross-tenant attempt) · scoped credentials (device creds ingest
only for their own app) · short-lived single-use enrollment tokens · API keys
hashed at rest + masked + rotate/revoke · local **and** server-side redaction ·
rate limiting · input validation + payload caps · **RBAC** (OWNER/ADMIN/
ENGINEER/VIEWER enforced server-side) · audit logging of sensitive ops ·
configurable retention · failure isolation · no remote shell. Encryption in
transit is HTTPS-ready (terminate at proxy); encryption at rest is provided by
the database/volume layer.

## Notification architecture

`Incident Engine → cooldown decision (send/suppress) → Notification Service →
Provider (Slack/Discord/Email)`. The engine emits the final decision; providers
only deliver — they never re-decide noisiness. Every delivery is recorded in
`notification_logs` and failures are isolated (counted, never fatal). Cooldown
from Phase 2 applies to **all** channels.

## Deployment architecture

`docker compose up --build` starts postgres, redis, api, worker, frontend. The
agent is a separate profile (needs enrollment first):

```bash
docker compose run --rm agent enroll --endpoint http://api:8000 --device-id dev_xxx --token <tok>
docker compose --profile agent up agent
```

Retention housekeeping: `python -m app.worker.housekeeping` (cron/scheduled).
All config via env (`.env.example`); no hardcoded secrets; `/health` +
`/platform/health` checks; structured logging; DB indexes on hot paths.

## Complete test results

`cd backend && pytest` → **67 passing**. Breakdown:
- Phase 1 (28): auth, API keys, isolation, redaction, ingest, worker, devices, integration.
- Phase 2 (18): fingerprint/severity units + scenarios 1–7 + incidents API.
- Phase 3 (21): RBAC matrix + enforcement, device enrollment/credential/scope,
  agent config/heartbeat, **OS events through the same engine**, device removal
  revokes credential, device tenant isolation, integration masking/test/dispatch,
  provider failure isolation, retention CRUD + purge, executive analytics,
  security dashboard, platform health, auth-failure security incident.

Agent: `pytest agents/python/tests` → 5 passing (redaction, bounded buffer,
collectors). SDKs: Python 3, Node 3.

## Hackathon demo instructions

1. `docker compose up --build` → dashboard http://localhost:5173, register.
2. **Applications**: create app → API key → run `examples/python_app.py` /
   `examples/node_app.mjs` (normal telemetry).
3. **OS agent**: Devices → Add Device → copy the `th-agent enroll …` command →
   `pip install -e agents/python` → enroll → `th-agent run` (real host metrics).
4. **Demo Simulator** page → run:
   - `database-outage` (count 10000, 3 apps) → **1 correlated CRITICAL incident,
     1–2 notifications, ~99.98% noise reduction**.
   - `cpu-spike` → performance incident.
   - `auth-failure-storm` (count 500) → **one security incident**.
5. **Integrations**: add a Slack/Discord webhook → “Test” → re-run a scenario to
   see a single cooldown-gated alert (not thousands).
6. **Executive Analytics** + **Platform Health** + **Devices & Security** show
   fleet KPIs, self-observability, and the security posture live (SSE).

## Phase 3 acceptance criteria

- [x] Linux agent works · [x] Windows agent path (psutil cross-platform; Event Log guarded)
- [x] Device enrollment · [x] Device credentials · [x] Agent heartbeat
- [x] Agent collects configured metrics · [x] configured logs · [x] local redaction
- [x] Local buffering · [x] OS events enter existing highway · [x] processed by Phase 2 engine
- [x] Slack · [x] Discord · [x] Email · [x] cooldown applies to all providers
- [x] RBAC · [x] audit logging · [x] API key rotation/revocation · [x] tenant isolation tested
- [x] Retention policies · [x] executive analytics · [x] platform health monitoring
- [x] End-to-end demo · [x] Phase 1 still works · [x] Phase 2 still works

## Known limitations (Phase 3)

- Windows Event Log & journald readers are guarded opt-in stubs (metrics work
  cross-platform today; file-based logs work everywhere).
- Notifications dispatch synchronously from the worker (cooldown keeps volume
  low); a dedicated async notification queue is a scaling improvement.
- Multi-region is *region-aware* (every event/device carries a region), not
  multi-datacenter — simulated per the hackathon guidance.
- Encryption at rest relies on the DB/volume layer; retention purge is
  best-effort hard-delete (no tombstones/GDPR export workflow yet).
- SMTP email requires server-side SMTP config; webhooks need outbound network.

## Future improvements

- Alembic migrations; per-organization intelligence tuning; async notification
  queue with per-channel retries; Windows Event Log / journald native readers;
  AI-assisted incident summaries & root-cause hypotheses on top of the
  deterministic outputs; true multi-region control plane; SSO/SCIM; signed agent
  releases and auto-update.
#   A l e r t - F a t i q u e - S y s t e m  
 