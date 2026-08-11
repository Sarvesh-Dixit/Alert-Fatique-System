/**
 * Example application using the Telemetry Highway Node.js SDK.
 *
 * Run:
 *   cd sdks/node && npm install && npm run build && cd ../..
 *   set MONITORING_API_KEY=th_...
 *   node examples/node_app.mjs
 */
import { Monitor } from "../sdks/node/dist/index.js";

const monitor = new Monitor({
  apiKey: process.env.MONITORING_API_KEY ?? "th_replace_me",
  endpoint: process.env.TELEMETRY_ENDPOINT ?? "http://localhost:8000",
  service: "checkout-api",
  environment: "production",
  region: "india",
  batchSize: 5,
  flushIntervalMs: 2000,
});

monitor.info("Application started", { version: "2.0.0" });

for (let i = 0; i < 20; i++) {
  const roll = Math.random();
  if (roll < 0.1) {
    try {
      throw new Error("Database connection failed");
    } catch (e) {
      monitor.exception(e, undefined, { order_id: 1000 + i });
    }
  } else if (roll < 0.3) {
    monitor.warning("High memory usage", { memory_pct: (80 + roll * 20).toFixed(1) });
  } else {
    monitor.info("Processed request", { request_id: `req_${i}`, latency_ms: Math.floor(Math.random() * 250) });
  }
  await new Promise((r) => setTimeout(r, 300));
}

monitor.event("metric", "INFO", "cpu_utilization", { value: 0.63 });

await monitor.flush();
await monitor.close();
console.log("Done. Check the dashboard Telemetry Explorer.");
