import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api, type DemoScenario } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTelemetryInjection } from "../context/TelemetryToastContext";
import { SeverityBadge } from "../ui";
import { 
  Play, 
  Terminal, 
  Sparkles,
  Database,
  Layers,
  Zap,
  TrendingDown
} from "lucide-react";
import PageHeader from "../components/PageHeader";

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
  
  const { toast, isInjecting, triggerTelemetryInjection } = useTelemetryInjection();
  
  const [logs, setLogs] = useState<string[]>([]);
  const [processedCount, setProcessedCount] = useState(0);

  useEffect(() => {
    if (!currentOrg) return;
    api.get<DemoScenario[]>(`/organizations/${currentOrg.id}/demo/scenarios`).then(setScenarios);
  }, [currentOrg]);

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
          <span className="text-zinc-500 mr-2">{timeStr}</span>
          <span className="text-cyan-400 font-bold mr-1.5 font-mono">[INIT]</span>
          <span className="text-zinc-300">{line.replace("[INIT]", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[STREAM]")) {
      return (
        <div key={line}>
          <span className="text-zinc-500 mr-2">{timeStr}</span>
          <span className="text-emerald-400 font-bold mr-1.5 font-mono">[STREAM]</span>
          <span className="text-zinc-300">{line.replace("[STREAM]", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[WARN]")) {
      return (
        <div key={line}>
          <span className="text-zinc-500 mr-2">{timeStr}</span>
          <span className="text-amber-400 font-bold mr-1.5 font-mono">[WARN]</span>
          <span className="text-zinc-300">{line.replace("[WARN]", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[DONE]")) {
      return (
        <div key={line}>
          <span className="text-zinc-500 mr-2">{timeStr}</span>
          <span className="text-emerald-400 font-bold mr-1.5 font-mono">[DONE] ✔</span>
          <span className="text-zinc-200 font-semibold">{line.replace("[DONE]", "").replace("✔", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[EMBED]")) {
      return (
        <div key={line}>
          <span className="text-zinc-500 mr-2">{timeStr}</span>
          <span className="text-cyan-400 font-bold mr-1.5 font-mono">[EMBED]</span>
          <span className="text-zinc-300">{line.replace("[EMBED]", "")}</span>
        </div>
      );
    }
    return <div key={line} className="text-zinc-400">{line}</div>;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 flex-1">
        {/* Page Header */}
        <PageHeader 
          title="Demo Simulator Control Center" 
          badge="SIMULATOR" 
          description="Inject heavy telemetry traffic scenarios into the ingestion gateway to validate semantic clustering and cooldown suppresses."
        />

        {/* 2-Column Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Config, Scenarios, and Terminal Logs */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Top Ingestion Config & Status Bar */}
            <div className="bg-[#121215] border border-zinc-800/80 rounded-xl p-5 shadow-lg">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* Left: Event Count Input */}
                <div className="lg:col-span-4 flex items-center gap-3">
                  <label className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                    Events to Ingest
                  </label>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      className="w-full bg-[#18181b] border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                      min={10}
                      max={50}
                    />
                    <span className="absolute right-3 top-2 text-xs font-mono text-zinc-500">LOGS</span>
                  </div>
                </div>

                {/* Right: Scale & Microservice Info */}
                <div className="lg:col-span-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400 border-t lg:border-t-0 lg:border-l border-zinc-800 lg:pl-6">
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Traffic distributed across <strong className="text-zinc-200">3 simulated microservices</strong>.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      Recommended scale: <strong className="text-zinc-200">30 to 50 logs</strong> for real-time cooldown evaluation.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Scenario Grid */}
            <div className="space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Available Simulation Scenarios
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarios.map((s) => {
                  const isBusy = busy === s.id;
                  return (
                    <div 
                      key={s.id} 
                      className="bg-[#121215] border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-5 flex flex-col justify-between h-[190px] transition-all duration-200"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {getScenarioIcon(s.id)}
                          <h3 className="font-semibold text-white text-xs sm:text-sm capitalize">{s.id.replace(/-/g, " ")}</h3>
                        </div>
                        <p className="text-zinc-400 text-[11.5px] leading-relaxed line-clamp-3">{s.description}</p>
                      </div>
                      
                      <button 
                        className="w-full py-2.5 px-4 bg-[#18181b] hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 border border-zinc-800 hover:border-zinc-700 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer" 
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

            {/* Live SRE Terminal Window */}
            {logs.length > 0 && (
              <div className="w-full max-w-full overflow-x-auto font-mono text-xs whitespace-pre-wrap sm:whitespace-pre bg-[#000000] border border-zinc-800 rounded-xl p-4 shadow-2xl flex flex-col gap-2">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2 mb-1 text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
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
              <div className="card bg-[#121215] border border-zinc-800/80 rounded-xl p-5 animate-fade-in space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <h2 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#A3E635] animate-pulse" />
                      <span>Diagnostic Report</span>
                    </h2>
                    <p className="text-[9px] text-zinc-500 font-mono mt-0.5 capitalize">Scenario: {result.scenario}</p>
                  </div>
                  
                  <span className="text-[9px] text-emerald-400 font-mono font-extrabold uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">SSE Synced</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-2.5 bg-[#09090b]/60 border border-zinc-800/80 rounded-xl">
                    <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">Logs Ingested</div>
                    <div className="text-sm font-mono font-bold text-white mt-1">{result.events_generated}</div>
                  </div>
                  <div className="p-2.5 bg-[#09090b]/60 border border-zinc-800/80 rounded-xl">
                    <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">Threads Formed</div>
                    <div className="text-sm font-mono font-bold text-rose-400 mt-1">{result.incidents.length}</div>
                  </div>
                  <div className="p-2.5 bg-[#09090b]/60 border border-zinc-800/80 rounded-xl">
                    <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">Webhooks</div>
                    <div className="text-sm font-mono font-bold text-amber-400 mt-1">{result.notifications_sent}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-bold">Correlated Output</h3>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {result.incidents.map((i) => (
                      <Link 
                        key={i.id} 
                        to={`/incidents/${i.id}`} 
                        className="block border border-zinc-800/80 hover:border-zinc-700 bg-[#09090b]/40 rounded-xl p-3.5 transition duration-200 text-left"
                      >
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <SeverityBadge severity={i.severity} />
                            <span className="font-semibold text-white truncate text-xs">{i.title}</span>
                          </div>
                          <span className="text-[9px] text-zinc-500 font-mono shrink-0">#{i.id.slice(-6)}</span>
                        </div>
                        
                        <div className="text-zinc-400 text-[10px] flex flex-wrap gap-x-3 gap-y-1 font-mono tracking-tight">
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
              <div className="card bg-[#121215] border border-zinc-800/80 rounded-xl p-8 text-center text-zinc-500 text-xs italic">
                Diagnostic report will generate here when scenario runs...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
