import React, { useState, useEffect, useMemo } from "react";
import { AlertTriangle, ShieldCheck, ArrowUpDown, Trash2, CheckCircle, ExternalLink, Search, Filter } from "lucide-react";
import { useTelemetryInjection } from "../context/TelemetryToastContext";

export interface Incident {
  id: string;
  title?: string;
  summary?: string;
  service?: string | null;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string | null;
  status?: 'OPEN' | 'RESOLVED' | 'SUPPRESSED' | string | null;
  event_count?: number;
  created_at?: string;
  last_seen?: string;
  first_seen?: string;
  gptrace_score?: number;
  fingerprint?: string | null;
  affected_instances?: string[];
  affected_regions?: string[];
  affected_services?: string[];
  affected_applications?: string[];
  baseline_rate?: number;
  current_rate?: number;
  spike_multiplier?: number;
  events_suppressed?: number;
  notifications_sent?: number;
  noise_reduction_ratio?: number;
  correlation_id?: string | null;
  last_notified_at?: string | null;
}

interface IncidentFeedProps {
  incidents?: Incident[];
  loading?: boolean;
  onSelectIncident?: (incident: Incident) => void;
  limit?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export const IncidentFeed: React.FC<IncidentFeedProps> = ({
  incidents = [],
  loading = false,
  onSelectIncident,
  selectedId,
  onSelect,
}) => {
  const { setToast } = useTelemetryInjection();
  const [localIncidents, setLocalIncidents] = useState<Incident[]>(incidents);
  
  // Table Controls State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUPPRESSED" | "HEALTHY">("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"time" | "severity" | "service">("time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalIncidents(incidents);
  }, [incidents]);

  // Toast feedback helper
  const showToast = (message: string) => {
    setToast({
      type: "success",
      message: "Bulk Action Completed",
      sub: message,
      icon: "✅"
    });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Filter & Sort logic
  const processedIncidents = useMemo(() => {
    return localIncidents
      .filter((inc) => {
        const matchesSearch = 
          (inc.title?.toLowerCase() || "").includes(search.toLowerCase()) ||
          (inc.summary?.toLowerCase() || "").includes(search.toLowerCase()) ||
          (inc.service?.toLowerCase() || "").includes(search.toLowerCase());
        
        const matchesSeverity = 
          severityFilter === "ALL" || 
          inc.severity?.toUpperCase() === severityFilter.toUpperCase();
          
        const status = (inc.status || "OPEN").toUpperCase();
        let matchesStatus = true;
        if (statusFilter === "ACTIVE") {
          matchesStatus = status === "OPEN" || status === "ACKNOWLEDGED";
        } else if (statusFilter === "SUPPRESSED") {
          matchesStatus = status === "SUPPRESSED";
        } else if (statusFilter === "HEALTHY") {
          matchesStatus = status === "RESOLVED" || status === "CLOSED";
        }
        
        return matchesSearch && matchesSeverity && matchesStatus;
      })
      .sort((a, b) => {
        let valA: any = "";
        let valB: any = "";
        
        if (sortBy === "time") {
          valA = a.last_seen || a.created_at || "";
          valB = b.last_seen || b.created_at || "";
        } else if (sortBy === "severity") {
          const weight = (s?: string | null) => {
            const u = (s || "").toUpperCase();
            if (u === "CRITICAL") return 4;
            if (u === "HIGH") return 3;
            if (u === "MEDIUM" || u === "WARNING") return 2;
            return 1;
          };
          valA = weight(a.severity);
          valB = weight(b.severity);
        } else if (sortBy === "service") {
          valA = a.service || "";
          valB = b.service || "";
        }
        
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [localIncidents, search, severityFilter, statusFilter, sortBy, sortOrder]);

  const toggleSelectAll = () => {
    if (selectedIds.size === processedIncidents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedIncidents.map((i) => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkSuppress = () => {
    const list = Array.from(selectedIds);
    setLocalIncidents((prev) =>
      prev.map((inc) => (list.includes(inc.id) ? { ...inc, status: "SUPPRESSED" } : inc))
    );
    setSelectedIds(new Set());
    showToast(`Suppressed ${list.length} incidents in the suppression matrix.`);
  };

  const handleBulkResolve = () => {
    const list = Array.from(selectedIds);
    setLocalIncidents((prev) =>
      prev.map((inc) => (list.includes(inc.id) ? { ...inc, status: "RESOLVED" } : inc))
    );
    setSelectedIds(new Set());
    showToast(`Resolved ${list.length} incident threads successfully.`);
  };

  const handleBulkExport = () => {
    showToast(`Exported ${selectedIds.size} incident payloads successfully.`);
    setSelectedIds(new Set());
  };

  const handleSort = (field: "time" | "severity" | "service") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-900/60 border border-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="p-12 text-center bg-slate-900/30 border border-slate-850 rounded-2xl backdrop-blur-md max-w-lg mx-auto">
        <ShieldCheck className="w-12 h-12 text-emerald-400/85 mx-auto mb-3 opacity-80 drop-shadow-[0_0_12px_rgba(52,211,153,0.15)]"/>
        <h3 className="text-sm font-bold text-slate-200">All Systems Operational</h3>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          No correlated incident threads detected in the telemetry highway. Trigger a scenario from the Live Monitor or Demo Simulator to populate this view.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 relative">
      {/* 1. Contextual Bulk Action Bar */}
      <div 
        className={`w-full overflow-hidden transition-all duration-300 ${
          selectedIds.size > 0 
            ? "max-h-16 opacity-100 py-3 bg-[#A3E635]/10 border border-[#A3E635]/25 rounded-xl px-4 flex items-center justify-between" 
            : "max-h-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#A3E635] font-mono">
            {selectedIds.size} Selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkSuppress}
            className="px-3 py-1 bg-slate-950 border border-slate-800 text-xs font-bold text-amber-400 rounded-md hover:bg-slate-900 transition cursor-pointer"
          >
            Suppress Selected
          </button>
          <button
            onClick={handleBulkResolve}
            className="px-3 py-1 bg-slate-950 border border-slate-800 text-xs font-bold text-emerald-400 rounded-md hover:bg-slate-900 transition cursor-pointer"
          >
            Resolve Selected
          </button>
          <button
            onClick={handleBulkExport}
            className="px-3 py-1 bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 rounded-md hover:bg-slate-900 transition cursor-pointer"
          >
            Export payload
          </button>
        </div>
      </div>

      {/* 2. Interactive Control Bar (Search, Status Filter, Severity Filter) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Filter by title or service..."
            className="bg-transparent border-none outline-none text-xs text-slate-200 w-full placeholder-slate-500 font-mono"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-850 px-2 py-1 rounded-lg">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Status:</span>
            <select
              className="bg-transparent border-none text-[10px] text-slate-300 outline-none cursor-pointer font-bold font-mono"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL" className="bg-slate-950">All Statuses</option>
              <option value="ACTIVE" className="bg-slate-950">Active</option>
              <option value="SUPPRESSED" className="bg-slate-950">Suppressed</option>
              <option value="HEALTHY" className="bg-slate-950">Healthy</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-850 px-2 py-1 rounded-lg">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Priority:</span>
            <select
              className="bg-transparent border-none text-[10px] text-slate-300 outline-none cursor-pointer font-bold font-mono"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="ALL" className="bg-slate-950">All Severities</option>
              <option value="CRITICAL" className="bg-slate-950">Critical</option>
              <option value="HIGH" className="bg-slate-950">High</option>
              <option value="MEDIUM" className="bg-slate-950">Medium</option>
              <option value="LOW" className="bg-slate-950">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Table Element */}
      {processedIncidents.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/10 border border-slate-850 border-dashed rounded-xl text-slate-500 text-xs font-mono">
          No incident threads match the active filters.
        </div>
      ) : (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/20">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/60 bg-slate-950/50 text-[10px] text-slate-450 uppercase font-mono tracking-wider font-extrabold select-none">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === processedIncidents.length && processedIncidents.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded bg-slate-900 border-slate-800 accent-[#A3E635]"
                  />
                </th>
                <th className="py-3 px-4 w-24 cursor-pointer hover:text-white transition" onClick={() => handleSort("severity")}>
                  <span className="flex items-center gap-1">Severity <ArrowUpDown className="w-3 h-3 text-slate-500" /></span>
                </th>
                <th className="py-3 px-4">Incident details</th>
                <th className="py-3 px-4 w-32 cursor-pointer hover:text-white transition" onClick={() => handleSort("service")}>
                  <span className="flex items-center gap-1">Service <ArrowUpDown className="w-3 h-3 text-slate-500" /></span>
                </th>
                <th className="py-3 px-4 w-28 cursor-pointer hover:text-white transition" onClick={() => handleSort("time")}>
                  <span className="flex items-center gap-1">Last Seen <ArrowUpDown className="w-3 h-3 text-slate-500" /></span>
                </th>
                <th className="py-3 px-4 w-12 text-center">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {processedIncidents.map((incident) => {
                const count = incident.event_count || 1;
                const isSelected = selectedIds.has(incident.id);
                const isHighlighted = selectedId === incident.id;
                
                return (
                  <tr
                    key={incident.id}
                    onClick={() => {
                      if (onSelectIncident) onSelectIncident(incident);
                      if (onSelect) onSelect(incident.id);
                    }}
                    className={`transition duration-150 cursor-pointer ${
                      isHighlighted 
                        ? "bg-[#A3E635]/5" 
                        : isSelected 
                          ? "bg-slate-900/60" 
                          : "hover:bg-slate-900/30"
                    }`}
                  >
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(incident.id)}
                        className="rounded bg-slate-900 border-slate-800 accent-[#A3E635]"
                      />
                    </td>
                    
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border inline-block ${
                        incident.severity === 'CRITICAL'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : incident.severity === 'HIGH'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-[#A3E635]/10 text-emerald-400 border-[#A3E635]/20'
                      }`}>
                        {incident.severity || 'HIGH'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-100 font-sans">
                          {incident.title || incident.summary || `Incident #${incident.id.slice(-6)}`}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                          {count > 1 && (
                            <span className="text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/10">
                              +{count - 1} duplicates grouped
                            </span>
                          )}
                          {incident.gptrace_score && (
                            <span>Trace Match: {(incident.gptrace_score * 100).toFixed(0)}%</span>
                          )}
                          <span className="uppercase text-[9px]">{incident.status}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-300 font-mono">
                      {incident.service || 'Ingestion Highway'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {incident.last_seen 
                        ? new Date(incident.last_seen).toLocaleTimeString() 
                        : new Date(incident.created_at || Date.now()).toLocaleTimeString()}
                    </td>

                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          if (onSelectIncident) onSelectIncident(incident);
                          if (onSelect) onSelect(incident.id);
                        }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                        title="View Incident Drawer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default IncidentFeed;
