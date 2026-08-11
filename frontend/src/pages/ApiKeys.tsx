import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ApiKey } from "../api/client";
import { EmptyState, fmtTime } from "../ui";

export default function ApiKeys() {
  const { appId } = useParams();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState("default");

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
    await load();
  }
  async function revoke(id: string) {
    await api.post(`/applications/${appId}/api-keys/${id}/revoke`);
    await load();
  }
  async function rotate(id: string) {
    const res = await api.post<ApiKey>(`/applications/${appId}/api-keys/${id}/rotate`);
    setNewKey(res.api_key ?? null);
    await load();
  }

  return (
    <div>
      <Link to={`/applications/${appId}`} className="text-white/40 text-sm hover:text-white">← Back to application</Link>
      <h1 className="text-2xl font-bold mb-6 mt-1">API Keys</h1>

      <div className="card mb-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="label">Key name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn" onClick={createKey}>Generate key</button>
      </div>

      {newKey && (
        <div className="card mb-6 border-emerald-500/40">
          <div className="text-emerald-300 font-semibold mb-1">New API key — copy it now, it won't be shown again</div>
          <code className="block bg-ink p-3 rounded-lg break-all text-sm">{newKey}</code>
          <button className="btn-ghost mt-3" onClick={() => navigator.clipboard.writeText(newKey)}>Copy</button>
          <button className="btn-ghost mt-3 ml-2" onClick={() => setNewKey(null)}>Dismiss</button>
        </div>
      )}

      <div className="card">
        {keys.length === 0 ? (
          <EmptyState>No API keys. Generate one to start sending telemetry.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-white/40 text-left">
              <tr>
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
                <tr key={k.id} className="border-t border-white/5">
                  <td className="py-2">{k.name}</td>
                  <td><code className="text-white/60">{k.masked_key}</code></td>
                  <td className="text-white/60">{k.environment_scope}</td>
                  <td className="text-white/60">{fmtTime(k.last_used_at)}</td>
                  <td>
                    <span className={`badge ${k.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                      {k.is_active ? "active" : "revoked"}
                    </span>
                  </td>
                  <td className="text-right">
                    {k.is_active && (
                      <>
                        <button className="btn-ghost mr-2" onClick={() => rotate(k.id)}>Rotate</button>
                        <button className="btn-ghost" onClick={() => revoke(k.id)}>Revoke</button>
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
