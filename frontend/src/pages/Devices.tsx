import { useCallback, useEffect, useState } from "react";
import { api, API_BASE, type Device, type SecurityDashboard } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EmptyState, Stat, fmtTime } from "../ui";
import { Server, ShieldCheck, Globe, Cpu } from "lucide-react";

export default function Devices() {
  const { currentOrg } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [security, setSecurity] = useState<SecurityDashboard | null>(null);
  const [reg, setReg] = useState<Device | null>(null);
  const [form, setForm] = useState({ hostname: "", operating_system: "linux", region: "india" });
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const [d, s] = await Promise.all([
      api.get<Device[]>(`/organizations/${currentOrg.id}/devices`),
      api.get<SecurityDashboard>(`/organizations/${currentOrg.id}/analytics/security`).catch(() => null),
    ]);
    setDevices(d);
    setSecurity(s);
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg) return;
    const res = await api.post<Device>(`/organizations/${currentOrg.id}/devices`, form);
    setReg(res);
    setCopied(false);
    setForm({ hostname: "", operating_system: "linux", region: "india" });
    await load();
  }

  async function removeDevice(id: string) {
    if (!currentOrg) return;
    await api.del(`/organizations/${currentOrg.id}/devices/${id}`);
    await load();
  }

  return (
    <div className="font-sans">
      <h1 className="text-2xl font-bold mb-1">Devices & Security</h1>
      <p className="text-white/40 text-sm mb-6">
        Enroll read-only OS agents. Their telemetry flows through the same intelligence engine as applications.
      </p>

      {security && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Stat label="Active devices" value={`${security.active_devices}/${security.total_devices}`} />
          <Stat label="Auth failures" value={security.authentication_failures} tone={security.authentication_failures ? "text-amber-400" : ""} />
          <Stat label="Redactions" value={security.redactions} tone="text-emerald-400" />
          <Stat label="Rate-limit hits" value={security.rate_limit_violations} />
        </div>
      )}

      <form className="card mb-4 flex items-end gap-3 flex-wrap border border-[#252940] bg-[#161928]" onSubmit={register}>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Hostname</label>
          <input className="input bg-[#0B0C14] border border-[#252940] focus:border-cyan-400" value={form.hostname} required
            onChange={(e) => setForm({ ...form, hostname: e.target.value })} />
        </div>
        <div>
          <label className="label">OS</label>
          <select className="input bg-[#0B0C14] border border-[#252940] focus:border-cyan-400" value={form.operating_system}
            onChange={(e) => setForm({ ...form, operating_system: e.target.value })}>
            <option value="linux" className="bg-[#0f101a]">Linux</option>
            <option value="windows" className="bg-[#0f101a]">Windows</option>
            <option value="macos" className="bg-[#0f101a]">macOS</option>
          </select>
        </div>
        <div>
          <label className="label">Region</label>
          <input className="input bg-[#0B0C14] border border-[#252940] focus:border-cyan-400" value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </div>
        <button className="btn bg-gradient-to-r from-[#98A4F7] to-[#5B63D3] hover:from-[#98A4F7]/90 hover:to-[#5B63D3]/90 text-white font-semibold h-[42px] px-5 rounded-lg transition-all">Add device</button>
      </form>

      {reg?.enrollment_token && (
        <div className="card mb-6 border-emerald-500/40 bg-[#161928]">
          <div className="text-emerald-300 font-semibold mb-2 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Device registered — enroll the agent (token is single-use)</span>
          </div>
          <div className="text-white/60 text-sm mb-2">Install the agent, then run:</div>
          <code className="block bg-[#0B0C14] border border-[#252940] p-3 rounded-lg break-all text-sm font-mono tracking-tight text-white/80">
            th-agent enroll --endpoint {API_BASE} --device-id {reg.id} --token {reg.enrollment_token}
          </code>
          <div className="flex gap-2 mt-3">
            <button
              className="btn-ghost"
              onClick={() => {
                navigator.clipboard.writeText(`th-agent enroll --endpoint ${API_BASE} --device-id ${reg.id} --token ${reg.enrollment_token}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied!" : "Copy Command"}
            </button>
            <button className="btn-ghost" onClick={() => setReg(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="card border border-[#252940] bg-[#161928]">
        {devices.length === 0 ? (
          <EmptyState>No devices registered.</EmptyState>
        ) : (
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-white/40 border-b border-[#252940] text-[10px] uppercase tracking-wider font-mono">
                <th className="py-2">Hostname</th>
                <th>OS</th>
                <th>Agent</th>
                <th>Region</th>
                <th>Status</th>
                <th>Last heartbeat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-[#252940]/40 hover:bg-white/[0.01] transition-all">
                  <td className="py-2.5 font-medium text-white/90 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{d.hostname}</span>
                  </td>
                  <td className="text-white/60 py-2.5 capitalize">{d.operating_system ?? "—"}</td>
                  <td className="text-white/60 py-2.5 font-mono tracking-tight">{d.agent_version ?? "—"}</td>
                  <td className="text-white/60 py-2.5 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>{d.region ?? "—"}</span>
                  </td>
                  <td className="py-2.5">
                    <span className={`badge ${d.status === "online" ? "bg-emerald-500/20 text-emerald-300" :
                      d.status === "enrolled" ? "bg-sky-500/20 text-sky-300" :
                      d.status === "revoked" ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/60"}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="text-white/60 py-2.5 font-mono tracking-tight">{fmtTime(d.last_heartbeat_at)}</td>
                  <td className="text-right py-2.5">
                    {d.status !== "revoked" && (
                      <button className="btn-ghost text-[11px]" onClick={() => removeDevice(d.id)}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
