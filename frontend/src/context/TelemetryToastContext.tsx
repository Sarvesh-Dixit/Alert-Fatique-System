import React, { createContext, useContext, useState } from "react";
import { X, Activity, Terminal, CheckCircle2, ShieldAlert, Layers } from "lucide-react";
import { api } from "../api/client";

interface ToastState {
  type: "loading" | "success" | "error";
  message: string;
  sub: string;
  iconName?: "activity" | "terminal" | "check" | "shield" | "layers";
  icon?: string; // Support legacy generic emojis for backward compatibility
}

interface TelemetryToastContextType {
  toast: ToastState | null;
  setToast: (toast: ToastState | null) => void;
  isInjecting: boolean;
  triggerTelemetryInjection: (
    orgId: string,
    pattern: string,
    count?: number,
    onComplete?: () => void
  ) => Promise<void>;
  logs: string[];
  setLogs: React.Dispatch<React.SetStateAction<string[]>>;
  addLog: (line: string) => void;
  clearLogs: () => void;
}

const TelemetryToastContext = createContext<TelemetryToastContextType | undefined>(undefined);

export function TelemetryToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (line: string) => {
    setLogs((prev) => [...prev, line].slice(-500));
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const triggerTelemetryInjection = async (
    orgId: string,
    pattern: string,
    count: number = 30,
    onComplete?: () => void
  ) => {
    setIsInjecting(true);
    setToast({
      type: "loading",
      message: "INGESTION_PIPELINE_ACTIVE",
      sub: "Streaming telemetry burst into highway gateway...",
      iconName: "terminal",
    });

    const scenarioName = pattern.replace(/-/g, " ").toUpperCase();
    const serviceName = pattern === "error-burst" ? "payment-api" : pattern === "cpu-spike" ? "host-agent" : "orders";

    // Set initial logs
    const initialLogs = [
      `[INIT] Initiating telemetry injection pipeline: ${scenarioName}...`,
      `[STREAM] Connecting to Ingestion Highway gateway...`,
      `[STREAM] Gateway channel connected. Ingestion active: dispatching raw burst stream of ${count} events`
    ];
    setLogs(initialLogs);

    // Simulate streaming events periodically
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= count) {
        clearInterval(interval);
        return;
      }
      
      const methods = ["POST", "GET", "PUT"];
      const endpoints = ["/api/v1/charge", "/api/v1/orders", "/api/v1/metrics", "/api/v1/checkout"];
      const method = methods[idx % methods.length];
      const endpoint = endpoints[idx % endpoints.length];

      if (pattern === "error-burst" && idx > 2) {
        setLogs((prev) => [
          ...prev,
          `[SUPPRESS] Cooldown Rule Engaged: Suppressed identical alert burst on service ${serviceName}`
        ].slice(-500));
      } else if (pattern === "cascading-failure" && idx % 3 === 0) {
        setLogs((prev) => [
          ...prev,
          `[WARN] Downstream service failure detected: ${serviceName} dependency timeout`
        ].slice(-500));
      } else {
        setLogs((prev) => [
          ...prev,
          `[STREAM] Ingested telemetry event: ${method} ${endpoint} - 200 OK`
        ].slice(-500));
      }

      idx += 5;
    }, 250);

    try {
      const response = await api.post<any>(
        `/organizations/${orgId}/demo/simulate?sync=false&pattern=${pattern}&count=${count}`,
        { pattern, sync: false }
      );

      if (response?.status === "success") {
        setToast({
          type: "loading",
          message: "INGESTION_PIPELINE_ACTIVE",
          sub: "Processing events & evaluating cooldown rules...",
          iconName: "terminal",
        });

        // Wait to simulate ingestion duration
        await new Promise((resolve) => setTimeout(resolve, 2000));
        clearInterval(interval);

        setToast({
          type: "success",
          message: "PIPELINE_SYNCHRONIZED",
          sub: `Cooldown matrix locked. ${count} raw alerts collapsed into 1 incident thread.`,
          iconName: "check",
        });

        setLogs((prev) => [
          ...prev.filter(l => !l.includes("[STREAM] Ingested")),
          `[STREAM] Telemetry Ingestion: Streamed ${count}/${count} raw events successfully`,
          `[EMBED] Vector Embedding Engine: Computed ${count} trace embeddings (cosine similarity checks)`,
          `[DONE] ✔ Simulation completed. pipeline synchronized to Real-Time SSE channel.`
        ].slice(-500));

        if (onComplete) {
          onComplete();
        }

        setTimeout(() => {
          setToast((curr) => (curr?.type === "success" ? null : curr));
        }, 4000);
      } else {
        throw new Error(response?.message || "Failed to dispatch telemetry scenario.");
      }
    } catch (error: any) {
      clearInterval(interval);
      setToast({
        type: "error",
        message: "GATEWAY_DISPATCH_FAILED",
        sub: error?.message || "Failed to dispatch telemetry scenario.",
        iconName: "shield",
      });

      setLogs((prev) => [
        ...prev,
        `[WARN] Ingestion failure alert: ${error?.message || "Gateway dispatch failed"}`
      ].slice(-500));

      setTimeout(() => {
        setToast((curr) => (curr?.type === "error" ? null : curr));
      }, 5000);
    } finally {
      setIsInjecting(false);
    }
  };

  const renderIcon = (iconName?: string, type?: string, legacyIcon?: string) => {
    if (legacyIcon) {
      if (legacyIcon === "⚡" || legacyIcon === "📡" || legacyIcon === "⚙") {
        return <Terminal className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />;
      }
      if (legacyIcon === "✅" || legacyIcon === "✔") {
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      }
      if (legacyIcon === "❌") {
        return <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />;
      }
      return <span className="shrink-0 text-sm font-mono">{legacyIcon}</span>;
    }

    switch (iconName) {
      case "activity":
        return <Activity className="w-4 h-4 text-cyan-400 shrink-0" />;
      case "terminal":
        return <Terminal className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />;
      case "check":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case "shield":
        return <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />;
      case "layers":
        return <Layers className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        if (type === "loading") return <Terminal className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />;
        if (type === "success") return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
        return <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />;
    }
  };

  return (
    <TelemetryToastContext.Provider value={{ toast, setToast, isInjecting, triggerTelemetryInjection, logs, setLogs, addLog, clearLogs }}>
      {children}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#121215]/95 backdrop-blur-xl border border-zinc-800 text-zinc-100 shadow-2xl rounded-xl p-4 font-mono text-xs max-w-sm animate-slide-in">
          <div className="shrink-0">{renderIcon(toast.iconName, toast.type, toast.icon)}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono">{toast.message}</h4>
            <p className="text-[11px] opacity-80 leading-relaxed mt-1 font-sans">{toast.sub}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="hover:opacity-85 transition shrink-0 self-start cursor-pointer bg-transparent border-none text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </TelemetryToastContext.Provider>
  );
}

export function useTelemetryInjection() {
  const context = useContext(TelemetryToastContext);
  if (!context) {
    throw new Error("useTelemetryInjection must be used within a TelemetryToastProvider");
  }
  return context;
}
