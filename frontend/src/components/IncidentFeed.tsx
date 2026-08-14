import React from 'react';
import { AlertTriangle, ShieldCheck, ExternalLink } from 'lucide-react';

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
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-900/60 border border-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
        <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80"/>
        <h3 className="text-sm font-semibold text-slate-200">All Systems Normal</h3>
        <p className="text-xs text-slate-400 mt-1">No active incident threads detected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.map((incident) => {
        const count = incident.event_count || 1;
        const isSelected = selectedId === incident.id;
        
        return (
          <div
            key={incident.id}
            onClick={() => {
              if (onSelectIncident) onSelectIncident(incident);
              if (onSelect) onSelect(incident.id);
            }}
            className={`p-4 hover:bg-slate-800/80 border rounded-xl transition-all duration-200 cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
              isSelected
                ? 'bg-slate-900 border-[#A3E635]/40 shadow-[0_0_15px_rgba(163,230,53,0.06)]'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mt-0.5">
                <AlertTriangle className="w-4 h-4 text-amber-400"/>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">
                    {incident.title || incident.summary || `Incident #${incident.id.slice(-6)}`}
                  </span>
                  {count > 1 && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      +{count - 1} duplicate alerts grouped
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                  <span>Service: <strong className="text-slate-300">{incident.service || 'Ingestion Highway'}</strong></span>
                  {incident.gptrace_score && (
                    <span>AI Confidence: <strong className="text-emerald-400">{(incident.gptrace_score * 100).toFixed(0)}%</strong></span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-center">
              <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                incident.severity === 'CRITICAL'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {incident.severity || 'HIGH'}
              </span>
              <ExternalLink className="w-4 h-4 text-slate-500 hover:text-slate-300"/>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default IncidentFeed;
