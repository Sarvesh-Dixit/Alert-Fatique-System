import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Incident } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { EmptyState, SeverityBadge, StatusBadge, fmtTime } from "../ui";
import { Bell, BellOff, TrendingDown } from "lucide-react";

const STATUSES = ["", "OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"];
const SEVERITIES = [
  { value: "", label: "All Severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "ERROR", label: "Error" },
  { value: "WARNING", label: "Warning" },
  { value: "INFO", label: "Info" },
  { value: "DEBUG", label: "Debug" },
];

export default function Incidents() {
  const { currentOrg } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const params = new URLSearchParams();
    if (statusFilter) params.append("status", statusFilter);
    if (severityFilter) params.append("severity", severityFilter);
    const qs = params.toString() ? `?${params.toString()}` : "";
    setIncidents(await api.get<Incident[]>(`/organizations/${currentOrg.id}/incidents${qs}`));
  }, [currentOrg, statusFilter, severityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useIncidentStream(currentOrg?.id, load);

  return (
    <div className="font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Incidents</h1>
        
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Status</span>
            <select 
              className="input w-40 bg-[#161928] border border-[#252940] hover:border-cyan-500/30 text-xs py-1.5" 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUSES.map((s) => <option key={s} value={s} className="bg-[#0f101a]">{s || "All Statuses"}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Severity</span>
            <select 
              className="input w-40 bg-[#161928] border border-[#252940] hover:border-cyan-500/30 text-xs py-1.5" 
              value={severityFilter} 
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              {SEVERITIES.map((s) => <option key={s.value} value={s.value} className="bg-[#0f101a]">{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {incidents.length === 0 ? (
        <EmptyState>No incidents matches the selected filters. Run the Demo Simulator to generate some.</EmptyState>
      ) : (
        <div className="space-y-3">
          {incidents.map((i) => (
            <Link 
              key={i.id} 
              to={`/incidents/${i.id}`} 
              className="card block hover:border-[#727DA1]/30 hover:bg-[#727DA1]/5 transition duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <SeverityBadge severity={i.severity} />
                    <StatusBadge status={i.status} />
                  </div>
                  <div className="font-semibold text-white/90 truncate">{i.title}</div>
                  <div className="text-white/40 text-xs mt-1 font-mono tracking-tight">
                    {i.affected_services.length} services · {i.affected_instances.length} instances ·
                    {" "}{i.affected_applications.length} apps · first seen {fmtTime(i.first_seen)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-semibold font-mono tracking-tight text-white">{i.event_count.toLocaleString()}</div>
                  <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider">events</div>
                  {i.spike_multiplier > 1 && (
                    <div className="text-amber-400 text-xs mt-1 font-mono tracking-tight font-bold">{i.spike_multiplier}× spike</div>
                  )}
                </div>
              </div>
              <div className="flex gap-6 mt-3.5 pt-3.5 border-t border-[#252940]/60 text-xs text-white/50 font-mono tracking-tight">
                <span className="flex items-center gap-1">
                  <Bell className="w-3.5 h-3.5 text-sky-400" />
                  <span>{i.notifications_sent} sent</span>
                </span>
                <span className="flex items-center gap-1">
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>{i.events_suppressed.toLocaleString()} suppressed</span>
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>{i.noise_reduction_ratio}% noise reduction</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
