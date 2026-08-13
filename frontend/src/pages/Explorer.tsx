import { useEffect, useState } from "react";
import { api, type Application, type TelemetryEvent } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EmptyState, SeverityBadge, fmtTime } from "../ui";

const SEVERITIES = ["", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];
const EVENT_TYPES = ["", "log", "metric", "trace", "system", "security"];

export default function Explorer() {
  const { currentOrg } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [filters, setFilters] = useState({
    application_id: "",
    service: "",
    environment: "",
    severity: "",
    event_type: "",
    region: "",
    search: "",
  });

  useEffect(() => {
    if (!currentOrg) return;
    api.get<Application[]>(`/organizations/${currentOrg.id}/applications`).then(setApps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  async function search() {
    if (!currentOrg) return;
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) qs.append(k, v);
    });
    qs.append("limit", "200");
    setEvents(await api.get<TelemetryEvent[]>(`/organizations/${currentOrg.id}/telemetry?${qs}`));
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Telemetry Explorer</h1>

      <div className="card mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="label">Application</label>
          <select className="input" value={filters.application_id}
            onChange={(e) => setFilters({ ...filters, application_id: e.target.value })}>
            <option value="">All</option>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Severity</label>
          <select className="input" value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Event type</label>
          <select className="input" value={filters.event_type}
            onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}>
            {EVENT_TYPES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Service</label>
          <input className="input" value={filters.service}
            onChange={(e) => setFilters({ ...filters, service: e.target.value })} />
        </div>
        <div>
          <label className="label">Environment</label>
          <input className="input" value={filters.environment}
            onChange={(e) => setFilters({ ...filters, environment: e.target.value })} />
        </div>
        <div>
          <label className="label">Region</label>
          <input className="input" value={filters.region}
            onChange={(e) => setFilters({ ...filters, region: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="label">Search message</label>
          <input className="input" value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && search()} />
        </div>
        <div className="col-span-2 md:col-span-4">
          <button className="btn" onClick={search}>Search</button>
        </div>
      </div>

      <div className="card">
        <div className="text-white/40 text-xs mb-3 font-mono tracking-tight">{events.length} events</div>
        {events.length === 0 ? (
          <EmptyState>No telemetry matches these filters.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-white/40 text-left">
              <tr>
                <th className="py-2">Timestamp</th>
                <th>Severity</th>
                <th>Service</th>
                <th>Message</th>
                <th>Source</th>
                <th>Env</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.event_id} className="border-t border-white/5">
                  <td className="py-2 text-white/60 whitespace-nowrap font-mono tracking-tight">{fmtTime(e.timestamp)}</td>
                  <td><SeverityBadge severity={e.severity} /></td>
                  <td className="text-white/70">{e.service ?? "—"}</td>
                  <td className="text-white/80 max-w-md truncate">{e.message ?? "—"}</td>
                  <td className="text-white/50">{e.source_type}</td>
                  <td className="text-white/50">{e.environment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
