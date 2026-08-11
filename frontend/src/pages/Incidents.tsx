import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Incident } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { EmptyState, SeverityBadge, StatusBadge, fmtTime } from "../ui";

const STATUSES = ["", "OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"];

export default function Incidents() {
  const { currentOrg } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    setIncidents(await api.get<Incident[]>(`/organizations/${currentOrg.id}/incidents${qs}`));
  }, [currentOrg, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useIncidentStream(currentOrg?.id, load);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <select className="input w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
        </select>
      </div>

      {incidents.length === 0 ? (
        <EmptyState>No incidents. Run the Demo Simulator to generate some.</EmptyState>
      ) : (
        <div className="space-y-3">
          {incidents.map((i) => (
            <Link key={i.id} to={`/incidents/${i.id}`} className="card block hover:border-accent/50 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={i.severity} />
                    <StatusBadge status={i.status} />
                  </div>
                  <div className="font-semibold truncate">{i.title}</div>
                  <div className="text-white/40 text-xs mt-1">
                    {i.affected_services.length} services · {i.affected_instances.length} instances ·
                    {" "}{i.affected_applications.length} apps · first seen {fmtTime(i.first_seen)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-semibold">{i.event_count.toLocaleString()}</div>
                  <div className="text-white/40 text-xs">events</div>
                  {i.spike_multiplier > 1 && (
                    <div className="text-amber-300 text-xs mt-1">{i.spike_multiplier}× spike</div>
                  )}
                </div>
              </div>
              <div className="flex gap-6 mt-3 pt-3 border-t border-white/5 text-xs text-white/50">
                <span>🔔 {i.notifications_sent} sent</span>
                <span>🔕 {i.events_suppressed.toLocaleString()} suppressed</span>
                <span className="text-emerald-400">📉 {i.noise_reduction_ratio}% noise reduction</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
