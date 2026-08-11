export type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface MonitorOptions {
  apiKey: string;
  endpoint?: string;
  service?: string;
  environment?: string;
  region?: string;
  sourceType?: string;
  /** Flush when this many events are buffered. */
  batchSize?: number;
  /** Max milliseconds between automatic flushes. */
  flushIntervalMs?: number;
  /** Hard cap on locally buffered events. */
  maxBuffer?: number;
  /** Per-request network timeout in milliseconds. */
  timeoutMs?: number;
  /** Retry attempts per batch. */
  maxRetries?: number;
}

export interface TelemetryEvent {
  event_id: string;
  service?: string;
  source_type: string;
  environment?: string;
  region?: string;
  event_type: string;
  severity: Severity | string;
  message?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}
