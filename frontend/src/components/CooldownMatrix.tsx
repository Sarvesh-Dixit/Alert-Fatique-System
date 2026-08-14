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
}

/**
 * The Cooldown Matrix — one of the two visual anchors of the product.
 * Groups active alert suppression windows by severity and shows a live
 * countdown + running "muted" counter per incident, all painted in the
 * signature signal-lime language.
 */
export default function CooldownMatrix({ cooldowns }: CooldownMatrixProps) {
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
      pill: "border-rose-500/40 bg-rose-500/10 text-rose-300",
      label: "text-rose-300",
      badgeBg: "bg-rose-500/10",
      badgeBorder: "border-rose-500/25",
      dot: "bg-rose-500",
    },
    HIGH: {
      accent: "#F97316",
      pill: "border-orange-500/40 bg-orange-500/10 text-orange-300",
      label: "text-orange-300",
      badgeBg: "bg-orange-500/10",
      badgeBorder: "border-orange-500/25",
      dot: "bg-orange-500",
    },
    MEDIUM: {
      accent: "#F59E0B",
      pill: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      label: "text-amber-300",
      badgeBg: "bg-amber-500/10",
      badgeBorder: "border-amber-500/25",
      dot: "bg-amber-500",
    },
    LOW: {
      accent: "#A3E635",
      pill: "border-signal/40 bg-signal/10 text-signalSoft",
      label: "text-signalSoft",
      badgeBg: "bg-signal/10",
      badgeBorder: "border-signal/25",
      dot: "bg-signal",
    },
  };

  const hasAny = localCooldowns.length > 0;

  return (
    <div className="panel-hero p-6 flex flex-col gap-5 relative overflow-hidden">
      {/* signature glow */}
      <div
        className="absolute -top-24 -right-24 w-[280px] h-[280px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(163,230,53,0.18), transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-signal/15 border border-signal/40 text-signal shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-white font-black text-sm uppercase tracking-widest">
              Automated Cooldown Matrix
            </h3>
            <p className="text-white/50 text-xs mt-0.5">
              Rate-limiting windows collapse burst storms into a single incident
              thread — instead of firing 500 individual notifications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-signal/15 border border-signal/40">
            <span className="live-dot" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-signalSoft font-bold">
              {totals.activeWindows} active
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-panelHi border border-borderDark">
            <BellOff className="w-3 h-3 text-signal" />
            <span className="text-[10px] font-mono text-white/70">
              <span className="text-signalSoft font-bold">
                {totals.totalSuppressed.toLocaleString()}
              </span>{" "}
              muted
            </span>
          </div>
        </div>
      </div>

      {!hasAny ? (
        <div className="relative z-10 border border-dashed border-borderDark rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2 bg-ink/50">
          <CheckCircle2 className="w-9 h-9 text-signal/60 mb-1" />
          <p className="text-sm font-semibold text-white/80">
            No active cooldown windows
          </p>
          <p className="text-xs text-white/40 max-w-md">
            The matrix will engage automatically when spike thresholds are
            crossed, absorbing subsequent events into their parent incident.
          </p>
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const items = categorized[cat];
            const theme = THEME[cat];
            const isExpanded = !!expandedCategories[cat];
            const visible = isExpanded ? items : items.slice(0, 3);

            return (
              <div
                key={cat}
                className={`rounded-2xl border ${theme.badgeBorder} ${theme.badgeBg} p-4 flex flex-col min-h-[200px]`}
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
                  <span className="text-[10px] bg-black/30 text-white/70 px-2 py-0.5 rounded-full font-mono font-bold">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="flex-grow flex items-center justify-center text-center py-6">
                    <span className="text-white/25 text-[11px] italic">
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
                          className="rounded-xl bg-ink/70 border border-borderDark/70 p-3 flex flex-col gap-2 hover:border-signal/30 transition"
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span
                              className="font-mono text-[10px] uppercase text-white/70 truncate max-w-[110px]"
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
                            className="text-[10px] text-white/55 truncate"
                            title={cd.title ?? undefined}
                          >
                            {cd.title}
                          </span>

                          {/* Countdown */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock
                              className={`w-4 h-4 ${
                                expired ? "text-white/30" : "text-signal"
                              }`}
                            />
                            <span
                              className={`font-mono font-bold text-base tracking-tight ${
                                expired ? "text-white/40" : "text-signalSoft"
                              }`}
                            >
                              {formatCountdown(cd.remaining_seconds)}
                            </span>
                            <span className="text-[9px] text-white/30 font-mono ml-auto uppercase tracking-widest">
                              {expired ? "expired" : "remaining"}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-black/40 h-1 rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-1000 rounded-full"
                              style={{
                                width: `${expired ? 0 : pct}%`,
                                background: expired
                                  ? "rgba(255,255,255,0.15)"
                                  : `linear-gradient(90deg, ${theme.accent}, #A3E635)`,
                              }}
                            />
                          </div>

                          <div className="flex justify-between items-center border-t border-borderDark/50 pt-2">
                            <span className="font-mono text-[10px] bg-signal/10 border border-signal/25 text-signalSoft px-2 py-0.5 rounded">
                              {cd.suppressed_count.toLocaleString()} muted
                            </span>
                            <span className="text-[9px] text-white/30 font-mono">
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
                        className="text-[10px] font-bold text-signal hover:text-signalSoft transition uppercase tracking-widest mt-1 w-full py-1.5 rounded-lg border border-borderDark hover:border-signal/40 cursor-pointer flex items-center justify-center gap-1 bg-ink/50"
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
