import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { api, type Incident, type NoiseReductionKPIs } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { SeverityBadge, Stat, StatusBadge, fmtTime } from "../ui";

export default function Overview() {
  const { currentOrg } = useAuth();
  const [kpis, setKpis] = useState<NoiseReductionKPIs | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const [k, inc] = await Promise.all([
      api.get<NoiseReductionKPIs>(`/organizations/${currentOrg.id}/kpis`),
      api.get<Incident[]>(`/organizations/${currentOrg.id}/incidents?status=OPEN&limit=8`),
    ]);
    setKpis(k);
    setIncidents(inc);
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  useIncidentStream(currentOrg?.id, load);

  const pie = kpis
    ? [
        { name: "Notifications sent", value: kpis.notifications_sent },
        { name: "Suppressed", value: kpis.events_suppressed },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Overview</h1>
      <p className="text-white/40 text-sm mb-6">Live noise-reduction KPIs and active incidents.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Events received" value={kpis?.events_received ?? 0} />
        <Stat label="Active incidents" value={kpis?.active_incidents ?? 0} tone="text-red-400" />
        <Stat label="Notifications sent" value={kpis?.notifications_sent ?? 0} />
        <Stat
          label="Noise reduction"
          value={`${kpis?.noise_reduction_ratio ?? 0}%`}
          tone="text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card lg:col-span-1">
          <div className="font-semibold mb-3">Signal vs noise</div>
          {kpis && (kpis.notifications_sent > 0 || kpis.events_suppressed > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  <Cell fill="#5b8def" />
                  <Cell fill="#334155" />
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#141a2e", border: "1px solid #ffffff20" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-white/40 text-sm py-12 text-center">No data yet.</div>
          )}
          <div className="text-xs text-white/50 mt-2">
            {kpis?.naive_notifications ?? 0} naive notifications → {kpis?.notifications_sent ?? 0} actual
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Active incidents</div>
            <Link to="/incidents" className="text-accent text-sm">View all →</Link>
          </div>
          {incidents.length === 0 ? (
            <div className="text-white/40 text-sm py-8 text-center">No active incidents 🎉</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id} className="border-t border-white/5">
                    <td className="py-2"><SeverityBadge severity={i.severity} /></td>
                    <td className="py-2">
                      <Link to={`/incidents/${i.id}`} className="hover:text-accent">{i.title}</Link>
                    </td>
                    <td className="text-white/60 text-right">{i.event_count} events</td>
                    <td className="text-right"><StatusBadge status={i.status} /></td>
                    <td className="text-white/40 text-right whitespace-nowrap">{fmtTime(i.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
