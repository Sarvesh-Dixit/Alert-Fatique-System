import type { ReactNode } from "react";

const SEVERITY_STYLES: Record<string, string> = {
  DEBUG: "bg-slate-500/20 text-slate-300",
  INFO: "bg-sky-500/20 text-sky-300",
  WARNING: "bg-amber-500/20 text-amber-300",
  ERROR: "bg-orange-500/20 text-orange-300",
  HIGH: "bg-red-500/20 text-red-300",
  CRITICAL: "bg-red-600/40 text-red-100",
  FATAL: "bg-red-600/30 text-red-200",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_STYLES[severity.toUpperCase()] ?? "bg-white/10 text-white/70";
  return <span className={`badge ${cls}`}>{severity}</span>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="card">
      <div className="text-white/50 text-sm">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-white/40 text-sm py-8 text-center">{children}</div>;
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-red-500/20 text-red-300",
  ACKNOWLEDGED: "bg-amber-500/20 text-amber-300",
  RESOLVED: "bg-emerald-500/20 text-emerald-300",
  CLOSED: "bg-slate-500/20 text-slate-300",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status.toUpperCase()] ?? "bg-white/10 text-white/70";
  return <span className={`badge ${cls}`}>{status}</span>;
}
