import React, { createContext, useContext, useState } from "react";
import { X } from "lucide-react";
import { api } from "../api/client";

interface ToastState {
  type: "loading" | "success" | "error";
  message: string;
  sub: string;
  icon?: string;
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
}

const TelemetryToastContext = createContext<TelemetryToastContextType | undefined>(undefined);

export function TelemetryToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);

  const triggerTelemetryInjection = async (
    orgId: string,
    pattern: string,
    count: number = 30,
    onComplete?: () => void
  ) => {
    setIsInjecting(true);
    setToast({
      type: "loading",
      message: `Injecting Telemetry: ${pattern.replace(/-/g, " ").toUpperCase()}`,
      sub: `Streaming ${count} synthetic events across services...`,
      icon: "⚡",
    });

    try {
      // api.post returns the parsed JSON body directly (not an axios-style
      // envelope). The backend responds with { status: "success", ... }.
      const response = await api.post<any>(
        `/organizations/${orgId}/demo/simulate?sync=false&pattern=${pattern}&count=${count}`,
        { pattern, sync: false }
      );

      if (response?.status === "success") {
        setToast({
          type: "loading",
          message: "Telemetry Highway Ingestion Active",
          sub: "Processing events & evaluating cooldown rules...",
          icon: "📡",
        });

        // Simulating processing progress
        await new Promise((resolve) => setTimeout(resolve, 2500));

        setToast({
          type: "success",
          message: "Pipeline Synchronized",
          sub: `${pattern.replace(/-/g, " ").toUpperCase()} successfully ingested. Cooldown Matrix and Incident Feed updated.`,
          icon: "✅",
        });

        if (onComplete) {
          onComplete();
        }

        // Dismiss success toast after 4 seconds
        setTimeout(() => {
          setToast((curr) => (curr?.type === "success" ? null : curr));
        }, 4000);
      } else {
        throw new Error(response?.message || "Failed to dispatch telemetry scenario.");
      }
    } catch (error: any) {
      setToast({
        type: "error",
        message: "Injection Failed",
        sub: error?.message || "Failed to dispatch telemetry scenario.",
        icon: "❌",
      });
      // Dismiss error toast after 5 seconds
      setTimeout(() => {
        setToast((curr) => (curr?.type === "error" ? null : curr));
      }, 5000);
    } finally {
      setIsInjecting(false);
    }
  };

  const getToastStyle = (type: "loading" | "success" | "error") => {
    switch (type) {
      case "loading":
        return "bg-slate-900 border-cyan-500/40 text-cyan-200";
      case "success":
        return "bg-slate-900 border-emerald-500/40 text-emerald-200";
      case "error":
        return "bg-slate-900 border-rose-500/40 text-rose-200";
    }
  };

  return (
    <TelemetryToastContext.Provider value={{ toast, setToast, isInjecting, triggerTelemetryInjection }}>
      {children}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 p-4 border rounded-xl shadow-2xl max-w-sm animate-slide-in ${getToastStyle(toast.type)}`}>
          <div className="shrink-0 text-lg">{toast.icon}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wider">{toast.message}</h4>
            <p className="text-[11px] opacity-80 leading-relaxed mt-0.5">{toast.sub}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="hover:opacity-85 transition shrink-0 self-start cursor-pointer bg-transparent border-none text-current"
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
