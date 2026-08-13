import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type ExecutiveAnalytics } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { Stat } from "../ui";
import { Globe, Server } from "lucide-react";

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
    <div className="font-sans">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Noisy Services */}
        <div className="card border border-[#252940] bg-[#161928]">
          <div className="font-semibold mb-4 text-white">Top noisy services</div>
          {data.top_noisy_services.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.top_noisy_services} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="service" width={100} tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "JetBrains Mono" }} />
                <Tooltip contentStyle={{ backgroundColor: "#141724", borderColor: "#252940", borderRadius: "8px", color: "#f8fafc", fontFamily: "JetBrains Mono" }} />
                <Bar dataKey="events" radius={4}>
                  {data.top_noisy_services.map((_, i) => <Cell key={i} fill="#5b8def" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="text-white/40 text-sm py-8 text-center italic">No data.</div>}
        </div>

        {/* Top Error Fingerprints */}
        <div className="card border border-[#252940] bg-[#161928]">
          <div className="font-semibold mb-4 text-white">Top error fingerprints</div>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-white/40 border-b border-[#252940] text-[10px] uppercase tracking-wider font-mono">
                <th className="pb-2">Fingerprint Title</th>
                <th className="pb-2 text-right">Event Count</th>
              </tr>
            </thead>
            <tbody>
              {data.top_error_fingerprints.map((f) => (
                <tr key={f.fingerprint} className="border-b border-[#252940]/40 hover:bg-white/[0.01] transition-all">
                  <td className="py-2.5 font-medium text-white/90 truncate max-w-xs">{f.title}</td>
                  <td className="text-right text-white/70 py-2.5 font-mono tracking-tight">{f.events.toLocaleString()}</td>
                </tr>
              ))}
              {!data.top_error_fingerprints.length && (
                <tr><td className="text-white/40 py-8 text-center italic" colSpan={2}>No data.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top Affected Applications */}
        <div className="card border border-[#252940] bg-[#161928]">
          <div className="font-semibold mb-4 text-white">Top affected applications</div>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-white/40 border-b border-[#252940] text-[10px] uppercase tracking-wider font-mono">
                <th className="pb-2">Application Name</th>
                <th className="pb-2 text-right">Event Count</th>
              </tr>
            </thead>
            <tbody>
              {data.top_affected_applications.map((a) => (
                <tr key={a.application} className="border-b border-[#252940]/40 hover:bg-white/[0.01] transition-all">
                  <td className="py-2.5 font-medium text-white/90">{a.application}</td>
                  <td className="text-right text-white/70 py-2.5 font-mono tracking-tight">{a.events.toLocaleString()}</td>
                </tr>
              ))}
              {!data.top_affected_applications.length && (
                <tr><td className="text-white/40 py-8 text-center italic" colSpan={2}>No data.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Regional Health */}
        <div className="card border border-[#252940] bg-[#161928]">
          <div className="font-semibold mb-4 text-white">Regional health</div>
          <table className="w-full text-xs text-left mb-6">
            <thead>
              <tr className="text-white/40 border-b border-[#252940] text-[10px] uppercase tracking-wider font-mono">
                <th className="pb-2">Region</th>
                <th className="pb-2 text-right">Event Count</th>
              </tr>
            </thead>
            <tbody>
              {data.regional_health.map((r) => (
                <tr key={r.region} className="border-b border-[#252940]/40 hover:bg-white/[0.01] transition-all">
                  <td className="py-2.5 font-medium text-white/90 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#98A4F7]" />
                    <span>{r.region}</span>
                  </td>
                  <td className="text-right text-white/70 py-2.5 font-mono tracking-tight">{r.events.toLocaleString()} events</td>
                </tr>
              ))}
              {!data.regional_health.length && (
                <tr><td className="text-white/40 py-8 text-center italic" colSpan={2}>No data.</td></tr>
              )}
            </tbody>
          </table>
          
          {data.top_affected_devices.length > 0 && (
            <>
              <div className="font-semibold mt-6 mb-3 text-white">Top devices</div>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-white/40 border-b border-[#252940] text-[10px] uppercase tracking-wider font-mono">
                    <th className="pb-2">Hostname</th>
                    <th className="pb-2 text-right">Event Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_affected_devices.map((d) => (
                    <tr key={d.hostname} className="border-b border-[#252940]/40 hover:bg-white/[0.01] transition-all">
                      <td className="py-2.5 font-medium text-white/90 flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-[#98A4F7]" />
                        <span>{d.hostname}</span>
                      </td>
                      <td className="text-right text-white/70 py-2.5 font-mono tracking-tight">{d.events.toLocaleString()}</td>
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
