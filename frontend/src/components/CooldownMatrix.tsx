import React, { useEffect, useState } from "react";
import { CooldownState } from "../api/client";
import { Clock, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

interface CooldownMatrixProps {
  cooldowns: CooldownState[];
}

export default function CooldownMatrix({ cooldowns }: CooldownMatrixProps) {
  const [localCooldowns, setLocalCooldowns] = useState<CooldownState[]>(cooldowns);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Sync state when props change
  useEffect(() => {
    setLocalCooldowns(cooldowns);
  }, [cooldowns]);

  // Tick the clock every second to update remaining_seconds locally
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalCooldowns((prev) =>
        prev.map((cd) => {
          if (cd.remaining_seconds > 0) {
            const nextSecs = cd.remaining_seconds - 1;
            return {
              ...cd,
              remaining_seconds: nextSecs,
              status: nextSecs > 0 ? "ACTIVE_SUPPRESSION" : "COOLDOWN_EXPIRED",
            };
          }
          return cd;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const categories = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

  const getNormalizedSeverity = (sev: string): string => {
    const upper = sev.toUpperCase();
    if (upper === "CRITICAL" || upper === "CRIT") return "CRITICAL";
    if (upper === "HIGH" || upper === "ERROR") return "HIGH";
    if (upper === "MEDIUM" || upper === "WARNING") return "MEDIUM";
    return "LOW";
  };

  const categorized = categories.reduce((acc, cat) => {
    const items = localCooldowns.filter(
      (cd) => getNormalizedSeverity(cd.severity) === cat
    );
    items.sort((a, b) => {
      const timeA = a.trigger_time ? new Date(a.trigger_time).getTime() : 0;
      const timeB = b.trigger_time ? new Date(b.trigger_time).getTime() : 0;
      return timeB - timeA;
    });
    acc[cat] = items;
    return acc;
  }, {} as Record<string, CooldownState[]>);

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const SEVERITY_THEMES: Record<string, { bg: string; text: string; border: string; badge: string; dot: string; pill: string }> = {
    CRITICAL: {
      bg: "bg-[#161928] border-[#252940]",
      text: "text-rose-400",
      border: "border-rose-500/20",
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      dot: "bg-rose-500",
      pill: "border border-rose-500/30 bg-rose-500/10 text-rose-400",
    },
    HIGH: {
      bg: "bg-[#161928] border-[#252940]",
      text: "text-amber-400",
      border: "border-amber-500/20",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dot: "bg-amber-500",
      pill: "border border-amber-500/30 bg-amber-500/10 text-amber-400",
    },
    MEDIUM: {
      bg: "bg-[#161928] border-[#252940]",
      text: "text-amber-400",
      border: "border-amber-500/20",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dot: "bg-amber-500",
      pill: "border border-amber-500/30 bg-amber-500/10 text-amber-400",
    },
    LOW: {
      bg: "bg-[#161928] border-[#252940]",
      text: "text-cyan-400",
      border: "border-cyan-500/20",
      badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      dot: "bg-cyan-500",
      pill: "border border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    },
  };

  const hasAnyCooldowns = localCooldowns.length > 0;

  return (
    <div className="card border border-[#252940] shadow-2xl p-6 flex flex-col gap-4 bg-[#161928]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Automated Cooldown Matrix</span>
          </h3>
          <p className="text-white/40 text-xs">Active rate-limiting and alert suppression state machine</p>
        </div>
      </div>

      {!hasAnyCooldowns ? (
        <div className="border border-dashed border-[#252940] rounded-xl p-8 text-center py-12 flex flex-col items-center justify-center gap-1 bg-[#0B0C14]/50">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-2" />
          <p className="text-sm font-semibold text-white/80">Zero Active Cooldown Bottlenecks</p>
          <p className="text-xs text-white/40 max-w-sm">
            Telemetry Highway will trigger cooldown windows to absorb subsequent events when alert thresholds are crossed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const items = categorized[cat] || [];
            const theme = SEVERITY_THEMES[cat];

            return (
              <div
                key={cat}
                className={`rounded-xl border ${theme.bg} p-4 flex flex-col min-h-[180px] transition-all hover:border-cyan-500/30 hover:bg-[#727DA1]/5 duration-300`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-xs font-bold tracking-wider ${theme.text}`}>{cat}</span>
                  <span className="text-[10px] bg-[#727DA1]/15 text-white/80 px-2 py-0.5 rounded-full font-mono font-bold tracking-tight">
                    {items.length} active
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="flex-grow flex items-center justify-center text-center py-6">
                    <span className="text-white/20 text-xs italic">No suppression</span>
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col gap-3">
                    {(() => {
                      const isExpanded = !!expandedCategories[cat];
                      const displayedItems = isExpanded ? items : items.slice(0, 3);
                      return (
                        <>
                          <div className="flex flex-col gap-3">
                            {displayedItems.map((cd) => {
                              const isExpired = cd.remaining_seconds <= 0;
                              // Progress Math based on standard 300s window
                              const pct = Math.min(100, Math.max(0, (cd.remaining_seconds / 300) * 100));

                              return (
                                <div
                                  key={cd.incident_id}
                                  className="rounded-lg bg-[#0B0C14]/60 border border-[#252940] p-3 flex flex-col gap-2.5 shadow-lg"
                                >
                                  <div className="flex flex-col gap-1">
                                    <div className="flex justify-between items-center gap-2">
                                      <span className="font-mono tracking-tight text-xs uppercase text-slate-400 truncate max-w-[110px]" title={cd.service ?? undefined}>
                                        {cd.service}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono tracking-tight shrink-0 ${theme.pill}`}>
                                        {cat}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-white/50 truncate" title={cd.title ?? undefined}>
                                      {cd.title}
                                    </span>
                                  </div>

                                  {/* Timer section with Lucide icon */}
                                  <div className="flex items-center gap-1.5 my-0.5">
                                    <Clock className="w-4 h-4 text-cyan-400" />
                                    <span className="font-mono font-bold text-base text-cyan-300 tracking-tight">
                                      {formatCountdown(cd.remaining_seconds)}
                                    </span>
                                    <span className="text-[10px] text-white/30 font-mono tracking-tight ml-auto">remaining</span>
                                  </div>

                                  {/* Thin 2px custom progress bar */}
                                  <div className="w-full bg-[#0B0C14] h-0.5 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-cyan-400 h-full transition-all duration-1000" 
                                      style={{ width: `${isExpired ? 0 : pct}%` }}
                                    />
                                  </div>

                                  {/* Suppressed Counter Badge */}
                                  <div className="flex justify-between items-center border-t border-[#252940]/60 pt-2">
                                    <span className="font-mono tracking-tight text-[10px] bg-[#161928] text-slate-300 border border-[#252940] px-2 py-0.5 rounded">
                                      {cd.suppressed_count} suppressed
                                    </span>
                                    <span className="text-[9px] text-white/30 font-mono tracking-tight">ID: {cd.incident_id.slice(-6)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {items.length > 3 && (
                            <button
                              onClick={() => setExpandedCategories(prev => ({ ...prev, [cat]: !isExpanded }))}
                              className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-wider mt-1.5 text-center w-full py-1.5 hover:bg-[#727DA1]/10 rounded border border-[#252940] cursor-pointer flex items-center justify-center gap-1 bg-[#0B0C14]/40"
                            >
                              {isExpanded ? (
                                <>
                                  <span>Collapse</span>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </>
                              ) : (
                                <>
                                  <span>View {items.length - 3} More</span>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                          )}
                        </>
                      );
                    })()}
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
