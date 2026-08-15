import { useEffect, useMemo, useState } from "react";
import { CooldownState } from "../api/client";
import {
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BellOff,
} from "lucide-react";

interface CooldownMatrixProps {
  cooldowns: CooldownState[];
  loading?: boolean;
}

/**
 * The Cooldown Matrix — one of the two visual anchors of the product.
 * Groups active alert suppression windows by severity and shows a live
 * countdown + running "muted" counter per incident, all painted in the
 * signature signal-lime language.
 */
export default function CooldownMatrix({ cooldowns, loading = false }: CooldownMatrixProps) {
  const [localCooldowns, setLocalCooldowns] = useState<CooldownState[]>(cooldowns);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalCooldowns(cooldowns);
  }, [cooldowns]);

  // Live-tick the remaining time
  useEffect(() => {
    const t = setInterval(() => {
      setLocalCooldowns((prev) =>
        prev.map((cd) => {
          if (!cd.expiry_time) return cd;
          const expiry = new Date(cd.expiry_time).getTime();
          const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
          return {
            ...cd,
            remaining_seconds: remaining,
            status: remaining > 0 ? "ACTIVE_SUPPRESSION" : "COOLDOWN_EXPIRED",
          };
        })
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const categories = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
  type Category = (typeof categories)[number];

  const normalize = (s: string): Category => {
    const u = s.toUpperCase();
    if (u === "CRITICAL" || u === "CRIT" || u === "FATAL") return "CRITICAL";
    if (u === "HIGH" || u === "ERROR") return "HIGH";
    if (u === "MEDIUM" || u === "WARNING") return "MEDIUM";
    return "LOW";
  };

  const categorized = useMemo(() => {
    const grouped: Record<Category, CooldownState[]> = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
    };
    for (const cd of localCooldowns) grouped[normalize(cd.severity)].push(cd);
    for (const k of categories) {
      grouped[k].sort((a, b) => {
        const ta = a.trigger_time ? new Date(a.trigger_time).getTime() : 0;
        const tb = b.trigger_time ? new Date(b.trigger_time).getTime() : 0;
        return tb - ta;
      });
    }
    return grouped;
  }, [localCooldowns]);

  const totals = useMemo(() => {
    const totalSuppressed = localCooldowns.reduce(
      (acc, cd) => acc + (cd.suppressed_count ?? 0),
      0
    );
    const activeWindows = localCooldowns.filter(
      (cd) => cd.remaining_seconds > 0
    ).length;
    return { totalSuppressed, activeWindows };
  }, [localCooldowns]);

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };
  const THEME: Record<
    Category,
    {
      accent: string;
      pill: string;
      label: string;
      badgeBg: string;
      badgeBorder: string;
      dot: string;
    }
  > = {
    CRITICAL: {
      accent: "#F43F5E",
      pill: "border-rose-500/30 bg-rose-500/10 text-rose-450",
      label: "text-rose-400",
      badgeBg: "bg-rose-500/10",
      badgeBorder: "border-rose-500/20",
      dot: "bg-rose-500",
    },
    HIGH: {
      accent: "#F59E0B",
      pill: "border-amber-500/30 bg-amber-500/10 text-amber-400",
      label: "text-amber-400",
      badgeBg: "bg-amber-500/10",
      badgeBorder: "border-amber-500/20",
      dot: "bg-amber-550",
    },
    MEDIUM: {
      accent: "#F59E0B",
      pill: "border-amber-500/30 bg-amber-500/10 text-amber-400",
      label: "text-amber-400",
      badgeBg: "bg-amber-500/10",
      badgeBorder: "border-amber-500/20",
      dot: "bg-amber-500",
    },
    LOW: {
      accent: "#10B981",
      pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      label: "text-emerald-400",
      badgeBg: "bg-emerald-500/10",
      badgeBorder: "border-emerald-500/20",
      dot: "bg-emerald-500",
    },
  };

  const hasAny = localCooldowns.length > 0;

  return (
    <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-6 sm:p-7 flex flex-col gap-6 relative overflow-hidden backdrop-blur-md shadow-xl">
      {/* signature glow */}
      <div
        className="absolute -top-24 -right-24 w-[280px] h-[280px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(163,230,53,0.12), transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-300 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-white font-black text-sm uppercase tracking-widest">
              Automated Cooldown Matrix
            </h3>
            <p className="text-zinc-500 text-xs mt-0.5">
              Rate-limiting windows collapse burst storms into a single incident
              thread — instead of firing 500 individual notifications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <span className="live-dot" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
              {loading ? "..." : `${totals.activeWindows} active`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
            <BellOff className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-[10px] font-mono text-zinc-450">
              <span className="text-zinc-200 font-bold">
                {loading ? "..." : totals.totalSuppressed.toLocaleString()}
              </span>{" "}
              muted
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 animate-pulse">
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((cat) => (
            <div key={cat} className="rounded-2xl border border-zinc-800/80 bg-[#0c0c0e] p-5 flex flex-col min-h-[200px] gap-3">
              <div className="flex justify-between items-center mb-2">
                <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-6 bg-zinc-800 rounded-full animate-pulse" />
              </div>
              <div className="rounded-xl bg-[#121215] border border-zinc-800/80 p-3 flex flex-col gap-2.5">
                <div className="h-3 w-20 bg-zinc-850 rounded animate-pulse" />
                <div className="h-3 w-32 bg-zinc-850 rounded animate-pulse" />
                <div className="h-6 w-full bg-zinc-850 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : !hasAny ? (
        <div className="relative z-10 border border-dashed border-zinc-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2 bg-[#09090b]/50">
          <CheckCircle2 className="w-9 h-9 text-zinc-650 mb-1" />
          <p className="text-sm font-semibold text-zinc-300">
            No active cooldown windows
          </p>
          <p className="text-xs text-zinc-500 max-w-md">
            The matrix will engage automatically when spike thresholds are
            crossed, absorbing subsequent events into their parent incident.
          </p>
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {categories.map((cat) => {
            const items = categorized[cat];
            const theme = THEME[cat];
            const isExpanded = !!expandedCategories[cat];
            const visible = isExpanded ? items : items.slice(0, 3);

            return (
              <div
                key={cat}
                className={`rounded-2xl border ${theme.badgeBorder} bg-[#0c0c0e] p-5 flex flex-col min-h-[200px]`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${theme.dot}`}
                    />
                    <span
                      className={`text-[11px] font-bold tracking-widest ${theme.label}`}
                    >
                      {cat}
                    </span>
                  </div>
                  <span className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded-full font-mono font-bold">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="flex-grow flex items-center justify-center text-center py-6">
                    <span className="text-zinc-650 text-[11px] italic">
                      no suppression
                    </span>
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col gap-2.5">
                    {visible.map((cd) => {
                      const expired = cd.remaining_seconds <= 0;
                      const pct = Math.min(
                        100,
                        Math.max(0, (cd.remaining_seconds / 300) * 100)
                      );

                      return (
                        <div
                          key={cd.incident_id}
                          className="rounded-xl bg-[#121215] border border-zinc-800/80 p-3 flex flex-col gap-2.5 hover:border-zinc-700 transition animate-fade-in"
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span
                              className="font-mono text-[10px] uppercase text-zinc-300 truncate max-w-[110px]"
                              title={cd.service ?? undefined}
                            >
                              {cd.service || "svc:—"}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold shrink-0 border ${theme.pill}`}
                            >
                              {cat}
                            </span>
                          </div>

                          <span
                            className="text-[10px] text-zinc-400 truncate"
                            title={cd.title ?? undefined}
                          >
                            {cd.title}
                          </span>

                          {/* Countdown Timer Pill */}
                          <div className={`flex items-center justify-between px-2 py-1.5 rounded-lg border font-mono text-[10px] sm:text-xs ${
                            expired 
                              ? "bg-zinc-950/60 border-zinc-850 text-zinc-500" 
                              : "bg-[#A3E635]/10 border-[#A3E635]/25 text-[#DFF7A6] font-bold"
                          }`}>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{formatCountdown(cd.remaining_seconds)}</span>
                            </div>
                            <span className="text-[9px] uppercase tracking-wider opacity-85">
                              {expired ? "EXPIRED" : "ACTIVE SECONDS"}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-[#09090b] h-1 rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-1000 rounded-full"
                              style={{
                                width: `${expired ? 0 : pct}%`,
                                background: expired
                                  ? "rgba(255,255,255,0.1)"
                                  : `linear-gradient(90deg, ${theme.accent}, #A3E635)`,
                              }}
                            />
                          </div>

                          <div className="flex justify-between items-center border-t border-zinc-800/80 pt-2">
                            <span className="font-mono text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded">
                              {cd.suppressed_count.toLocaleString()} muted
                            </span>
                            <span className="text-[9px] text-zinc-650 font-mono">
                              #{cd.incident_id.slice(-6)}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {items.length > 3 && (
                      <button
                        onClick={() =>
                          setExpandedCategories((p) => ({
                            ...p,
                            [cat]: !isExpanded,
                          }))
                        }
                        className="text-[10px] font-bold text-zinc-350 hover:text-white transition uppercase tracking-widest mt-1 w-full py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 cursor-pointer flex items-center justify-center gap-1 bg-zinc-900/60"
                      >
                        {isExpanded ? (
                          <>
                            <span>Collapse</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>View {items.length - 3} more</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
