import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DemoScenario } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTelemetryInjection } from "../context/TelemetryToastContext";
import { SeverityBadge } from "../ui";
import { 
  Play, 
  Terminal, 
  Sliders, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  X,
  Sparkles,
  Database,
  Layers,
  Zap,
  TrendingDown
} from "lucide-react";

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
  const [count, setCount] = useState(30);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<SimResult | null>(null);
  const { triggerTelemetryInjection } = useTelemetryInjection();

  useEffect(() => {
    if (!currentOrg) return;
    api.get<DemoScenario[]>(`/organizations/${currentOrg.id}/demo/scenarios`).then(setScenarios);
  }, [currentOrg?.id]);

  async function run(scenario: string) {
    if (!currentOrg) return;
    setBusy(scenario);
    setResult(null);

    await triggerTelemetryInjection(currentOrg.id, scenario, count, async () => {
      try {
        const res = await api.post<SimResult>(
          `/organizations/${currentOrg.id}/demo/simulate?sync=true&pattern=${scenario}&count=${count}`,
          { pattern: scenario, sync: true }
        );
        setResult(res);
      } catch (err) {
        console.error("Failed to load diagnostic report", err);
      }
    });
    setBusy("");
  }

  const getScenarioIcon = (id: string) => {
    const name = id.toLowerCase();
    if (name.includes("database") || name.includes("postgres")) return <Layers className="w-5 h-5 text-rose-400" />;
    if (name.includes("hdfs") || name.includes("outage") || name.includes("storage")) return <Database className="w-5 h-5 text-cyan-400" />;
    if (name.includes("burst") || name.includes("spike")) return <Zap className="w-5 h-5 text-amber-400" />;
    return <Activity className="w-5 h-5 text-indigo-400" />;
  };

  return (
    <div className="font-sans max-w-5xl relative">

      {/* Header Banner */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 text-white/95 flex items-center gap-2">
          <Sliders className="w-6 h-6 text-cyan-400" />
          <span>Demo Simulator Control Center</span>
        </h1>
        <p className="text-white/40 text-sm max-w-3xl leading-relaxed">
          Inject heavy telemetry traffic scenarios into the ingestion gateway. Watch how thousands of raw logs are grouped using semantic embeddings, filtered, and suppressed down to actionable system issues.
        </p>
      </div>

      {/* Configuration Card */}
      <div className="card mb-6 border border-[#252940] bg-[#161928] p-6 shadow-xl rounded-xl">
        <h2 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>Ingestion Rate Controller</span>
        </h2>
        
        <div className="flex flex-col md:flex-row md:items-end gap-6">
          <div className="w-full md:w-64">
            <label className="label text-[10px] font-bold text-white/50 uppercase tracking-wider">Events to Ingest</label>
            <div className="relative mt-1">
              <input
                type="number"
                className="input pl-3 pr-12 bg-[#0B0C14] border border-[#252940] focus:border-cyan-400 font-mono tracking-tight text-white/95"
                value={count}
                min={10}
                max={50}
                onChange={(e) => setCount(Number(e.target.value))}
              />
              <span className="absolute right-3 top-2.5 font-mono text-[10px] text-white/30 uppercase">logs</span>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col gap-1 text-xs text-white/40 pb-2">
            <div>
              • Traffic will be distributed across <strong className="text-white">3 simulated microservices</strong>.
            </div>
            <div>
              • Recommended scale: <strong className="text-white">30 to 50 logs</strong> to verify cooldown suppressions without CPU overhead.
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Grid */}
      <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">Available Simulation Scenarios</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {scenarios.map((s) => {
          const isBusy = busy === s.id;
          return (
            <div 
              key={s.id} 
              className="card border border-[#252940] bg-[#161928] hover:border-cyan-500/30 transition-all duration-300 flex flex-col justify-between shadow-lg hover:shadow-cyan-500/5"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {getScenarioIcon(s.id)}
                  <h3 className="font-semibold text-white/95 capitalize">{s.id.replace(/-/g, " ")}</h3>
                </div>
                <p className="text-white/40 text-xs leading-relaxed min-h-[48px]">{s.description}</p>
              </div>
              
              <button 
                className="btn w-full mt-4 bg-gradient-to-r from-[#98A4F7] to-[#5B63D3] hover:from-[#98A4F7]/95 hover:to-[#5B63D3]/90 text-white font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer" 
                disabled={!!busy} 
                onClick={() => run(s.id)}
              >
                <Play className="w-3 h-3 fill-current shrink-0" />
                <span>{isBusy ? "Injecting..." : "Inject Scenario"}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Results Section */}
      {result && (
        <div className="card border border-[#252940] bg-[#161928] p-6 shadow-2xl rounded-xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-[#252940] pb-4 mb-4">
            <div>
              <h2 className="text-sm font-bold text-white/95 capitalize flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>Simulation Diagnostic Report</span>
              </h2>
              <p className="text-[10px] text-white/40 font-mono mt-0.5">Scenario: {result.scenario}</p>
            </div>
            
            <div className="text-right flex flex-col items-end">
              <span className="text-[9px] text-emerald-400 font-mono font-extrabold uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">SSE Synced</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center mb-6">
            <div className="p-3 bg-[#0B0C14] border border-[#252940] rounded-lg">
              <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold font-sans">Total Logs Ingested</div>
              <div className="text-lg font-mono font-bold tracking-tight text-white mt-1">{result.events_generated.toLocaleString()}</div>
            </div>
            <div className="p-3 bg-[#0B0C14] border border-[#252940] rounded-lg">
              <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold font-sans">Incidents Formed</div>
              <div className="text-lg font-mono font-bold tracking-tight text-rose-400 mt-1">{result.incidents.length}</div>
            </div>
            <div className="p-3 bg-[#0B0C14] border border-[#252940] rounded-lg">
              <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold font-sans">Webhooks Sent</div>
              <div className="text-lg font-mono font-bold tracking-tight text-amber-400 mt-1">{result.notifications_sent}</div>
            </div>
          </div>

          <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2.5">Correlated Incidents Output</h3>
          <div className="space-y-2">
            {result.incidents.map((i) => (
              <Link 
                key={i.id} 
                to={`/incidents/${i.id}`} 
                className="block border border-[#252940] hover:border-cyan-500/30 bg-[#0B0C14]/30 rounded-lg p-3.5 transition duration-200"
              >
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <SeverityBadge severity={i.severity} />
                    <span className="font-semibold text-white/90 truncate text-xs">{i.title}</span>
                  </div>
                  <span className="text-[9px] text-white/30 font-mono shrink-0">ID: {i.id.slice(-6)}</span>
                </div>
                
                <div className="text-white/50 text-[10px] flex flex-wrap gap-x-4 gap-y-1 font-mono tracking-tight">
                  <span className="text-slate-400">{i.event_count.toLocaleString()} raw events</span>
                  <span>{i.affected_instances} instances</span>
                  <span>{i.affected_services} services</span>
                  <span>{i.affected_applications} apps</span>
                  {i.spike_multiplier > 1 && <span className="text-amber-400 font-bold">{i.spike_multiplier}× spike</span>}
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" />
                    <span>{i.noise_reduction_ratio}% noise reduction</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
