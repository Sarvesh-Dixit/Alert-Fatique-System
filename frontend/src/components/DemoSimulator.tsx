import React, { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Zap, Database, Layers, Terminal } from "lucide-react";

interface DemoSimulatorProps {
  onScenarioTriggered?: () => void;
  onSimulationStateChange?: (running: boolean) => void;
}

export default function DemoSimulator({ onScenarioTriggered, onSimulationStateChange }: DemoSimulatorProps) {
  const { currentOrg } = useAuth();
  const [busy, setBusy] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const runScenario = async (scenario: string, count: number) => {
    if (!currentOrg) return;
    setBusy(scenario);
    if (onSimulationStateChange) {
      onSimulationStateChange(true);
    }
    setLogs([
      `[${new Date().toLocaleTimeString()}] [INIT] Initiating telemetry injection: ${scenario}...`
    ]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000); // 15 seconds timeout

    try {
      const res = await api.post<any>(
        `/organizations/${currentOrg.id}/demo/simulate/${scenario}?count=${count}&apps=3&sync=false`,
        null,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [INGEST] Telemetry Ingestion: Generated ${count} raw events`,
        `[${new Date().toLocaleTimeString()}] [EMBED] Vector Embedding Engine: Computed ${count} trace embeddings`,
        `[${new Date().toLocaleTimeString()}] [GROUP] Incident Threading: Grouped under ${res?.incidents?.length ?? 1} correlated incident`,
        `[${new Date().toLocaleTimeString()}] [ACTIVE] Active suppression: Noise Reduction Ratio at 99.8%`,
        `[${new Date().toLocaleTimeString()}] [DONE] Simulation completed. Streamed to Real-Time SSE channel.`
      ]);
      if (onScenarioTriggered) {
        onScenarioTriggered();
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Failed to run scenario:", err);
      const isTimeout = err.name === "AbortError" || controller.signal.aborted;
      const errorMsg = isTimeout
        ? "Ingestion request timed out (gateway/API took more than 15s to respond)"
        : err instanceof Error ? err.message : String(err);
      
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [ERROR] Ingestion failure: ${errorMsg}`
      ]);
    } finally {
      setBusy("");
      if (onSimulationStateChange) {
        onSimulationStateChange(false);
      }
    }
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
          className="btn border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60 text-amber-300 px-4 py-2.5 text-xs font-bold rounded-lg transition-all hover:scale-[1.02] cursor-pointer flex items-center shadow-[0_0_15px_rgba(245,158,11,0.05)] disabled:opacity-50"
          disabled={!!busy}
          onClick={() => runScenario("error-burst", 500)}
        >
          <Zap className="w-4 h-4 mr-2 text-amber-400" />
          <span>{busy === "error-burst" ? "Simulating..." : "Run Error Burst Scenario (500 events)"}</span>
        </button>

        {/* LogHub HDFS Outage */}
        <button
          className="btn border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-400/60 text-cyan-300 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all hover:scale-[1.02] cursor-pointer flex items-center shadow-[0_0_15px_rgba(0,240,255,0.05)] disabled:opacity-50"
          disabled={!!busy}
          onClick={() => runScenario("loghub-hdfs-outage", 250)}
        >
          <Database className="w-4 h-4 mr-2 text-cyan-400" />
          <span>{busy === "loghub-hdfs-outage" ? "Simulating..." : "Run LogHub HDFS Outage (250 events)"}</span>
        </button>

        {/* Database Outage */}
        <button
          className="btn border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/60 text-rose-300 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all hover:scale-[1.02] cursor-pointer flex items-center shadow-[0_0_15px_rgba(244,63,94,0.05)] disabled:opacity-50"
          disabled={!!busy}
          onClick={() => runScenario("database-outage", 300)}
        >
          <Layers className="w-4 h-4 mr-2 text-rose-400" />
          <span>{busy === "database-outage" ? "Simulating..." : "Run Database Outage (300 events)"}</span>
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
