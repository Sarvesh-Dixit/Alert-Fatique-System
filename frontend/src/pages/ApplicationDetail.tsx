import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Application, type ApplicationStats, type TelemetryEvent } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EmptyState, SeverityBadge, Stat, fmtTime } from "../ui";

export default function ApplicationDetail() {
  const { appId } = useParams();
  const { currentOrg } = useAuth();
  const [app, setApp] = useState<Application | null>(null);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);

  async function load() {
    if (!appId || !currentOrg) return;
    const [a, s, e] = await Promise.all([
      api.get<Application>(`/applications/${appId}`),
      api.get<ApplicationStats>(`/applications/${appId}/stats`),
      api.get<TelemetryEvent[]>(`/organizations/${currentOrg.id}/telemetry?application_id=${appId}&limit=20`),
    ]);
    setApp(a);
    setStats(s);
    setEvents(e);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // live refresh
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, currentOrg?.id]);

  if (!app) return <div className="text-white/50">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/applications" className="text-white/40 text-sm hover:text-white">← Applications</Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {app.name}
            <span className={`badge ${stats?.connected ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50"}`}>
              {stats?.connected ? "● connected" : "○ idle"}
            </span>
          </h1>
          <div className="text-white/40 text-sm">{app.environment} · {app.region ?? "—"}</div>
        </div>
        <Link to={`/applications/${app.id}/keys`} className="btn">Manage API keys</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total events" value={stats?.total_events ?? 0} />
        <Stat label="Events / min" value={stats?.events_per_minute ?? 0} />
        <Stat label="Errors" value={stats?.error_count ?? 0} tone="text-red-400" />
        <Stat label="Warnings" value={stats?.warning_count ?? 0} tone="text-amber-400" />
      </div>

      <div className="card">
        <div className="font-semibold mb-4">Recent telemetry</div>
        {events.length === 0 ? (
          <EmptyState>No events yet. Send telemetry with your API key.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-white/40 text-left">
              <tr>
                <th className="py-2">Time</th>
                <th>Severity</th>
                <th>Service</th>
                <th>Message</th>
              </tr>
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
