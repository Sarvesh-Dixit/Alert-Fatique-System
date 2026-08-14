import type { ReactNode } from "react";
import { 
  AlertOctagon, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  AlertCircle,
  Eye,
  Lock
} from "lucide-react";

const SEVERITY_STYLES: Record<string, string> = {
  DEBUG: "bg-slate-500/20 text-slate-300 border border-slate-500/35",
  INFO: "bg-sky-500/20 text-sky-300 border border-sky-500/35",
  WARNING: "bg-amber-500/20 text-amber-300 border border-amber-500/35",
  ERROR: "bg-orange-500/20 text-orange-300 border border-orange-500/35",
  HIGH: "bg-red-500/20 text-red-300 border border-red-500/35",
  CRITICAL: "bg-red-600/40 text-red-100 border border-red-600/50",
  FATAL: "bg-red-600/30 text-red-200 border border-red-600/45",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const sev = severity.toUpperCase();
  const cls = SEVERITY_STYLES[sev] ?? "bg-white/10 text-white/70 border border-white/15";
  
  let Icon = Info;
  if (sev === "CRITICAL" || sev === "FATAL") Icon = AlertOctagon;
  else if (sev === "HIGH" || sev === "ERROR") Icon = ShieldAlert;
  else if (sev === "WARNING" || sev === "MEDIUM") Icon = AlertTriangle;
  else if (sev === "INFO" || sev === "DEBUG" || sev === "LOW") Icon = CheckCircle2;

  return (
    <span className={`badge ${cls} inline-flex items-center gap-1 font-mono uppercase tracking-wide px-2 py-0.5 rounded text-[10px]`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span>{severity}</span>
    </span>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="card bg-cardBg border border-borderDark rounded-xl p-5 shadow-lg">
      <div className="text-white/50 text-xs font-semibold uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-mono tracking-tight font-bold mt-1 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="text-white/40 text-xs py-8 text-center border border-dashed border-borderDark rounded-xl bg-cardBg/40">
      {children}
    </div>
  );
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, { 
      hour12: false, 
      month: "short", 
      day: "2-digit", 
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit" 
    });
  } catch {
    return "—";
  }
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-red-500/20 text-red-300 border border-red-500/35",
  ACKNOWLEDGED: "bg-amber-500/20 text-amber-300 border border-amber-500/35",
  RESOLVED: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35",
  CLOSED: "bg-slate-500/20 text-slate-300 border border-slate-500/35",
};

export function StatusBadge({ status }: { status: string }) {
  const stat = status.toUpperCase();
  const cls = STATUS_STYLES[stat] ?? "bg-white/10 text-white/70 border border-white/15";

  let Icon = AlertCircle;
  if (stat === "OPEN") Icon = AlertCircle;
  else if (stat === "ACKNOWLEDGED") Icon = Eye;
  else if (stat === "RESOLVED") Icon = CheckCircle2;
  else if (stat === "CLOSED") Icon = Lock;

  return (
    <span className={`badge ${cls} inline-flex items-center gap-1 font-mono uppercase tracking-wide px-2 py-0.5 rounded text-[10px]`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span>{status}</span>
    </span>
  );
}
