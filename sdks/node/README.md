# Telemetry Highway — Node.js / TypeScript SDK

Failure-isolated telemetry client. If the platform is unavailable, your app
keeps running; events are buffered (bounded) and dropped gracefully.

Requires Node.js 18+ (uses the global `fetch`).

## Build

```bash
cd sdks/node
npm install
npm run build
```

## Usage

```ts
import { Monitor } from "@telemetry-highway/node";

const monitor = new Monitor({
  apiKey: process.env.MONITORING_API_KEY!,
  endpoint: "http://localhost:8000",
  service: "checkout-api",
  environment: "production",
});

monitor.info("Application started");
monitor.error("Database connection failed", { db: "primary" });

try {
  throw new Error("boom");
} catch (e) {
  monitor.exception(e as Error);
}

await monitor.flush();
await monitor.close();
```

## Express middleware

```ts
import express from "express";
import { Monitor, expressMiddleware } from "@telemetry-highway/node";

const monitor = new Monitor({ apiKey: process.env.MONITORING_API_KEY! });
const app = express();
app.use(expressMiddleware(monitor)); // logs method/path/status/duration
```

## Guarantees

- Non-blocking, batched delivery to `POST /api/v1/telemetry/batch`.
- Retries with backoff; permanent 4xx errors are dropped.
- Bounded buffer (oldest dropped when full).
- Never throws from `info/warning/error/exception/event`.
