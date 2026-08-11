import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type ExecutiveAnalytics } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { Stat } from "../ui";

export default function Analytics() {
  const { currentOrg } = useAuth();
  const [data, setData] = useState<ExecutiveAnalytics | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setData(await api.get<ExecutiveAnalytics>(`/organizations/${currentOrg.id}/analytics/executive`));
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);
  useIncidentStream(currentOrg?.id, load);

  if (!data) return <div className="text-white/50">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Executive Analytics</h1>
      <p className="text-white/40 text-sm mb-6">Fleet-wide telemetry and alert-fatigue reduction.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Events received" value={data.events_received.toLocaleString()} />
        <Stat label="Potential alerts" value={data.potential_alerts.toLocaleString()} />
        <Stat label="Actual notifications" value={data.actual_notifications.toLocaleString()} />
        <Stat label="Noise reduction" value={`${data.noise_reduction_ratio}%`} tone="text-emerald-400" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Active incidents" value={data.active_incidents} />
        <Stat label="Critical" value={data.critical_incidents} tone="text-red-400" />
        <Stat label="Alerts suppressed" value={data.alerts_suppressed.toLocaleString()} />
        <Stat label="Avg incident (min)" value={data.avg_incident_duration_minutes} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-semibold mb-3">Top noisy services</div>
          {data.top_noisy_services.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.top_noisy_services} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="service" width={100} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#141a2e", border: "1px solid #ffffff20" }} />
                <Bar dataKey="events" radius={4}>
                  {data.top_noisy_services.map((_, i) => <Cell key={i} fill="#5b8def" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="text-white/40 text-sm py-8 text-center">No data.</div>}
        </div>

        <div className="card">
          <div className="font-semibold mb-3">Top error fingerprints</div>
          <table className="w-full text-sm">
            <tbody>
              {data.top_error_fingerprints.map((f) => (
                <tr key={f.fingerprint} className="border-t border-white/5">
                  <td className="py-2 truncate max-w-xs">{f.title}</td>
                  <td className="text-right text-white/60">{f.events.toLocaleString()}</td>
                </tr>
              ))}
              {!data.top_error_fingerprints.length && (
                <tr><td className="text-white/40 py-8 text-center">No data.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="font-semibold mb-3">Top affected applications</div>
          <table className="w-full text-sm">
            <tbody>
              {data.top_affected_applications.map((a) => (
                <tr key={a.application} className="border-t border-white/5">
                  <td className="py-2">{a.application}</td>
                  <td className="text-right text-white/60">{a.events.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="font-semibold mb-3">Regional health</div>
          <table className="w-full text-sm">
            <tbody>
              {data.regional_health.map((r) => (
                <tr key={r.region} className="border-t border-white/5">
                  <td className="py-2">🌍 {r.region}</td>
                  <td className="text-right text-white/60">{r.events.toLocaleString()} events</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.top_affected_devices.length > 0 && (
            <>
              <div className="font-semibold mt-4 mb-2">Top devices</div>
              <table className="w-full text-sm">
                <tbody>
                  {data.top_affected_devices.map((d) => (
                    <tr key={d.hostname} className="border-t border-white/5">
                      <td className="py-2">💻 {d.hostname}</td>
                      <td className="text-right text-white/60">{d.events.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
