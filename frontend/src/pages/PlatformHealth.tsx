import { useEffect, useState } from "react";
import { api, type PlatformHealth as Health } from "../api/client";
import { Stat } from "../ui";

export default function PlatformHealth() {
  const [h, setH] = useState<Health | null>(null);

  useEffect(() => {
    const load = () => api.get<Health>("/platform/health").then(setH).catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  if (!h) return <div className="text-white/50">Loading…</div>;

  const ok = (v: boolean) => (v ? "text-emerald-400" : "text-red-400");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Platform Health</h1>
      <p className="text-white/40 text-sm mb-6">The platform monitors itself (region: {h.region}).</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="card">
          <div className="text-white/50 text-sm">Status</div>
          <div className={`text-2xl font-semibold mt-1 ${h.status === "ok" ? "text-emerald-400" : "text-amber-400"}`}>
            {h.status}
          </div>
        </div>
        <div className="card">
          <div className="text-white/50 text-sm">Database</div>
          <div className={`text-2xl font-semibold mt-1 ${ok(h.database_healthy)}`}>
            {h.database_healthy ? "healthy" : "down"}
          </div>
        </div>
        <div className="card">
          <div className="text-white/50 text-sm">Redis</div>
          <div className={`text-2xl font-semibold mt-1 ${ok(h.redis_healthy)}`}>
            {h.redis_healthy ? "healthy" : "down"}
          </div>
        </div>
        <Stat label="Queue depth" value={h.queue_depth} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Ingestion /min" value={h.ingestion_rate_per_min} />
        <Stat label="Processing /min" value={h.processing_rate_per_min} />
        <Stat label="Queue pending" value={h.queue_pending} />
        <Stat label="Processing failures" value={h.processing_failures} tone={h.processing_failures ? "text-red-400" : ""} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Events ingested" value={h.events_ingested_total.toLocaleString()} />
        <Stat label="Events processed" value={h.events_processed_total.toLocaleString()} />
        <Stat label="Redactions" value={h.redactions_total.toLocaleString()} />
        <Stat label="Rate-limit violations" value={h.rate_limit_violations_total} />
        <Stat label="Notification failures" value={h.notification_failures} tone={h.notification_failures ? "text-red-400" : ""} />
        <Stat label="Agents online" value={`${h.agents_online}/${h.agents_total}`} />
      </div>
    </div>
  );
}
