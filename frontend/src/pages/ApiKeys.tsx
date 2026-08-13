import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ApiKey } from "../api/client";
import { EmptyState, fmtTime } from "../ui";

export default function ApiKeys() {
  const { appId } = useParams();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState("default");
  const [copied, setCopied] = useState(false);

  async function load() {
    setKeys(await api.get<ApiKey[]>(`/applications/${appId}/api-keys`));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  async function createKey() {
    const res = await api.post<ApiKey>(`/applications/${appId}/api-keys`, {
      name,
      environment_scope: "production",
    });
    setNewKey(res.api_key ?? null);
    setCopied(false);
    await load();
  }
  async function revoke(id: string) {
    await api.post(`/applications/${appId}/api-keys/${id}/revoke`);
    await load();
  }
  async function rotate(id: string) {
    const res = await api.post<ApiKey>(`/applications/${appId}/api-keys/${id}/rotate`);
    setNewKey(res.api_key ?? null);
    setCopied(false);
    await load();
  }

  return (
    <div className="font-sans">
      <Link to={`/applications/${appId}`} className="text-white/40 text-sm hover:text-white">← Back to application</Link>
      <h1 className="text-2xl font-bold mb-6 mt-1">API Keys</h1>

      <div className="card mb-6 flex items-end gap-3 border border-[#252940] bg-[#161928]">
        <div className="flex-1">
          <label className="label">Key name</label>
          <input className="input bg-[#0B0C14] border border-[#252940] focus:border-cyan-400" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn bg-gradient-to-r from-[#98A4F7] to-[#5B63D3] hover:from-[#98A4F7]/90 hover:to-[#5B63D3]/90 text-white" onClick={createKey}>Generate key</button>
      </div>

      {newKey && (
        <div className="card mb-6 border-emerald-500/40 bg-[#161928]">
          <div className="text-emerald-300 font-semibold mb-1">New API key — copy it now, it won't be shown again</div>
          <code className="block bg-[#0B0C14] border border-[#252940] p-3 rounded-lg break-all text-sm font-mono tracking-tight">{newKey}</code>
          <div className="flex gap-2 mt-3">
            <button 
              className="btn-ghost" 
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button className="btn-ghost" onClick={() => setNewKey(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="card border border-[#252940] bg-[#161928]">
        {keys.length === 0 ? (
          <EmptyState>No API keys. Generate one to start sending telemetry.</EmptyState>
        ) : (
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-white/40 border-b border-[#252940] text-[10px] uppercase tracking-wider font-mono">
                <th className="py-2">Name</th>
                <th>Key</th>
                <th>Scope</th>
                <th>Last used</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-[#252940]/40 hover:bg-white/[0.01] transition-all">
                  <td className="py-2.5 font-medium text-white/90">{k.name}</td>
                  <td><code className="text-white/60 font-mono tracking-tight">{k.masked_key}</code></td>
                  <td className="text-white/60 font-mono tracking-tight">{k.environment_scope}</td>
                  <td className="text-white/60 font-mono tracking-tight">{fmtTime(k.last_used_at)}</td>
                  <td>
                    <span className={`badge ${k.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                      {k.is_active ? "active" : "revoked"}
                    </span>
                  </td>
                  <td className="text-right">
                    {k.is_active && (
                      <>
                        <button className="btn-ghost mr-2 text-[11px]" onClick={() => rotate(k.id)}>Rotate</button>
                        <button className="btn-ghost text-[11px]" onClick={() => revoke(k.id)}>Revoke</button>
                      </>
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
