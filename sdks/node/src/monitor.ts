import { randomUUID } from "node:crypto";
import type { MonitorOptions, Severity, TelemetryEvent } from "./types.js";

const SEVERITIES: Severity[] = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];

/**
 * Failure-isolated telemetry client.
 *
 * Monitoring must never take down the host application: all network paths
 * swallow errors and the buffer is bounded. Events are batched and flushed
 * from a timer so calls to `info/warning/error` return immediately.
 */
export class Monitor {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly service?: string;
  private readonly environment?: string;
  private readonly region?: string;
  private readonly sourceType: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxBuffer: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  private buffer: TelemetryEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(opts: MonitorOptions) {
    this.apiKey = opts.apiKey;
    this.endpoint = (opts.endpoint ?? "http://localhost:8000").replace(/\/+$/, "");
    this.service = opts.service;
    this.environment = opts.environment;
    this.region = opts.region;
    this.sourceType = opts.sourceType ?? "application";
    this.batchSize = opts.batchSize ?? 20;
    this.flushIntervalMs = opts.flushIntervalMs ?? 5000;
    this.maxBuffer = opts.maxBuffer ?? 10000;
    this.timeoutMs = opts.timeoutMs ?? 5000;
    this.maxRetries = opts.maxRetries ?? 3;

    this.timer = setInterval(() => void this.flush(), this.flushIntervalMs);
    // Do not keep the event loop alive just for telemetry.
    if (this.timer.unref) this.timer.unref();
  }

  // ----------------------------------------------------------------- public
  log(severity: string, message: string, metadata: Record<string, unknown> = {}): void {
    const sev = (severity.toUpperCase() as Severity);
    this.enqueue({
      event_id: `evt_${randomUUID().replace(/-/g, "")}`,
      service: this.service,
      source_type: this.sourceType,
      environment: this.environment,
      region: this.region,
      event_type: "log",
      severity: SEVERITIES.includes(sev) ? sev : "INFO",
      message,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log("DEBUG", message, metadata);
  }
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log("INFO", message, metadata);
  }
  warning(message: string, metadata?: Record<string, unknown>): void {
    this.log("WARNING", message, metadata);
  }
  error(message: string, metadata?: Record<string, unknown>): void {
    this.log("ERROR", message, metadata);
  }
  critical(message: string, metadata?: Record<string, unknown>): void {
    this.log("CRITICAL", message, metadata);
  }

  exception(err: Error, message?: string, metadata: Record<string, unknown> = {}): void {
    this.log("ERROR", message ?? err.message, {
      ...metadata,
      exception_type: err.name,
      traceback: err.stack,
    });
  }

  /** Emit an arbitrary event type (metric/trace/system/security). */
  event(
    eventType: string,
    severity = "INFO",
    message?: string,
    metadata: Record<string, unknown> = {},
  ): void {
    this.enqueue({
      event_id: `evt_${randomUUID().replace(/-/g, "")}`,
      service: this.service,
      source_type: this.sourceType,
      environment: this.environment,
      region: this.region,
      event_type: eventType,
      severity: severity.toUpperCase(),
      message,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  /** Send everything currently buffered. Never throws. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const events = this.buffer;
    this.buffer = [];
    await this.send(events);
  }

  /** Flush and stop the background timer. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  // ---------------------------------------------------------------- internal
  private enqueue(event: TelemetryEvent): void {
    if (this.buffer.length >= this.maxBuffer) {
      this.buffer.shift(); // drop oldest to keep memory bounded
    }
    this.buffer.push(event);
    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }
  }

  private async send(events: TelemetryEvent[]): Promise<void> {
    const url = `${this.endpoint}/api/v1/telemetry/batch`;
    const body = JSON.stringify({ events });

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": this.apiKey },
          body,
          signal: controller.signal,
        });
        clearTimeout(t);
        if (res.ok) return;
        // Permanent client errors (except 429) are not retryable — drop.
        if (res.status !== 429 && res.status >= 400 && res.status < 500) return;
      } catch {
        clearTimeout(t);
        // Network error — swallow and retry.
      }
      await new Promise((r) => setTimeout(r, Math.min(2 ** attempt * 200, 2000)));
    }
    // Give up silently; monitoring must never crash the app.
  }
}
