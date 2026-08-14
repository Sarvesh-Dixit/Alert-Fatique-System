import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { api, type DemoScenario, type NoiseReductionKPIs, type CooldownState } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTelemetryInjection } from "../context/TelemetryToastContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { SeverityBadge } from "../ui";
import { 
  Play, 
  Terminal, 
  Sliders, 
  Activity, 
  Sparkles,
  Database,
  Layers,
  Zap,
  TrendingDown
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import NoiseReductionBanner from "../components/NoiseReductionBanner";
import CooldownMatrix from "../components/CooldownMatrix";

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
  
  const [kpis, setKpis] = useState<NoiseReductionKPIs | null>(null);
  const [cooldowns, setCooldowns] = useState<CooldownState[]>([]);
  const { toast, isInjecting, triggerTelemetryInjection } = useTelemetryInjection();
  
  const [logs, setLogs] = useState<string[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const isFetchingRef = useRef(false);

  const loadFeedData = useCallback(async () => {
    if (!currentOrg) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const feedData = await api.get<any>(`/organizations/${currentOrg.id}/dashboard-feed`);
      setKpis(feedData?.kpis ?? null);
      setCooldowns(feedData?.cooldown_matrix ?? []);
    } catch (err) {
      console.error("Failed to load feed stats in Demo", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [currentOrg]);

  useEffect(() => {
    if (!currentOrg) return;
    api.get<DemoScenario[]>(`/organizations/${currentOrg.id}/demo/scenarios`).then(setScenarios);
    loadFeedData();
  }, [currentOrg, loadFeedData]);

  // Connect to incident stream for real-time live updates
  useIncidentStream(currentOrg?.id, loadFeedData);

  // Live timer ticks for terminal
  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (isInjecting) {
      setProcessedCount(0);
      interval = setInterval(() => {
        setProcessedCount((prev) => {
          if (prev >= count) {
            clearInterval(interval);
            return count;
          }
          return prev + 1;
        });
      }, 75); // ~2.2 seconds to reach 30
    } else {
      setProcessedCount(count);
    }
    return () => clearInterval(interval);
  }, [isInjecting, count]);

  useEffect(() => {
    if (!toast) return;

    if (toast.type === "loading") {
      if (toast.message.startsWith("Injecting Telemetry")) {
        const scenarioName = toast.message.replace("Injecting Telemetry: ", "").toLowerCase();
        setLogs([
          `[INIT] Initiating telemetry injection pipeline: ${scenarioName}...`,
          `[STREAM] Connecting to Ingestion Highway gateway...`
        ]);
      } else if (toast.message === "Telemetry Highway Ingestion Active") {
        setLogs((prev) => [
          ...prev,
          `[STREAM] Telemetry Highway Ingestion Active: dispatching raw burst stream`,
        ]);
      }
    } else if (toast.type === "success") {
      setLogs((prev) => [
        ...prev.filter(l => !l.includes("[STREAM] Processed:")),
        `[STREAM] Telemetry Ingestion: Streamed ${count}/${count} raw events successfully`,
        `[EMBED] Vector Embedding Engine: Computed ${count} trace embeddings (cosine similarity checks)`,
        `[DONE] ✔ Simulation completed. pipeline synchronized to Real-Time SSE channel.`
      ]);
    } else if (toast.type === "error") {
      setLogs((prev) => [
        ...prev,
        `[WARN] Ingestion failure alert: ${toast.sub}`
      ]);
    }
  }, [toast, count]);

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
        await loadFeedData();
      } catch (err) {
        console.error("Failed to load diagnostic report", err);
      }
    });
    setBusy("");
  }

  const getScenarioIcon = (id: string) => {
    const isCurrentBusy = busy === id;
    const colorClass = isCurrentBusy ? "text-emerald-400 animate-pulse fill-emerald-400/10" : "text-cyan-400 fill-cyan-400/5";

    const name = id.toLowerCase();
    if (name.includes("database") || name.includes("postgres") || name.includes("failure")) {
      return <Layers className={`w-5 h-5 ${colorClass}`} />;
    }
    if (name.includes("hdfs") || name.includes("outage") || name.includes("storage")) {
      return <Database className={`w-5 h-5 ${colorClass}`} />;
    }
    return <Zap className={`w-5 h-5 ${colorClass}`} />;
  };

  const formatLogLine = (line: string) => {
    const timeStr = `[${new Date().toLocaleTimeString()}]`;
    if (line.startsWith("[INIT]")) {
      return (
        <div key={line}>
          <span className="text-slate-500 mr-2">{timeStr}</span>
          <span className="text-cyan-400 font-bold mr-1.5">[INIT]</span>
          <span className="text-slate-300">{line.replace("[INIT]", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[STREAM]")) {
      return (
        <div key={line}>
          <span className="text-slate-500 mr-2">{timeStr}</span>
          <span className="text-emerald-400 font-bold mr-1.5">[STREAM]</span>
          <span className="text-slate-300">{line.replace("[STREAM]", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[WARN]")) {
      return (
        <div key={line}>
          <span className="text-slate-500 mr-2">{timeStr}</span>
          <span className="text-amber-400 font-bold mr-1.5">[WARN]</span>
          <span className="text-slate-300">{line.replace("[WARN]", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[DONE]")) {
      return (
        <div key={line}>
          <span className="text-slate-500 mr-2">{timeStr}</span>
          <span className="text-emerald-400 font-bold mr-1.5">[DONE] ✔</span>
          <span className="text-slate-200 font-semibold">{line.replace("[DONE]", "").replace("✔", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[EMBED]")) {
      return (
        <div key={line}>
          <span className="text-slate-500 mr-2">{timeStr}</span>
          <span className="text-cyan-400 font-bold mr-1.5">[EMBED]</span>
          <span className="text-slate-300">{line.replace("[EMBED]", "")}</span>
        </div>
      );
    }
    return <div key={line} className="text-slate-400">{line}</div>;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6 font-sans">
      {/* Standard Header */}
      <PageHeader 
        title="Demo Simulator Control Center" 
        badge="SIMULATOR" 
        description="Inject heavy telemetry traffic scenarios into the ingestion gateway to validate semantic clustering and cooldown suppresses."
      />

      {/* Embedded Core Anchors for Immediate Feedback */}
      <NoiseReductionBanner kpis={kpis} hasActiveCooldowns={cooldowns.some(c => c.remaining_seconds > 0)} />
      <CooldownMatrix cooldowns={cooldowns} />

      {/* Simulator Workspace controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Scenario selection & configuration */}
        <div className="lg:col-span-8 space-y-6">
          {/* Rate config */}
          <div className="card bg-slate-900/60 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/60 rounded-xl p-5">
            <h2 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-4 flex items-center gap-1.5 font-mono">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Ingestion Rate Controller</span>
            </h2>
            
            <div className="flex flex-col sm:flex-row sm:items-end gap-6">
              <div className="w-full sm:w-64">
                <label className="label text-[10px] font-bold text-slate-400 uppercase tracking-wider">Events to Ingest</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    className="input pl-3 pr-12 bg-slate-950 border border-slate-800 focus:border-[#A3E635]/65 font-mono tracking-tight text-white"
                    value={count}
                    min={10}
                    max={50}
                    onChange={(e) => setCount(Number(e.target.value))}
                  />
                  <span className="absolute right-3 top-2 font-mono text-[10px] text-slate-500 uppercase">logs</span>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col gap-1 text-[11px] text-slate-400 pb-1 leading-normal font-sans">
                <div>
                  • Traffic is distributed across <strong className="text-slate-200">3 simulated microservices</strong>.
                </div>
                <div>
                  • Recommended scale: <strong className="text-slate-200">30 to 50 logs</strong> to verify cooldown suppression without pipeline overhead.
                </div>
              </div>
            </div>
          </div>

          {/* Scenario Grid */}
          <div className="space-y-3.5">
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider">Available Simulation Scenarios</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scenarios.map((s) => {
                const isBusy = busy === s.id;
                return (
                  <div 
                    key={s.id} 
                    className="card bg-slate-900/60 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/60 rounded-xl flex flex-col justify-between shadow-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {getScenarioIcon(s.id)}
                        <h3 className="font-semibold text-white text-xs sm:text-sm capitalize">{s.id.replace(/-/g, " ")}</h3>
                      </div>
                      <p className="text-slate-400 text-[11.5px] leading-relaxed min-h-[48px]">{s.description}</p>
                    </div>
                    
                    <button 
                      className="w-full mt-4 px-3.5 py-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 text-emerald-400 hover:bg-slate-900 text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5" 
                      disabled={!!busy} 
                      onClick={() => run(s.id)}
                    >
                      <Play className="w-3 h-3 fill-emerald-400/20 shrink-0" />
                      <span>{isBusy ? "Injecting..." : "Inject Scenario"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terminal log output */}
          {logs.length > 0 && (
            <div className="bg-black/80 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 p-4 shadow-2xl flex flex-col gap-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-1 text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                <span>[TELEMETRY HIGHWAY REAL-TIME INGESTION LOGS]</span>
                {isInjecting && (
                  <span className="text-cyan-400 font-bold animate-pulse font-mono">
                    [Processed: {processedCount} / {count} events]
                  </span>
                )}
              </div>
              
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto font-mono">
                {logs.map((log) => formatLogLine(log))}
                
                {isInjecting && processedCount < count && (
                  <div className="text-emerald-400 font-bold animate-pulse font-mono">
                    &gt;&gt; [STREAM] Processed: {processedCount} / {count} events...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Results Diagnostic Card on the right */}
        <div className="lg:col-span-4">
          {result ? (
            <div className="card bg-slate-900/60 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/60 rounded-xl p-5 animate-fade-in space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#A3E635] animate-pulse" />
                    <span>Diagnostic Report</span>
                  </h2>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5 capitalize">Scenario: {result.scenario}</p>
                </div>
                
                <span className="text-[9px] text-emerald-400 font-mono font-extrabold uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">SSE Synced</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Logs Ingested</div>
                  <div className="text-sm font-mono font-bold text-white mt-1">{result.events_generated}</div>
                </div>
                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Threads Formed</div>
                  <div className="text-sm font-mono font-bold text-rose-400 mt-1">{result.incidents.length}</div>
                </div>
                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Webhooks</div>
                  <div className="text-sm font-mono font-bold text-amber-400 mt-1">{result.notifications_sent}</div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Correlated Output</h3>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {result.incidents.map((i) => (
                    <Link 
                      key={i.id} 
                      to={`/incidents/${i.id}`} 
                      className="block border border-slate-800 hover:border-slate-700 bg-slate-950/40 rounded-xl p-3.5 transition duration-200 text-left"
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <SeverityBadge severity={i.severity} />
                          <span className="font-semibold text-white truncate text-xs">{i.title}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono shrink-0">#{i.id.slice(-6)}</span>
                      </div>
                      
                      <div className="text-slate-400 text-[10px] flex flex-wrap gap-x-3 gap-y-1 font-mono tracking-tight">
                        <span className="text-[#A3E635] font-bold">-{i.events_suppressed} suppressed</span>
                        <span>{i.affected_services} services</span>
                        {i.spike_multiplier > 1 && <span className="text-amber-400 font-bold">{i.spike_multiplier}x spike</span>}
                        <span className="text-[#A3E635] flex items-center gap-0.5">
                          <TrendingDown className="w-3 h-3" />
                          <span>{i.noise_reduction_ratio}% reduction</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card bg-slate-900/60 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/60 rounded-xl p-8 text-center text-slate-500 text-xs italic">
              Diagnostic report will generate here when scenario runs...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
