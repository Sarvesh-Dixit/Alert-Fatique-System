import type { Monitor } from "./monitor.js";

/**
 * Framework-agnostic Express-style request logging middleware.
 *
 * Phase 1 provides the hook point; Phase 2/3 can add richer NestJS/Next.js
 * adapters on top of the same `Monitor` instance without changing the core.
 */
export function expressMiddleware(monitor: Monitor) {
  return function (req: any, res: any, next: () => void) {
    const start = Date.now();
    res.on("finish", () => {
      const durationMs = Date.now() - start;
      const status: number = res.statusCode ?? 0;
      const severity = status >= 500 ? "ERROR" : status >= 400 ? "WARNING" : "INFO";
      monitor.event("trace", severity, `${req.method} ${req.originalUrl ?? req.url}`, {
        method: req.method,
        path: req.originalUrl ?? req.url,
        status_code: status,
        duration_ms: durationMs,
      });
    });
    next();
  };
}
