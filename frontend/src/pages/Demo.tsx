import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DemoScenario } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { SeverityBadge } from "../ui";

interface SimIncident {
  id: string;
  title: string;
  severity: string;
  status: string;
  event_count: number;
  affected_instances: number;
  affected_services: number;
  affected_applications: number;
  spike_multiplier: number;
  notifications_sent: number;
  events_suppressed: number;
  noise_reduction_ratio: number;
}
interface SimResult {
  scenario: string;
  events_generated: number;
  applications: number;
  incidents: SimIncident[];
  notifications_sent: number;
  events_suppressed: number;
}

export default function Demo() {
  const { currentOrg } = useAuth();
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [count, setCount] = useState(2000);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<SimResult | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    api.get<DemoScenario[]>(`/organizations/${currentOrg.id}/demo/scenarios`).then(setScenarios);
  }, [currentOrg?.id]);

  async function run(scenario: string) {
    if (!currentOrg) return;
    setBusy(scenario);
    setResult(null);
    try {
      const res = await api.post<SimResult>(
        `/organizations/${currentOrg.id}/demo/simulate/${scenario}?count=${count}&apps=3`,
      );
      setResult(res);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Demo Simulator</h1>
      <p className="text-white/40 text-sm mb-6">
        Generate telemetry through the real intelligence pipeline and watch thousands of events
        collapse into a handful of incidents and notifications.
      </p>

      <div className="card mb-6 flex items-end gap-4">
        <div className="w-48">
          <label className="label">Events to generate</label>
          <input
            type="number"
            className="input"
            value={count}
            min={1}
            max={20000}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </div>
        <div className="text-white/40 text-sm pb-2">Spread across 3 demo applications.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {scenarios.map((s) => (
          <div key={s.id} className="card">
            <div className="font-semibold capitalize">{s.id.replace(/-/g, " ")}</div>
            <div className="text-white/50 text-sm mt-1 mb-4 min-h-[40px]">{s.description}</div>
            <button className="btn w-full" disabled={!!busy} onClick={() => run(s.id)}>
              {busy === s.id ? "Simulating…" : "Run scenario"}
            </button>
          </div>
        ))}
      </div>

      {result && (
        <div className="card border-accent/40">
          <div className="text-lg font-semibold mb-1 capitalize">
            {result.scenario.replace(/-/g, " ")} — results
          </div>
          <div className="text-white/60 text-sm mb-4">
            <span className="text-accent font-semibold">{result.events_generated.toLocaleString()}</span> events →
            {" "}<span className="text-accent font-semibold">{result.incidents.length}</span> incident(s) →
            {" "}<span className="text-accent font-semibold">{result.notifications_sent}</span> notification(s)
          </div>
          <div className="space-y-2">
            {result.incidents.map((i) => (
              <Link key={i.id} to={`/incidents/${i.id}`} className="block border border-white/10 rounded-lg p-3 hover:border-accent/50">
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={i.severity} />
                  <span className="font-medium truncate">{i.title}</span>
                </div>
                <div className="text-white/50 text-xs flex flex-wrap gap-x-4 gap-y-1">
                  <span>{i.event_count.toLocaleString()} events</span>
                  <span>{i.affected_instances} instances</span>
                  <span>{i.affected_services} services</span>
                  <span>{i.affected_applications} apps</span>
                  <span>{i.spike_multiplier}× spike</span>
                  <span className="text-emerald-400">{i.noise_reduction_ratio}% noise reduction</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
