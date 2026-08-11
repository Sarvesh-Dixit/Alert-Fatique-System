# Telemetry Highway — OS Monitoring Agent

A lightweight, **read-only** OS monitoring agent for Linux and Windows
(macOS support is architecturally ready via `psutil`). It collects configured
system metrics and logs, redacts secrets/PII **locally**, buffers on failure,
and sends canonical telemetry into the **same** Telemetry Highway gateway and
intelligence engine as application SDKs.

## Security posture (least privilege)

- **No remote shell, no command execution, no file mutation** — read-only.
- Uses only a **scoped device credential** (never a user token).
- Local redaction before anything leaves the host.
- Bounded local buffer (never consumes unlimited disk/memory); retry + backoff.
- Follows the organization's collection policy fetched from the platform.

## Install

```bash
pip install -e agents/python      # installs `th-agent` and psutil
```

## Enroll (one-time)

In the dashboard: **Devices → Add Device** to get a `device_id` and a
short-lived, single-use **enrollment token**. Then on the host:

```bash
th-agent enroll --endpoint http://YOUR_HOST:8000 --device-id dev_xxx --token <enrollment-token>
```

This exchanges the token for a device credential (stored at
`~/.telemetry-highway/agent.json`, chmod 600) and consumes the token.

## Run

```bash
th-agent run
```

The agent then:
1. fetches its collection policy (`GET /api/v1/agent/config`),
2. sends heartbeats (`POST /api/v1/agent/heartbeat`),
3. collects enabled metrics (CPU, memory, disk, network, uptime, processes) and
   configured logs,
4. redacts locally, batches, and sends to `POST /api/v1/telemetry/batch`.

## Configurable collection (per organization)

`collect_cpu`, `collect_memory`, `collect_disk`, `collect_network`,
`collect_uptime`, `collect_processes`, `collect_system_logs`,
`collect_security_events`, `collect_application_logs`, `log_paths`,
`collection_interval_seconds`, `heartbeat_interval_seconds`, `redact_pii`.

Change the policy from the dashboard (Devices → configure); the agent picks it
up on the next heartbeat.

## Platform notes

- **Linux**: metrics via psutil; logs via configured `log_paths` (journald/
  syslog readers are an opt-in extension point).
- **Windows**: metrics via psutil; Windows Event Log reading is a guarded,
  opt-in extension (`pywin32`).
- **macOS**: metrics via psutil work today; documented as a supported target.
