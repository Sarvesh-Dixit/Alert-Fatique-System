import { useCallback, useEffect, useState } from "react";
import { api, API_BASE, type Device, type SecurityDashboard } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EmptyState, Stat, fmtTime } from "../ui";

export default function Devices() {
  const { currentOrg } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [security, setSecurity] = useState<SecurityDashboard | null>(null);
  const [reg, setReg] = useState<Device | null>(null);
  const [form, setForm] = useState({ hostname: "", operating_system: "linux", region: "india" });

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
    setForm({ hostname: "", operating_system: "linux", region: "india" });
    await load();
  }

  async function removeDevice(id: string) {
    if (!currentOrg) return;
    await api.del(`/organizations/${currentOrg.id}/devices/${id}`);
    await load();
  }

  return (
    <div>
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

      <form className="card mb-4 flex items-end gap-3 flex-wrap" onSubmit={register}>
        <div className="flex-1 min-w-[160px]">
          <label className="label">Hostname</label>
          <input className="input" value={form.hostname} required
            onChange={(e) => setForm({ ...form, hostname: e.target.value })} />
        </div>
        <div>
          <label className="label">OS</label>
          <select className="input" value={form.operating_system}
            onChange={(e) => setForm({ ...form, operating_system: e.target.value })}>
            <option value="linux">Linux</option>
            <option value="windows">Windows</option>
            <option value="macos">macOS</option>
          </select>
        </div>
        <div>
          <label className="label">Region</label>
          <input className="input" value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </div>
        <button className="btn">Add device</button>
      </form>

      {reg?.enrollment_token && (
        <div className="card mb-6 border-emerald-500/40">
          <div className="text-emerald-300 font-semibold mb-2">Device registered — enroll the agent (token is single-use)</div>
          <div className="text-white/60 text-sm mb-2">Install the agent, then run:</div>
          <code className="block bg-ink p-3 rounded-lg break-all text-sm">
            th-agent enroll --endpoint {API_BASE} --device-id {reg.id} --token {reg.enrollment_token}
          </code>
          <button className="btn-ghost mt-3" onClick={() => setReg(null)}>Dismiss</button>
        </div>
      )}

      <div className="card">
        {devices.length === 0 ? (
          <EmptyState>No devices registered.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-white/40 text-left">
              <tr>
                <th className="py-2">Hostname</th><th>OS</th><th>Agent</th><th>Region</th>
                <th>Status</th><th>Last heartbeat</th><th></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-t border-white/5">
                  <td className="py-2">{d.hostname}</td>
                  <td className="text-white/60">{d.operating_system ?? "—"}</td>
                  <td className="text-white/60">{d.agent_version ?? "—"}</td>
                  <td className="text-white/60">{d.region ?? "—"}</td>
                  <td>
                    <span className={`badge ${d.status === "online" ? "bg-emerald-500/20 text-emerald-300" :
                      d.status === "enrolled" ? "bg-sky-500/20 text-sky-300" :
                      d.status === "revoked" ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/60"}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="text-white/60">{fmtTime(d.last_heartbeat_at)}</td>
                  <td className="text-right">
                    {d.status !== "revoked" && (
                      <button className="btn-ghost" onClick={() => removeDevice(d.id)}>Remove</button>
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
