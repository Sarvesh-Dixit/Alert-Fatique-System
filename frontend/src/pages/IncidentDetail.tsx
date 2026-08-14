import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type IncidentDetail as IncidentDetailT, type TelemetryEvent } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { SeverityBadge, Stat, StatusBadge, fmtTime } from "../ui";
import {
  CircleDot,
  AlertOctagon,
  TrendingUp,
  ChevronsUp,
  Bell,
  RefreshCw,
  Timer,
  BellOff,
  Link2,
  Eye,
  CheckCircle2,
  PackageCheck,
  Recycle,
  Circle,
  ArrowRight
} from "lucide-react";
import type { ReactNode } from "react";

const TIMELINE_ICON: Record<string, ReactNode> = {
  first_event: <CircleDot className="w-4 h-4 text-emerald-400 animate-pulse" />,
  incident_created: <AlertOctagon className="w-4 h-4 text-rose-500" />,
  spike_started: <TrendingUp className="w-4 h-4 text-amber-400" />,
  severity_changed: <ChevronsUp className="w-4 h-4 text-orange-400" />,
  notification_sent: <Bell className="w-4 h-4 text-sky-400" />,
  notification_updated: <RefreshCw className="w-4 h-4 text-sky-300" />,
  cooldown_expired: <Timer className="w-4 h-4 text-amber-300" />,
  events_suppressed: <BellOff className="w-4 h-4 text-slate-400" />,
  correlated: <Link2 className="w-4 h-4 text-cyan-400" />,
  acknowledged: <Eye className="w-4 h-4 text-cyan-400" />,
  resolved: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  closed: <PackageCheck className="w-4 h-4 text-slate-400" />,
  reopened: <Recycle className="w-4 h-4 text-amber-400" />,
};

