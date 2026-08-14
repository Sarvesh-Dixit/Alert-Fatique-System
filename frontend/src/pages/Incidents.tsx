import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Incident, type NoiseReductionKPIs, type CooldownState } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { EmptyState } from "../ui";
import PageHeader from "../components/PageHeader";
import NoiseReductionBanner from "../components/NoiseReductionBanner";
import IncidentFeed from "../components/IncidentFeed";

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
  const [kpis, setKpis] = useState<NoiseReductionKPIs | null>(null);
  const [hasActiveCooldowns, setHasActiveCooldowns] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const params = new URLSearchParams();
    if (statusFilter) params.append("status", statusFilter);
    if (severityFilter) params.append("severity", severityFilter);
    const qs = params.toString() ? `?${params.toString()}` : "";
    
    try {
      const [incData, feedData] = await Promise.all([
        api.get<Incident[]>(`/organizations/${currentOrg.id}/incidents${qs}`),
        api.get<any>(`/organizations/${currentOrg.id}/dashboard-feed`)
      ]);
      setIncidents(incData ?? []);
      setKpis(feedData?.kpis ?? null);
      const activeCds = feedData?.cooldown_matrix?.some((c: CooldownState) => c.remaining_seconds > 0) ?? false;
      setHasActiveCooldowns(activeCds);
    } catch (err) {
      console.error("Failed to load incidents", err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [currentOrg, statusFilter, severityFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useIncidentStream(currentOrg?.id, load);

  const filtersAction = (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold">Status</span>
        <select 
          className="input w-36 bg-slate-900 border border-slate-800 focus:border-[#A3E635]/65 text-slate-200 text-xs py-1.5" 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUSES.map((s) => <option key={s} value={s} className="bg-slate-950">{s || "All Statuses"}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold">Severity</span>
        <select 
          className="input w-36 bg-slate-900 border border-slate-800 focus:border-[#A3E635]/65 text-slate-200 text-xs py-1.5" 
          value={severityFilter} 
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          {SEVERITIES.map((s) => <option key={s.value} value={s.value} className="bg-slate-950">{s.label}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6 font-sans">
      {/* Page Header with filters */}
      <PageHeader 
        title="Incidents Feed" 
        badge="OPERATIONAL" 
        actions={filtersAction}
        description="Browse logical error threads grouped from raw telemetry bursts by the semantic pipeline."
      />

      {/* Noise Reduction KPI banner */}
      <NoiseReductionBanner kpis={kpis} hasActiveCooldowns={hasActiveCooldowns} />

      {/* Main Content Area */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <h3 className="text-white font-bold text-xs uppercase tracking-wider">
            Correlated Incidents Feed
          </h3>
          <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full font-bold">
            {incidents.length} shown
          </span>
        </div>

        {loading ? (
          <div className="text-slate-500 text-xs py-16 text-center italic">
            Synchronizing incidents feed...
          </div>
        ) : incidents.length === 0 ? (
          <EmptyState>No incidents match the selected filters. Use the Demo Simulator to trigger telemetry traffic.</EmptyState>
        ) : (
          <IncidentFeed incidents={incidents} />
        )}
      </div>
    </div>
  );
}
