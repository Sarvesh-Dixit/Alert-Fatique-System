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
          `[${new Date().toLocaleTimeString()}] [INIT] Initiating telemetry injection: ${scenarioName}...`
        ]);
        if (onSimulationStateChange) {
          onSimulationStateChange(true);
        }
      } else if (toast.message === "Telemetry Highway Ingestion Active") {
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] [SUCCESS] Ingestion pipeline started. Streaming telemetry events to highway...`,
          `[${new Date().toLocaleTimeString()}] [INGEST] Telemetry Ingestion: Streaming raw events (30/30)...`
        ]);
      }
    } else if (toast.type === "success") {
      setLogs((prev) => [
        ...prev.filter(l => !l.includes("[INGEST]")),
        `[${new Date().toLocaleTimeString()}] [INGEST] Telemetry Ingestion: Streamed 30/30 raw events`,
        `[${new Date().toLocaleTimeString()}] [EMBED] Vector Embedding Engine: Computed 30 trace embeddings`,
        `[${new Date().toLocaleTimeString()}] [GROUP] Incident Threading: Correlating traces and suppression...`,
        `[${new Date().toLocaleTimeString()}] [DONE] Simulation completed. Streamed to Real-Time SSE channel.`
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
        `[${new Date().toLocaleTimeString()}] [ERROR] Ingestion failure: ${toast.sub}`
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

  return (
    <div className="card border border-[#252940] shadow-2xl p-6 flex flex-col gap-4 bg-[#161928]">
      <div className="flex items-center gap-2">
        <Terminal className="w-5 h-5 text-cyan-400 animate-pulse" />
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Telemetry Simulation Pipeline
          </h3>
          <p className="text-white/40 text-xs">Inject high-volume telemetry traffic to validate semantic clustering and deduplication</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Error Burst */}
        <button
          className={`btn border px-4 py-2.5 text-xs font-bold rounded-lg transition-all hover:scale-[1.02] cursor-pointer flex items-center disabled:opacity-50 ${
            busy === "error-burst"
              ? "animate-pulse border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              : "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
          }`}
          disabled={isInjecting}
          onClick={() => runScenario("error-burst", 30)}
        >
          <Zap className="w-4 h-4 mr-2 text-amber-400" />
          <span>{busy === "error-burst" ? "Simulating..." : "Run Error Burst Scenario (30 events)"}</span>
        </button>

        {/* LogHub HDFS Outage */}
        <button
          className={`btn border px-4 py-2.5 text-xs font-semibold rounded-lg transition-all hover:scale-[1.02] cursor-pointer flex items-center disabled:opacity-50 ${
            busy === "loghub-hdfs-outage"
              ? "animate-pulse border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              : "border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-400/60 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.05)]"
          }`}
          disabled={isInjecting}
          onClick={() => runScenario("loghub-hdfs-outage", 30)}
        >
          <Database className="w-4 h-4 mr-2 text-cyan-400" />
          <span>{busy === "loghub-hdfs-outage" ? "Simulating..." : "Run LogHub HDFS Outage (30 events)"}</span>
        </button>

        {/* Database Outage */}
        <button
          className={`btn border px-4 py-2.5 text-xs font-semibold rounded-lg transition-all hover:scale-[1.02] cursor-pointer flex items-center disabled:opacity-50 ${
            busy === "database-outage"
              ? "animate-pulse border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              : "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/60 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.05)]"
          }`}
          disabled={isInjecting}
          onClick={() => runScenario("database-outage", 30)}
        >
          <Layers className="w-4 h-4 mr-2 text-rose-400" />
          <span>{busy === "database-outage" ? "Simulating..." : "Run Database Outage (30 events)"}</span>
        </button>
      </div>

      {/* Terminal Log Output Drawer */}
      {logs.length > 0 && (
        <div className="bg-[#0B0C14] border border-[#252940] font-mono text-xs text-slate-300 p-3 rounded flex flex-col gap-1.5 shadow-inner">
          {logs.map((log, idx) => (
            <div key={idx} className="leading-relaxed font-mono tracking-tight">
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
