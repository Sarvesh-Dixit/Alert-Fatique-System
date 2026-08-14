# 🔍 Project Audit Report — Telemetry Highway

**Date:** August 11, 2026  
**Status:** ✅ **All identified issues resolved and verified**  
**Scope:** Full-project scan — backend, frontend, SDKs, agent, Docker, tests

---

## Resolution summary

| Severity | Total | Resolved | Notes |
|----------|-------|----------|-------|
| 🔴 Critical | 2 | 2 | Both fixed |
| 🟠 High | 4 | 4 | All fixed |
| 🟡 Medium | 6 | 5 | M-6 accepted as documented behavior (fails safe) |
| ⚪ Low | 8 | 6 | L-4 (lru_cache) and L-8 (SDK deps) accepted |
| **Total** | **20** | **17 fixed + 3 accepted** | |

**Verification:** 67 backend tests + 5 agent tests + 3 Python SDK + 3 Node SDK + frontend TypeScript build all green after fixes.

---

## Fixes applied

### 🔴 C-1. Integrations page 405 (POST vs PUT mismatch) — **FIXED**

Added `put` to `frontend/src/api/client.ts`; changed `Integrations.tsx:save()` to call `api.put(...)`. Saving Slack/Discord/Email integrations now works.

### 🔴 C-2. Login redirect during render — **FIXED**

Moved the "if user then navigate" block from render-time into a `useEffect` in `frontend/src/pages/Login.tsx`. No more React state-update-during-render warning.

### 🟠 H-1. SSE blocks the asyncio event loop — **FIXED**

`backend/app/api/v1/incidents.py::event_generator` now uses `await asyncio.to_thread(pubsub.get_message, …)` and `await asyncio.to_thread(pubsub.subscribe, …)`. The event loop stays responsive even with many concurrent SSE clients.

### 🟠 H-2. CORS disabled in production — **FIXED**

Added `cors_origins` setting (`CORS_ORIGINS` env var, comma-separated). `main.py` splits and applies it; when `*` is used, `allow_credentials=False` per the CORS spec. `.env` and `.env.example` updated.

### 🟠 H-3. Login navigates to dead `/applications` route — **FIXED**

Both `navigate()` calls in `Login.tsx` now go to `/overview` (the current landing page).

### 🟠 H-4. `change_member_role` used a query parameter — **FIXED**

Introduced `RoleUpdate` Pydantic model; `admin.py::change_member_role` now takes `payload: RoleUpdate` in the request body. Tests updated to send JSON body.

### 🟡 M-1. Frontend `TelemetryEvent` type incomplete — **FIXED**

Added `organization_id`, `application_id`, `received_at`, and `metadata: Record<string, unknown>` to the TypeScript interface.

### 🟡 M-2. Redis pubsub not unsubscribed before close — **FIXED**

SSE generator now calls `pubsub.unsubscribe(channel)` before `pubsub.close()`, each wrapped in `asyncio.to_thread` and try/except so cleanup is best-effort but complete.

### � M-3. Silent poison-pill data loss — **FIXED**

Added `telemetry_dlq_stream` config; worker `_handle_entry` now `XADD`s failed entries to `telemetry:dlq` (capped via `MAXLEN`) *before* ack'ing them on the main stream. Failed events are inspectable/recoverable.

### 🟡 M-4. N+1 query in executive analytics — **FIXED**

Rewrote the device count loop as a single `GROUP BY` join over `AgentDevice` × `TelemetryEvent`. Analytics page scales cleanly with device count.

### 🟡 M-5. Agent flooded gateway when psutil missing — **FIXED**

`collectors.py::collect_metrics` now logs locally every cycle but only emits the "psutil not installed" telemetry event at most **once per hour** via a module-level throttle.

### 🟡 M-6. Spike state lost on Redis restart — **ACCEPTED**

Documented behavior; the design fails safe (no false positives). No code change.

### ⚪ L-1. `fmtTime` on invalid ISO — **FIXED**

`ui.tsx::fmtTime` now returns `"—"` when `Number.isNaN(d.getTime())`.

### ⚪ L-2. `known_types()` returned a list — **FIXED**

Now returns a `frozenset` from a cached module-level constant. Membership checks are O(1) and future-proof.

### ⚪ L-3. Demo simulator identical timestamps — **FIXED**

`_event()` uses a monotonically increasing counter to space timestamps a few ms apart. Cooldown and spike logic now exercise real time behavior in simulations.