export default function IncidentDetail() {
  const { incidentId } = useParams();
  const { currentOrg } = useAuth();
  const [inc, setInc] = useState<IncidentDetailT | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [showEvents, setShowEvents] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

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
    setLoadingEvents(true);
    setShowEvents(true);
    try {
      const rows = await api.get<TelemetryEvent[]>(
        `/organizations/${currentOrg.id}/incidents/${incidentId}/events?limit=100`,
      );
      setEvents(rows);
    } finally {
      setLoadingEvents(false);
    }
  }

  async function setStatus(status: string) {
    if (!currentOrg || !incidentId) return;
    await api.post(`/organizations/${currentOrg.id}/incidents/${incidentId}/status`, { status });
    await load();
  }

  if (!inc) return <div className="text-white/50">Loading…</div>;

  return (
    <div className="font-sans">
      <Link to="/incidents" className="text-white/40 text-sm hover:text-white transition">← Back to Incidents</Link>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mt-2 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <SeverityBadge severity={inc.severity} />
            <StatusBadge status={inc.status} />
          </div>
          <h1 className="text-2xl font-bold text-white/95">{inc.title}</h1>
          <div className="text-white/40 text-xs mt-1.5 font-mono tracking-tight">
            first seen {fmtTime(inc.first_seen)} · last seen {fmtTime(inc.last_seen)}
          </div>
        </div>
        <div className="flex gap-2">
          {inc.status === "OPEN" && <button className="btn-ghost text-xs py-1.5 px-3 font-semibold" onClick={() => setStatus("ACKNOWLEDGED")}>Acknowledge</button>}
          {inc.status !== "RESOLVED" && inc.status !== "CLOSED" && (
            <button className="btn bg-gradient-to-r from-[#98A4F7] to-[#5B63D3] hover:from-[#98A4F7]/90 hover:to-[#5B63D3]/90 text-white text-xs font-bold py-1.5 px-4" onClick={() => setStatus("RESOLVED")}>Resolve</button>
          )}
          {inc.status === "RESOLVED" && <button className="btn-ghost text-xs py-1.5 px-3 font-semibold" onClick={() => setStatus("CLOSED")}>Close</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Events" value={inc.event_count.toLocaleString()} />
        <Stat label="Spike" value={`${inc.spike_multiplier}×`} tone="text-amber-400" />
        <Stat label="Notifications" value={inc.notifications_sent} />
        <Stat label="Noise reduction" value={`${inc.noise_reduction_ratio}%`} tone="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card border border-[#252940] bg-[#161928]">
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Affected services ({inc.affected_services.length})</div>
          <div className="flex flex-wrap gap-1">
            {inc.affected_services.map((s) => <span key={s} className="badge bg-[#0B0C14] border border-[#252940] text-white/70 font-mono text-[10px] tracking-tight">{s}</span>)}
          </div>
        </div>
        <div className="card border border-[#252940] bg-[#161928]">
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Affected instances ({inc.affected_instances.length})</div>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-auto scrollbar-thin">
            {inc.affected_instances.map((s) => <span key={s} className="badge bg-[#0B0C14] border border-[#252940] text-white/70 font-mono text-[10px] tracking-tight">{s}</span>)}
          </div>
        </div>
        <div className="card border border-[#252940] bg-[#161928]">
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Affected regions ({inc.affected_regions.length})</div>
          <div className="flex flex-wrap gap-1">
            {inc.affected_regions.map((s) => <span key={s} className="badge bg-[#0B0C14] border border-[#252940] text-white/70 font-mono text-[10px] tracking-tight">{s}</span>)}
          </div>
          <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider mt-3.5 pt-2 border-t border-[#252940]/60 font-mono">
            baseline <strong className="text-white font-mono tracking-tight">{inc.baseline_rate}</strong>/min · current <strong className="text-white font-mono tracking-tight">{inc.current_rate}</strong>/min
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card border border-[#252940] bg-[#161928]">
          <div className="font-semibold mb-4 text-white text-sm">Timeline</div>
          <ol className="space-y-4">
            {inc.timeline.map((t) => (
              <li key={t.id} className="flex gap-3.5 text-xs text-white/80">
                <span className="shrink-0 mt-0.5">{TIMELINE_ICON[t.kind] ?? <Circle className="w-4 h-4 text-white/30" />}</span>
                <div>
                  <div className="leading-relaxed">{t.message}</div>
                  <div className="text-white/30 text-[10px] font-mono tracking-tight mt-0.5">{fmtTime(t.created_at)}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="card border border-[#252940] bg-[#161928]">
          <div className="font-semibold mb-4 text-white text-sm">Notification history</div>
          {inc.notifications.length === 0 ? (
            <div className="text-white/40 text-xs italic">No notifications sent.</div>
          ) : (
            <ul className="space-y-3.5 text-xs">
              {inc.notifications.map((n) => (
                <li key={n.id} className="border-t border-[#252940]/60 pt-3 first:border-none first:pt-0">
                  <div className="flex justify-between items-center">
                    <span className="badge bg-[#0B0C14] border border-[#252940] text-cyan-400 font-mono text-[9px] uppercase tracking-wider">{n.kind}</span>
                    <span className="text-white/40 text-[10px] font-mono tracking-tight">{fmtTime(n.created_at)}</span>
                  </div>
                  <div className="text-white/70 mt-1.5 leading-relaxed">{n.message}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card border border-[#252940] bg-[#161928] mt-6">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-white text-sm">Underlying telemetry</div>
          {!showEvents && (
            <button className="btn-ghost flex items-center gap-1.5 text-xs" onClick={loadEvents}>
              <span>Investigate raw events</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          )}
        </div>
        {showEvents && (
          loadingEvents ? (
            <div className="text-white/40 text-sm py-8 text-center">Loading events…</div>
          ) : events.length === 0 ? (
            <div className="text-white/40 text-sm py-8 text-center">No raw events found.</div>
          ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-white/40 border-b border-[#252940] text-[10px] uppercase tracking-wider font-mono">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Severity</th>
                  <th className="pb-2">Service</th>
                  <th className="pb-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.event_id} className="border-b border-[#252940]/40 hover:bg-white/[0.01] transition-all">
                    <td className="py-2.5 text-white/60 whitespace-nowrap font-mono tracking-tight">{fmtTime(e.timestamp)}</td>
                    <td className="py-2.5"><SeverityBadge severity={e.severity} /></td>
                    <td className="text-white/70 py-2.5 font-mono tracking-tight">{e.service ?? "—"}</td>
                    <td className="text-white/80 py-2.5 font-sans leading-relaxed">{e.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        )}
      </div>
    </div>
  );
}
