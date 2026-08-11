import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Application } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EmptyState, fmtTime } from "../ui";

export default function Applications() {
  const { currentOrg } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", environment: "production", region: "", description: "" });
  const [error, setError] = useState("");

  async function load() {
    if (!currentOrg) return;
    setApps(await api.get<Application[]>(`/organizations/${currentOrg.id}/applications`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg) return;
    setError("");
    try {
      await api.post(`/organizations/${currentOrg.id}/applications`, {
        name: form.name,
        environment: form.environment,
        region: form.region || null,
        description: form.description || null,
      });
      setForm({ name: "", environment: "production", region: "", description: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Applications</h1>
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Create application"}
        </button>
      </div>

      {showForm && (
        <form className="card mb-6 grid grid-cols-2 gap-4" onSubmit={create}>
          <div className="col-span-2">
            <label className="label">Application name</label>
            <input className="input" placeholder="Payment API" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Environment</label>
            <input className="input" value={form.environment}
              onChange={(e) => setForm({ ...form, environment: e.target.value })} />
          </div>
          <div>
            <label className="label">Region</label>
            <input className="input" placeholder="india" value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <input className="input" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {error && <div className="col-span-2 text-red-400 text-sm">{error}</div>}
          <div className="col-span-2">
            <button className="btn">Create</button>
          </div>
        </form>
      )}

      {apps.length === 0 ? (
        <EmptyState>No applications yet. Create one to get an API key.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app) => (
            <Link key={app.id} to={`/applications/${app.id}`} className="card hover:border-accent/50 transition">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-lg">{app.name}</div>
                <span className="badge bg-white/10 text-white/70">{app.environment}</span>
              </div>
              <div className="text-white/40 text-sm mt-1">{app.region ?? "—"}</div>
              <div className="text-white/50 text-sm mt-3 line-clamp-2">{app.description ?? ""}</div>
              <div className="text-white/30 text-xs mt-4">Created {fmtTime(app.created_at)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
