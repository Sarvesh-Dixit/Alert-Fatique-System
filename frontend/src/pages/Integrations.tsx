import { useCallback, useEffect, useState } from "react";
import { api, type Integration } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../ui";

const TYPES = [
  { id: "slack", label: "Slack", field: "webhook_url", placeholder: "https://hooks.slack.com/services/…" },
  { id: "discord", label: "Discord", field: "webhook_url", placeholder: "https://discord.com/api/webhooks/…" },
  { id: "email", label: "Email", field: "recipients", placeholder: "ops@company.com, oncall@company.com" },
];
const SEVERITIES = ["INFO", "WARNING", "ERROR", "HIGH", "CRITICAL"];

export default function Integrations() {
  const { currentOrg } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [form, setForm] = useState({ type: "slack", value: "", min_severity: "HIGH" });
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setIntegrations(await api.get<Integration[]>(`/organizations/${currentOrg.id}/integrations`));
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const meta = TYPES.find((t) => t.id === form.type)!;

  async function save() {
    if (!currentOrg) return;
    setMsg("");
    setSaving(true);
    const config = { [meta.field]: form.value };
    try {
      await api.put(`/organizations/${currentOrg.id}/integrations`, {
        type: form.type,
        config,
        min_severity: form.min_severity,
        enabled: true,
      });
      setForm({ ...form, value: "" });
      await load();
      setMsg("Saved.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function test(type: string) {
    if (!currentOrg) return;
    setMsg("");
    setTesting(type);
    try {
      await api.post(`/organizations/${currentOrg.id}/integrations/${type}/test`);
      setMsg(`Test notification sent via ${type}.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setTesting(null);
    }
  }

  async function remove(type: string) {
    if (!currentOrg) return;
    await api.del(`/organizations/${currentOrg.id}/integrations/${type}`);
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Notification Integrations</h1>
      <p className="text-white/40 text-sm mb-6">
        Incidents are delivered here after the cooldown matrix decides to notify — never one message per event.
      </p>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">Provider</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">{meta.field === "recipients" ? "Recipients" : "Webhook URL"}</label>
            <input className="input" placeholder={meta.placeholder} value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <div>
            <label className="label">Min severity</label>
            <select className="input" value={form.min_severity} onChange={(e) => setForm({ ...form, min_severity: e.target.value })}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <button className="btn mt-4" onClick={save} disabled={!form.value || saving}>
          {saving ? "Saving…" : "Save integration"}
        </button>
        {msg && <span className="ml-3 text-sm text-white/60">{msg}</span>}
      </div>

      <div className="card">
        <div className="font-semibold mb-3">Configured providers</div>
        {integrations.length === 0 ? (
          <EmptyState>No integrations configured yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-white/40 text-left">
              <tr><th className="py-2">Provider</th><th>Config</th><th>Min severity</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <tr key={i.id} className="border-t border-white/5">
                  <td className="py-2 capitalize">{i.type}</td>
                  <td className="text-white/60 truncate max-w-xs">
                    {String(i.config.webhook_url ?? i.config.recipients ?? "")}
                  </td>
                  <td>{i.min_severity}</td>
                  <td>
                    {i.last_error
                      ? <span className="badge bg-red-500/20 text-red-300">error</span>
                      : <span className="badge bg-emerald-500/20 text-emerald-300">{i.enabled ? "enabled" : "disabled"}</span>}
                  </td>
                  <td className="text-right">
                    <button className="btn-ghost mr-2" onClick={() => test(i.type)} disabled={testing === i.type}>
                      {testing === i.type ? "Testing…" : "Test"}
                    </button>
                    <button className="btn-ghost" onClick={() => remove(i.type)}>Remove</button>
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
