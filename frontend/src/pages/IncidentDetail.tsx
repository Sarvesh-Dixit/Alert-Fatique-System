import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type IncidentDetail as IncidentDetailT, type TelemetryEvent } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { SeverityBadge, Stat, StatusBadge, fmtTime } from "../ui";

const TIMELINE_ICON: Record<string, string> = {
  first_event: "🟢",
  incident_created: "🚨",
  spike_started: "📈",
  severity_changed: "⏫",
  notification_sent: "🔔",
  notification_updated: "🔁",
  cooldown_expired: "⏰",
  events_suppressed: "🔕",
  correlated: "🔗",
  acknowledged: "👀",
  resolved: "✅",
  closed: "📦",
  reopened: "♻️",
};

export default function IncidentDetail() {
  const { incidentId } = useParams();
  const { currentOrg } = useAuth();
  const [inc, setInc] = useState<IncidentDetailT | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [showEvents, setShowEvents] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg || !incidentId) return;
    setInc(await api.get<IncidentDetailT>(`/organizations/${currentOrg.id}/incidents/${incidentId}`));
  }, [currentOrg, incidentId]);

  useEffect(() => {
    load();
  }, [load]);

  useIncidentStream(currentOrg?.id, load);

  async function loadEvents() {
    if (!currentOrg || !incidentId) return;
    setEvents(await api.get<TelemetryEvent[]>(`/organizations/${currentOrg.id}/incidents/${incidentId}/events?limit=100`));
    setShowEvents(true);
  }

  async function setStatus(status: string) {
    if (!currentOrg || !incidentId) return;
    await api.post(`/organizations/${currentOrg.id}/incidents/${incidentId}/status`, { status });
    await load();
  }

  if (!inc) return <div className="text-white/50">Loading…</div>;

  return (
    <div>
      <Link to="/incidents" className="text-white/40 text-sm hover:text-white">← Incidents</Link>
      <div className="flex items-start justify-between mt-1 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SeverityBadge severity={inc.severity} />
            <StatusBadge status={inc.status} />
          </div>
          <h1 className="text-2xl font-bold">{inc.title}</h1>
          <div className="text-white/40 text-sm mt-1">
            first seen {fmtTime(inc.first_seen)} · last seen {fmtTime(inc.last_seen)}
          </div>
        </div>
        <div className="flex gap-2">
          {inc.status === "OPEN" && <button className="btn-ghost" onClick={() => setStatus("ACKNOWLEDGED")}>Acknowledge</button>}
          {inc.status !== "RESOLVED" && inc.status !== "CLOSED" && (
            <button className="btn" onClick={() => setStatus("RESOLVED")}>Resolve</button>
          )}
          {inc.status === "RESOLVED" && <button className="btn-ghost" onClick={() => setStatus("CLOSED")}>Close</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Events" value={inc.event_count.toLocaleString()} />
        <Stat label="Spike" value={`${inc.spike_multiplier}×`} tone="text-amber-400" />
        <Stat label="Notifications" value={inc.notifications_sent} />
        <Stat label="Noise reduction" value={`${inc.noise_reduction_ratio}%`} tone="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="text-white/50 text-sm mb-2">Affected services ({inc.affected_services.length})</div>
          <div className="flex flex-wrap gap-1">
            {inc.affected_services.map((s) => <span key={s} className="badge bg-white/10 text-white/70">{s}</span>)}
          </div>
        </div>
        <div className="card">
          <div className="text-white/50 text-sm mb-2">Affected instances ({inc.affected_instances.length})</div>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-auto">
            {inc.affected_instances.map((s) => <span key={s} className="badge bg-white/10 text-white/70">{s}</span>)}
          </div>
        </div>
        <div className="card">
          <div className="text-white/50 text-sm mb-2">Affected regions ({inc.affected_regions.length})</div>
          <div className="flex flex-wrap gap-1">
            {inc.affected_regions.map((s) => <span key={s} className="badge bg-white/10 text-white/70">{s}</span>)}
          </div>
          <div className="text-white/40 text-xs mt-3">
            baseline {inc.baseline_rate}/min → current {inc.current_rate}/min
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-semibold mb-4">Timeline</div>
          <ol className="space-y-3">
            {inc.timeline.map((t) => (
              <li key={t.id} className="flex gap-3 text-sm">
                <span>{TIMELINE_ICON[t.kind] ?? "•"}</span>
                <div>
                  <div>{t.message}</div>
                  <div className="text-white/30 text-xs">{fmtTime(t.created_at)}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="card">
          <div className="font-semibold mb-4">Notification history</div>
          {inc.notifications.length === 0 ? (
            <div className="text-white/40 text-sm">No notifications sent.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {inc.notifications.map((n) => (
                <li key={n.id} className="border-t border-white/5 pt-2">
                  <div className="flex justify-between">
                    <span className="badge bg-accent/20 text-accent">{n.kind}</span>
                    <span className="text-white/40 text-xs">{fmtTime(n.created_at)}</span>
                  </div>
                  <div className="text-white/70 mt-1">{n.message}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Underlying telemetry</div>
          {!showEvents && <button className="btn-ghost" onClick={loadEvents}>Investigate raw events →</button>}
        </div>
        {showEvents && (
          <table className="w-full text-sm mt-4">
            <thead className="text-white/40 text-left">
              <tr><th className="py-2">Time</th><th>Severity</th><th>Service</th><th>Message</th></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.event_id} className="border-t border-white/5">
                  <td className="py-2 text-white/60 whitespace-nowrap">{fmtTime(e.timestamp)}</td>
                  <td><SeverityBadge severity={e.severity} /></td>
                  <td className="text-white/70">{e.service ?? "—"}</td>
                  <td className="text-white/80">{e.message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
