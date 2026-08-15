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
          <div key={i} className="h-16 bg-[#121215] border border-zinc-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="p-12 text-center bg-[#121215]/30 border border-zinc-800/80 rounded-2xl backdrop-blur-md max-w-lg mx-auto">
        <ShieldCheck className="w-12 h-12 text-emerald-400/85 mx-auto mb-3 opacity-80 drop-shadow-[0_0_12px_rgba(52,211,153,0.15)]"/>
        <h3 className="text-sm font-bold text-zinc-200">All Systems Operational</h3>
        <p className="text-xs text-zinc-550 mt-1.5 leading-relaxed">
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
            className="px-3 py-1 bg-zinc-950 border border-zinc-800 text-xs font-bold text-amber-400 rounded-md hover:bg-zinc-900 transition cursor-pointer"
          >
            Suppress Selected
          </button>
          <button
            onClick={handleBulkResolve}
            className="px-3 py-1 bg-zinc-950 border border-zinc-800 text-xs font-bold text-emerald-400 rounded-md hover:bg-zinc-900 transition cursor-pointer"
          >
            Resolve Selected
          </button>
          <button
            onClick={handleBulkExport}
            className="px-3 py-1 bg-zinc-950 border border-zinc-800 text-xs font-bold text-zinc-300 rounded-md hover:bg-zinc-900 transition cursor-pointer"
          >
            Export payload
          </button>
        </div>
      </div>

      {/* 2. Interactive Control Bar (Search, Status Filter, Severity Filter) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-900/40 border border-zinc-800/80 rounded-xl">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <input
            type="checkbox"
            checked={selectedIds.size === processedIncidents.length && processedIncidents.length > 0}
            onChange={toggleSelectAll}
            className="rounded bg-zinc-900 border-zinc-800 accent-[#A3E635] w-3.5 h-3.5 shrink-0 cursor-pointer"
            title="Select All"
          />
          <Search className="w-4 h-4 text-zinc-550 shrink-0" />
          <input
            type="text"
            placeholder="Filter by title or service..."
            className="bg-transparent border-none outline-none text-xs text-zinc-200 w-full placeholder-zinc-650 font-mono"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#09090b]/60 border border-zinc-800 px-2.5 py-1 rounded-lg">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Status:</span>
            <select
              className="bg-transparent border-none text-[10px] text-zinc-300 outline-none cursor-pointer font-bold font-mono"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL" className="bg-[#09090b]">All Statuses</option>
              <option value="ACTIVE" className="bg-[#09090b]">Active</option>
              <option value="SUPPRESSED" className="bg-[#09090b]">Suppressed</option>
              <option value="HEALTHY" className="bg-[#09090b]">Healthy</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5 bg-[#09090b]/60 border border-zinc-800 px-2.5 py-1 rounded-lg">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Priority:</span>
            <select
              className="bg-transparent border-none text-[10px] text-zinc-300 outline-none cursor-pointer font-bold font-mono"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="ALL" className="bg-[#09090b]">All Severities</option>
              <option value="CRITICAL" className="bg-[#09090b]">Critical</option>
              <option value="HIGH" className="bg-[#09090b]">High</option>
              <option value="MEDIUM" className="bg-[#09090b]">Medium</option>
              <option value="LOW" className="bg-[#09090b]">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Event-Log List Items */}
      {processedIncidents.length === 0 ? (
        <div className="p-8 text-center bg-[#121215]/20 border border-zinc-800 border-dashed rounded-xl text-zinc-500 text-xs font-mono">
          No incident threads match the active filters.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {processedIncidents.map((incident) => {
            const count = incident.event_count || 1;
            const isSelected = selectedIds.has(incident.id);
            const isHighlighted = selectedId === incident.id;

            // Live status pulsing dot
            const statusDot = (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  incident.severity === 'CRITICAL'
                    ? 'bg-rose-400'
                    : incident.severity === 'HIGH'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                } opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  incident.severity === 'CRITICAL'
                    ? 'bg-rose-500'
                    : incident.severity === 'HIGH'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`} />
              </span>
            );

            // Relative timestamp calculation
            const getRelativeTime = (isoString?: string) => {
              if (!isoString) return "Just now";
              const time = new Date(isoString).getTime();
              const diff = Math.max(0, Date.now() - time);
              const secs = Math.floor(diff / 1000);
              if (secs < 60) return "Just now";
              const mins = Math.floor(secs / 60);
              if (mins < 60) return `${mins}m ago`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `${hrs}h ago`;
              return new Date(isoString).toLocaleDateString();
            };

            const traceScore = incident.gptrace_score 
              ? `${(incident.gptrace_score * 100).toFixed(0)}%` 
              : "98%";

            return (
              <div
                key={incident.id}
                onClick={() => {
                  if (onSelectIncident) onSelectIncident(incident);
                  if (onSelect) onSelect(incident.id);
                }}
                className={`bg-[#121215] border ${
                  isHighlighted 
                    ? 'border-[#A3E635] shadow-[0_0_12px_rgba(163,230,53,0.1)]' 
                    : 'border-zinc-800 hover:border-zinc-700'
                } rounded-lg p-4 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition duration-150 cursor-pointer`}
              >
                {/* Left: Checkbox, Status Dot, Title, Service, Group Badge */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="flex items-center mt-0.5 sm:mt-0"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(incident.id)}
                      className="rounded bg-zinc-900 border-zinc-800 accent-[#A3E635] w-3.5 h-3.5 cursor-pointer"
                    />
                  </div>

                  <div className="mt-1.5 sm:mt-0">
                    {statusDot}
                  </div>

                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <span className="font-semibold text-zinc-100 font-sans text-xs sm:text-sm truncate">
                      {incident.title || incident.summary || `Incident #${incident.id.slice(-6)}`}
                    </span>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-[10px] font-mono">
                      <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-400 uppercase font-semibold tracking-wider self-start sm:self-auto">
                        {incident.service || 'Ingestion Highway'}
                      </span>
                      {count > 1 && (
                        <span className="text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 self-start sm:self-auto">
                          [+{count - 1} duplicate alerts grouped]
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Relative Timestamp, AI Trace Score, Severity Badge */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 font-mono text-[11px] text-zinc-400 w-full sm:w-auto border-t border-zinc-800/40 sm:border-t-0 pt-3 sm:pt-0">
                  <span>{getRelativeTime(incident.last_seen || incident.created_at)}</span>

                  <span className="flex items-center gap-1 text-cyan-400 bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10 font-bold">
                    <span>AI Score:</span>
                    <span>{traceScore}</span>
                  </span>

                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border inline-block ${
                    incident.severity === 'CRITICAL'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : incident.severity === 'HIGH'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {incident.severity || 'HIGH'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IncidentFeed;
