import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTelemetryInjection } from "../context/TelemetryToastContext";
import { Zap, Database, Layers, Terminal } from "lucide-react";

interface DemoSimulatorProps {
  onScenarioTriggered?: () => void;
  onSimulationStateChange?: (running: boolean) => void;
}

export default function DemoSimulator({ onScenarioTriggered, onSimulationStateChange }: DemoSimulatorProps) {
  const { currentOrg } = useAuth();
  const { toast, isInjecting, triggerTelemetryInjection } = useTelemetryInjection();
  const [busy, setBusy] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [processedCount, setProcessedCount] = useState(0);

  // Simulated log processor ticks
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isInjecting) {
      setProcessedCount(0);
      interval = setInterval(() => {
        setProcessedCount((prev) => {
          if (prev >= 30) {
            clearInterval(interval);
            return 30;
          }
          return prev + 1;
        });
      }, 75); // ~2.2 seconds to reach 30
    } else {
      setProcessedCount(30);
    }
    return () => clearInterval(interval);
  }, [isInjecting]);

  useEffect(() => {
    if (!toast) {
      if (!isInjecting) {
        setBusy("");
      }
      return;
    }

    if (toast.type === "loading") {
      if (toast.message.startsWith("Injecting Telemetry")) {
        const scenarioName = toast.message.replace("Injecting Telemetry: ", "").toLowerCase();
        setBusy(scenarioName);
        setLogs([
          `[INIT] Initiating telemetry injection pipeline: ${scenarioName}...`,
          `[STREAM] Connecting to Ingestion Highway gateway...`
        ]);
        if (onSimulationStateChange) {
          onSimulationStateChange(true);
        }
      } else if (toast.message === "Telemetry Highway Ingestion Active") {
        setLogs((prev) => [
          ...prev,
          `[STREAM] Telemetry Highway Ingestion Active: dispatching raw burst stream`,
        ]);
      }
    } else if (toast.type === "success") {
      setLogs((prev) => [
        ...prev.filter(l => !l.includes("[STREAM] Processed:")),
        `[STREAM] Telemetry Ingestion: Streamed 30/30 raw events successfully`,
        `[EMBED] Vector Embedding Engine: Computed 30 trace embeddings (cosine similarity checks)`,
        `[DONE] ✔ Simulation completed. pipeline synchronized to Real-Time SSE channel.`
      ]);
      setBusy("");
      if (onSimulationStateChange) {
        onSimulationStateChange(false);
      }
      if (onScenarioTriggered) {
        onScenarioTriggered();
      }
    } else if (toast.type === "error") {
      setLogs((prev) => [
        ...prev,
        `[WARN] Ingestion failure alert: ${toast.sub}`
      ]);
      setBusy("");
      if (onSimulationStateChange) {
        onSimulationStateChange(false);
      }
    }
  }, [toast, isInjecting]);

  const runScenario = async (scenario: string, count: number) => {
    if (!currentOrg) return;
    await triggerTelemetryInjection(currentOrg.id, scenario, count);
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
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/60 rounded-xl p-6 flex flex-col gap-4 shadow-xl">
      <div className="flex items-center gap-2">
        <Terminal className="w-5 h-5 text-cyan-400 animate-pulse" />
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Telemetry Simulation Pipeline
          </h3>
          <p className="text-slate-400 text-xs">Inject high-volume telemetry traffic to validate semantic clustering and deduplication</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Error Burst */}
        <button
          className={`px-4 py-2.5 text-xs font-bold rounded-lg border transition-all hover:scale-[1.02] cursor-pointer flex items-center disabled:opacity-50 ${
            busy === "error-burst"
              ? "animate-pulse border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              : "border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white"
          }`}
          disabled={isInjecting}
          onClick={() => runScenario("error-burst", 30)}
        >
          <Zap className="w-4 h-4 mr-2 text-amber-400 fill-amber-400/20" />
          <span>{busy === "error-burst" ? "Simulating..." : "Run Error Burst Scenario (30 events)"}</span>
        </button>

        {/* LogHub HDFS Outage */}
        <button
          className={`px-4 py-2.5 text-xs font-bold rounded-lg border transition-all hover:scale-[1.02] cursor-pointer flex items-center disabled:opacity-50 ${
            busy === "loghub-hdfs-outage"
              ? "animate-pulse border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              : "border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white"
          }`}
          disabled={isInjecting}
          onClick={() => runScenario("loghub-hdfs-outage", 30)}
        >
          <Database className="w-4 h-4 mr-2 text-cyan-400 fill-cyan-400/20" />
          <span>{busy === "loghub-hdfs-outage" ? "Simulating..." : "Run LogHub HDFS Outage (30 events)"}</span>
        </button>

        {/* Database Outage */}
        <button
          className={`px-4 py-2.5 text-xs font-bold rounded-lg border transition-all hover:scale-[1.02] cursor-pointer flex items-center disabled:opacity-50 ${
            busy === "database-outage"
              ? "animate-pulse border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              : "border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white"
          }`}
          disabled={isInjecting}
          onClick={() => runScenario("database-outage", 30)}
        >
          <Layers className="w-4 h-4 mr-2 text-rose-400 fill-rose-400/20" />
          <span>{busy === "database-outage" ? "Simulating..." : "Run Database Outage (30 events)"}</span>
        </button>
      </div>

      {/* Terminal Log Output Drawer */}
      {logs.length > 0 && (
        <div className="bg-black/80 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 p-4 shadow-2xl flex flex-col gap-2">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-1 text-[10px] text-slate-500 uppercase tracking-wider font-mono">
            <span>[TELEMETRY HIGHWAY REAL-TIME INGESTION LOGS]</span>
            {isInjecting && (
              <span className="text-cyan-400 font-bold animate-pulse">
                [Processed: {processedCount} / 30 events]
              </span>
            )}
          </div>
          
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto font-mono">
            {logs.map((log) => formatLogLine(log))}
            
            {isInjecting && processedCount < 30 && (
              <div className="text-emerald-400 font-bold animate-pulse font-mono">
                &gt;&gt; [STREAM] Processed: {processedCount} / 30 events...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