### ⚪ L-4. `get_settings()` LRU-cached — **ACCEPTED**

Intended behavior. Settings are read once per process; process restart is required to reload env vars.

### ⚪ L-5. Retention policy created lazily — **FIXED**

`auth.py::register` and `organizations.py::create_organization` now insert an explicit `RetentionPolicy` row at org creation, using the server defaults.

### ⚪ L-6. Agent disk spill uncapped — **FIXED**

`buffer.py::flush_to_disk(max_bytes=8MB)` now rewrites the spill file (no append), truncates to a size cap, prioritizes the newest events, and counts the drops.

### ⚪ L-7. Device list had no pagination — **FIXED**

`devices.py::list_devices` accepts `limit` (default 200, max 1000) and `offset` query params.

### ⚪ L-8. SDKs use `urllib.request` (no pooling) — **ACCEPTED**

Deliberate zero-dependency Python SDK; acceptable for hackathon volumes. Documented as a future improvement.

### 🎨 UI-4. Test-notification button had no loading state — **FIXED**

`Integrations.tsx` tracks per-provider `testing` and `saving` state; buttons show "Testing…" / "Saving…" and disable during requests.

### 🎨 UI-5. Investigate-raw-events had no spinner — **FIXED**

`IncidentDetail.tsx` shows "Loading events…" while fetching and "No raw events found." if the result is empty, replacing the previous blank gap.

---

## Verification

| Suite | Result |
|-------|--------|
| Backend `pytest` (28 Phase 1 + 18 Phase 2 + 21 Phase 3) | ✅ 67 passed |
| Agent `pytest agents/python/tests` | ✅ 5 passed |
| Python SDK `pytest sdks/python/tests` | ✅ 3 passed |
| Node SDK `npm test` | ✅ 3 passed |
| Frontend `tsc --noEmit` | ✅ 0 errors |
| Frontend `npm run build` | ✅ built in ~20s |

---

## Files changed

**Backend**
- `backend/app/api/v1/admin.py` — role change via body; frozenset check.
- `backend/app/api/v1/analytics.py` — GROUP BY join for device counts.
- `backend/app/api/v1/auth.py` — seed retention policy on register.
- `backend/app/api/v1/demo.py` — monotonic timestamps.
- `backend/app/api/v1/devices.py` — pagination on list.
- `backend/app/api/v1/incidents.py` — async SSE with `asyncio.to_thread`, unsubscribe+close.
- `backend/app/api/v1/organizations.py` — seed retention policy on create.
- `backend/app/config.py` — `cors_origins`, `telemetry_dlq_stream`, `telemetry_dlq_max_len`.
- `backend/app/main.py` — CORS driven by settings.
- `backend/app/notifications/providers.py` — `known_types()` frozenset.
- `backend/app/schemas/integration.py` — `RoleUpdate` model.
- `backend/app/worker/main.py` — dead-letter stream on processing failures.
- `backend/tests/test_rbac.py` — role change via JSON body.

**Frontend**
- `frontend/src/api/client.ts` — `put()` method; complete `TelemetryEvent` type.
- `frontend/src/pages/Login.tsx` — `useEffect` redirect to `/overview`.
- `frontend/src/pages/Integrations.tsx` — `api.put`; `testing`/`saving` state.
- `frontend/src/pages/IncidentDetail.tsx` — loading state for raw events.
- `frontend/src/ui.tsx` — `fmtTime` guards against `Invalid Date`.

**Agent**
- `agents/python/src/telemetry_agent/collectors.py` — psutil-missing throttle.
- `agents/python/src/telemetry_agent/buffer.py` — capped disk spill.

**Env**
- `.env` — added `CORS_ORIGINS`.
- `.env.example` — restored with all Phase 3 + new CORS_ORIGINS.

---

## Notes on accepted items

- **M-6** (spike state on Redis restart): The design is intentionally
  best-effort — spike detection fails safe to "no spike" when baselines are
  missing, so a restart briefly reduces alert coverage but never produces
  false positives. Persisting sliding-window state is a scaling concern that
  belongs with a proper time-series store (Phase-later).
- **L-4** (`lru_cache` on settings): Config is expected to be process-static.
  Runtime reloading would require signal-based invalidation, which is out of
  scope for this hackathon.
- **L-8** (SDK stdlib HTTP): Deliberate choice for a zero-dependency Python
  SDK. Documented under "future improvements" in the README.

---

*Report regenerated after fixes. All identified defects are either resolved or explicitly accepted with rationale. Test suites confirm no regression.*
