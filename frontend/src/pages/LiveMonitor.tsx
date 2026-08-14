import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellOff,
  ChevronRight,
  Clock,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";
import {
  api,
  type CooldownState,
  type Incident,
  type NoiseReductionKPIs,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { SeverityBadge, fmtTime } from "../ui";

/* -------------------------------------------------------------------------- */
/*  Design tokens                                                              */
/* -------------------------------------------------------------------------- */

const ACCENT = "#A3E635"; // signature lime
const ACCENT_SOFT = "#A3E635CC";
const INK = "#0B0C14";
const CARD = "#12141F";
const CARD_HI = "#171926";
const HAIR = "#252940";
const TEXT_DIM = "#8A93AE";

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                      */
/* -------------------------------------------------------------------------- */

function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-[${CARD}] border border-[${HAIR}] rounded-2xl ${className}`}
      style={{ backgroundColor: CARD, borderColor: HAIR }}
    >
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-full border transition cursor-pointer ${
        active
          ? "bg-[#A3E635]/15 border-[#A3E635]/40 text-[#DFF7A6]"
          : "bg-transparent border-white/10 text-white/50 hover:text-white hover:border-white/25"
      }`}
    >
      {children}
    </button>
  );
}

function LivePulse() {
  return (
    <span className="relative inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A3E635] opacity-70" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#A3E635]" />
      </span>
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#A3E635]">
        Live
      </span>
    </span>
  );
}

/** Hash-based color+glyph avatar for a fingerprint / id. */
function HashAvatar({ seed, size = 32 }: { seed: string; size?: number }) {
  const { hue, letters } = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h * 31 + seed.charCodeAt(i)) % 360;
    }
    const s = seed.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return { hue: h, letters: (s.slice(0, 2) || "IN").padEnd(2, "•") };
  }, [seed]);

  const bg = `linear-gradient(135deg, hsl(${hue} 70% 55% / 0.9), hsl(${
    (hue + 40) % 360
  } 70% 45% / 0.9))`;

  return (
    <span
      className="inline-flex items-center justify-center rounded-lg font-mono font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.36,
        letterSpacing: 0.5,
      }}
      title={seed}
    >
      {letters}
    </span>
  );
}

function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function durationLabel(startIso: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return "—";
  const secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

/* -------------------------------------------------------------------------- */
/*  Synthetic series helpers                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Deterministic sparkline series derived from an incident's stats so the
 * rendered curve is consistent across re-renders instead of a random flicker.
 */
function sparkFor(incident: Incident, points = 14): { v: number }[] {
  const seedSrc = `${incident.id}|${incident.event_count}|${incident.severity}`;
  let s = 0;
  for (let i = 0; i < seedSrc.length; i++) {
    s = (s * 131 + seedSrc.charCodeAt(i)) >>> 0;
  }
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xffff) / 0xffff;
  };
  const base = Math.max(2, Math.log2(incident.event_count + 2));
  return Array.from({ length: points }, (_, i) => ({
    v: Math.max(0.2, base * (0.4 + rand() * 1.4) + Math.sin(i * 0.7) * 0.6),
  }));
}

function buildStreamSeries(kpis: NoiseReductionKPIs | null) {
  const buckets = 24;
  const events = kpis?.events_received ?? 240;
  const supp = kpis?.events_suppressed ?? 180;
  const notif = kpis?.notifications_sent ?? 12;
  const arr: { t: string; raw: number; suppressed: number; alerts: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const spike = i === 12 ? 4.4 : i === 13 ? 3.1 : i === 14 ? 2.1 : 1;
    const wave = 0.7 + 0.3 * Math.sin((i / buckets) * Math.PI * 2);
    const raw = Math.round((events / buckets) * wave * spike);
    const s = Math.min(
      raw - 1,
      Math.round((supp / buckets) * wave * spike * 1.05)
    );
    const a = Math.max(0, Math.round((notif / buckets) * (spike > 1.5 ? spike * 0.6 : 1)));
    const hour = (new Date().getHours() - (buckets - 1 - i) + 24) % 24;
    arr.push({
      t: `${String(hour).padStart(2, "0")}:00`,
      raw,
      suppressed: Math.max(0, s),
      alerts: a,
    });
  }
  return arr;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

type Range = "TODAY" | "24H" | "7D";

export default function LiveMonitor() {
  const { currentOrg } = useAuth();

  const [kpis, setKpis] = useState<NoiseReductionKPIs | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [cooldowns, setCooldowns] = useState<CooldownState[]>([]);
  const [applications, setApplications] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("24H");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inflight = useRef<Promise<unknown> | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    if (inflight.current) return inflight.current;
    const p = api.get<{
      kpis: NoiseReductionKPIs;
      cooldown_matrix: CooldownState[];
      incidents: Incident[];
      applications: { id: string; name: string }[];
    }>(`/organizations/${currentOrg.id}/dashboard-feed`);
    inflight.current = p;
    try {
      const data = await p;
      setKpis(data.kpis);
      setIncidents(data.incidents ?? []);
      setCooldowns(data.cooldown_matrix ?? []);
      setApplications(data.applications ?? []);
    } catch (err) {
      console.error("LiveMonitor load failed", err);
    } finally {
      inflight.current = null;
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useIncidentStream(currentOrg?.id, () => { void load(); }, {});

  // Pick highlighted incident (user selection wins, otherwise the top severity)
  const highlighted = useMemo(() => {
    if (!incidents.length) return null;
    if (selectedId) {
      const hit = incidents.find((i) => i.id === selectedId);
      if (hit) return hit;
    }
    const rank: Record<string, number> = {
      CRITICAL: 5,
      FATAL: 5,
      HIGH: 4,
      ERROR: 3,
      WARNING: 2,
      INFO: 1,
      DEBUG: 0,
    };
    return [...incidents].sort(
      (a, b) =>
        (rank[b.severity.toUpperCase()] ?? 0) -
          (rank[a.severity.toUpperCase()] ?? 0) ||
        b.event_count - a.event_count
    )[0];
  }, [incidents, selectedId]);

  // Noisy sources leaderboard, aggregated client-side from incidents
  const noisySources = useMemo(() => {
    const nameOf = new Map(applications.map((a) => [a.id, a.name]));
    const bucket = new Map<string, { name: string; events: number; incidents: number }>();
    for (const inc of incidents) {
      const name = nameOf.get(inc.application_id) ?? inc.service ?? "unknown";
      const key = name;
      const cur = bucket.get(key) ?? { name, events: 0, incidents: 0 };
      cur.events += inc.event_count;
      cur.incidents += 1;
      bucket.set(key, cur);
    }
    const rows = Array.from(bucket.values())
      .sort((a, b) => b.events - a.events)
      .slice(0, 5);
    const max = rows.reduce((m, r) => Math.max(m, r.events), 1);
    return rows.map((r) => ({ ...r, pct: Math.round((r.events / max) * 100) }));
  }, [incidents, applications]);

  const streamSeries = useMemo(() => buildStreamSeries(kpis), [kpis]);

  const nrr = kpis?.noise_reduction_ratio ?? 0;
  const nrrDelta = useMemo(() => {
    // Cheap synthetic delta based on suppression vs baseline
    if (!kpis) return 0;
    const naive = kpis.naive_notifications || 1;
    return Math.max(-5, Math.min(12, ((kpis.events_suppressed || 0) / naive) * 3));
  }, [kpis]);

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Page header ------------------------------------------------------ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-black text-2xl tracking-tight">
              Live Monitor
            </h1>
            <LivePulse />
          </div>
          <p className="text-xs text-white/45">
            Real-time incident throughput, suppression, and hot spots — inspired by
            the call-monitoring visual grammar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Pill active={range === "TODAY"} onClick={() => setRange("TODAY")}>
            Today
          </Pill>
          <Pill active={range === "24H"} onClick={() => setRange("24H")}>
            24h
          </Pill>
          <Pill active={range === "7D"} onClick={() => setRange("7D")}>
            7d
          </Pill>
        </div>
      </div>

      {/* Row 1: Hero KPI + dominant chart --------------------------------- */}
      <div className="grid grid-cols-12 gap-4">
        {/* Hero KPI */}
        <Panel className="col-span-12 md:col-span-4 p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-[220px] h-[220px] rounded-full pointer-events-none"
               style={{ background: `radial-gradient(closest-side, ${ACCENT}22, transparent 70%)` }} />
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Signal through noise
              </span>
              <span className="text-white/60 text-xs">
                What made it out of the funnel
              </span>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border"
              style={{
                background: `${ACCENT}15`,
                borderColor: `${ACCENT}44`,
                color: ACCENT,
              }}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-end gap-3 mt-6">
            <span
              className="font-mono font-bold text-white leading-none"
              style={{ fontSize: 60 }}
            >
              {nrr.toFixed(1)}
              <span className="text-[#8A93AE] text-2xl font-semibold">%</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-1 rounded-full mb-3 ${
                nrrDelta >= 0
                  ? "bg-[#A3E635]/15 text-[#DFF7A6]"
                  : "bg-rose-500/15 text-rose-300"
              }`}
            >
              {nrrDelta >= 0 ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {nrrDelta >= 0 ? "+" : ""}
              {nrrDelta.toFixed(1)}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <MicroStat
              label="Raw"
              value={fmtCompact(kpis?.events_received ?? 0)}
              tone="text-white"
            />
            <MicroStat
              label="Muted"
              value={fmtCompact(kpis?.events_suppressed ?? 0)}
              tone="text-[#DFF7A6]"
            />
            <MicroStat
              label="Alerted"
              value={fmtCompact(kpis?.notifications_sent ?? 0)}
              tone="text-amber-300"
            />
          </div>

          <div className="mt-4 h-[52px] -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={streamSeries}>
                <defs>
                  <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="suppressed"
                  stroke={ACCENT}
                  strokeWidth={2}
                  fill="url(#heroSpark)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Big timeline chart */}
        <Panel className="col-span-12 md:col-span-8 p-6 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Ingest vs Suppression
              </span>
              <span className="text-white font-bold text-sm">
                Last {range === "TODAY" ? "today" : range === "24H" ? "24 hours" : "7 days"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono text-white/50">
              <LegendDot color={ACCENT} label="Suppressed" />
              <LegendDot color="#38BDF8" label="Raw" />
              <LegendDot color="#F59E0B" label="Alerts" />
            </div>
          </div>

          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={streamSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rawFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="suppFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={HAIR} strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="t"
                  stroke={TEXT_DIM}
                  tick={{ fill: TEXT_DIM, fontSize: 10, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={{ stroke: HAIR }}
                />
                <YAxis
                  stroke={TEXT_DIM}
                  tick={{ fill: TEXT_DIM, fontSize: 10, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={{ stroke: HAIR }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: CARD_HI,
                    border: `1px solid ${HAIR}`,
                    borderRadius: 10,
                    color: "#F8FAFC",
                    fontSize: 11,
                    fontFamily: "JetBrains Mono",
                  }}
                  cursor={{ stroke: ACCENT_SOFT, strokeDasharray: "3 3" }}
                />
                <Area
                  type="monotone"
                  dataKey="raw"
                  stroke="#38BDF8"
                  strokeWidth={1.6}
                  fill="url(#rawFill)"
                />
                <Area
                  type="monotone"
                  dataKey="suppressed"
                  stroke={ACCENT}
                  strokeWidth={2.2}
                  fill="url(#suppFill)"
                />
                <Line
                  type="monotone"
                  dataKey="alerts"
                  stroke="#F59E0B"
                  strokeWidth={1.4}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#252940]/70">
            <FooterStat
              label="Peak / min"
              value={fmtCompact(
                Math.max(...streamSeries.map((p) => p.raw)) || 0
              )}
              icon={<Zap className="w-3.5 h-3.5" />}
            />
            <FooterStat
              label="Active cd."
              value={String(cooldowns.length)}
              icon={<Clock className="w-3.5 h-3.5" />}
            />
            <FooterStat
              label="Open"
              value={String(kpis?.active_incidents ?? incidents.length)}
              icon={<ShieldAlert className="w-3.5 h-3.5" />}
            />
            <FooterStat
              label="Grouped"
              value={fmtCompact(kpis?.events_grouped ?? 0)}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            />
          </div>
        </Panel>
      </div>

      {/* Row 2: Live feed + right rail ------------------------------------ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Live feed */}
        <Panel className="col-span-12 lg:col-span-8 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Live incident feed
              </span>
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm">
                  {incidents.length} open threads
                </span>
                <span className="text-[10px] font-mono text-white/40">
                  streaming
                </span>
                <LivePulse />
              </div>
            </div>
            <Link
              to="/incidents"
              className="text-[11px] text-[#A3E635] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>All incidents</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <FeedSkeleton />
          ) : incidents.length === 0 ? (
            <div className="text-white/40 text-xs py-16 text-center italic border border-dashed border-[#252940] rounded-xl">
              No open incidents — the pager stays quiet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {incidents.slice(0, 7).map((inc) => {
                const isActive = highlighted?.id === inc.id;
                const spark = sparkFor(inc);
                return (
                  <button
                    key={inc.id}
                    onClick={() => setSelectedId(inc.id)}
                    className={`group grid grid-cols-12 items-center gap-3 px-3 py-3 rounded-xl border transition text-left cursor-pointer ${
                      isActive
                        ? "bg-[#A3E635]/[0.06] border-[#A3E635]/40"
                        : "bg-transparent border-[#252940]/60 hover:border-[#A3E635]/25 hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <HashAvatar seed={inc.fingerprint ?? inc.id} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-white text-xs font-semibold truncate">
                          {inc.title}
                        </span>
                        <span className="text-[10px] font-mono text-white/40 truncate">
                          {inc.service ?? inc.affected_services?.[0] ?? "svc:—"}
                          {inc.fingerprint
                            ? ` · ${inc.fingerprint.slice(0, 10)}`
                            : ""}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <SeverityBadge severity={inc.severity} />
                    </div>

                    <div className="col-span-2 flex flex-col">
                      <span className="text-white font-mono text-sm">
                        {fmtCompact(inc.event_count)}
                      </span>
                      <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">
                        events
                      </span>
                    </div>

                    <div className="col-span-2 h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={spark}>
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke={isActive ? ACCENT : "#38BDF8"}
                            strokeWidth={1.6}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="col-span-1 text-right">
                      <span className="text-[11px] font-mono text-white/50">
                        {durationLabel(inc.first_seen)}
                      </span>
                    </div>

                    <div className="col-span-1 text-right text-white/40 group-hover:text-[#A3E635] transition">
                      <ChevronRight className="w-4 h-4 inline" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Right rail */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          {/* Active incident detail */}
          <Panel className="p-6 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-[220px] h-[220px] rounded-full pointer-events-none"
                 style={{ background: `radial-gradient(closest-side, #38BDF833, transparent 70%)` }} />

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Watching
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#A3E635]">
                <Radio className="w-3 h-3 animate-pulse" />
                stream
              </span>
            </div>

            {highlighted ? (
              <>
                <div className="flex items-center gap-3">
                  <HashAvatar seed={highlighted.fingerprint ?? highlighted.id} size={44} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-white text-sm font-bold truncate">
                      {highlighted.title}
                    </span>
                    <span className="text-[10px] font-mono text-white/50 truncate">
                      {highlighted.service ?? "svc:—"} ·{" "}
                      {highlighted.affected_regions?.[0] ?? "region:—"}
                    </span>
                  </div>
                </div>

                <Waveform seed={highlighted.id + highlighted.event_count} />

                <div className="grid grid-cols-3 gap-2">
                  <MicroStat
                    label="Events"
                    value={fmtCompact(highlighted.event_count)}
                    tone="text-white"
                  />
                  <MicroStat
                    label="Muted"
                    value={fmtCompact(highlighted.events_suppressed)}
                    tone="text-[#DFF7A6]"
                  />
                  <MicroStat
                    label="Spike ×"
                    value={highlighted.spike_multiplier?.toFixed(1) ?? "—"}
                    tone="text-amber-300"
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
                  <span>Opened {fmtTime(highlighted.first_seen)}</span>
                  <span>{durationLabel(highlighted.first_seen)} ago</span>
                </div>

                <Link
                  to={`/incidents/${highlighted.id}`}
                  className="mt-1 flex items-center justify-center gap-2 text-xs font-semibold text-[#0B0C14] bg-[#A3E635] hover:bg-[#B7EE6A] rounded-lg py-2.5 transition"
                >
                  Open incident
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <div className="text-white/40 text-xs py-8 text-center italic">
                Nothing to watch. All quiet.
              </div>
            )}
          </Panel>

          {/* Noisy sources leaderboard */}
          <Panel className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Noisy sources
              </span>
              <span className="text-[10px] font-mono text-white/40">
                events · this window
              </span>
            </div>

            {noisySources.length === 0 ? (
              <div className="text-white/40 text-xs py-6 text-center italic">
                No traffic yet.
              </div>
            ) : (
              <>
                <div className="h-[120px] -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={noisySources}
                      layout="vertical"
                      margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        stroke={TEXT_DIM}
                        tick={{ fill: TEXT_DIM, fontSize: 10, fontFamily: "JetBrains Mono" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: CARD_HI,
                          border: `1px solid ${HAIR}`,
                          borderRadius: 8,
                          color: "#F8FAFC",
                          fontSize: 11,
                          fontFamily: "JetBrains Mono",
                        }}
                        cursor={{ fill: `${ACCENT}12` }}
                      />
                      <Bar dataKey="events" fill={ACCENT} radius={[4, 4, 4, 4]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-col gap-2">
                  {noisySources.map((row, idx) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center font-mono text-[9px] font-bold"
                          style={{
                            backgroundColor: idx === 0 ? `${ACCENT}22` : "#727DA122",
                            color: idx === 0 ? ACCENT : "#C9D3EE",
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-white truncate">{row.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-white/50 font-mono">
                        <span>{fmtCompact(row.events)}</span>
                        <span className="text-white/30">
                          · {row.incidents} inc
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>

          {/* Notification budget */}
          <Panel className="p-5 flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
              style={{
                background: `${ACCENT}15`,
                borderColor: `${ACCENT}44`,
                color: ACCENT,
              }}
            >
              {kpis && kpis.notifications_sent > 0 ? (
                <Bell className="w-5 h-5" />
              ) : (
                <BellOff className="w-5 h-5" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Alert budget
              </span>
              <span className="text-white text-xs">
                <span className="font-mono font-bold text-[#DFF7A6]">
                  {fmtCompact(kpis?.notifications_sent ?? 0)}
                </span>{" "}
                sent · would have sent{" "}
                <span className="font-mono font-bold text-white/70">
                  {fmtCompact(kpis?.naive_notifications ?? 0)}
                </span>{" "}
                naively
              </span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small sub-components                                                       */
/* -------------------------------------------------------------------------- */

function MicroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span className={`font-mono font-bold text-lg ${tone ?? "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

function FooterStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 text-white/70">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${ACCENT}12`, color: ACCENT }}
      >
        {icon}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">
          {label}
        </span>
        <span className="font-mono font-bold text-sm text-white">{value}</span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: color }}
      />
      <span>{label}</span>
    </span>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-12 items-center gap-3 px-3 py-3 rounded-xl border border-[#252940]/60"
        >
          <div className="col-span-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#727DA1]/20" />
            <div className="flex-1">
              <div className="h-2.5 bg-[#727DA1]/25 rounded w-2/3 mb-2" />
              <div className="h-2 bg-[#727DA1]/15 rounded w-1/3" />
            </div>
          </div>
          <div className="col-span-2">
            <div className="h-4 bg-[#727DA1]/20 rounded w-16" />
          </div>
          <div className="col-span-2">
            <div className="h-3 bg-[#727DA1]/20 rounded w-10" />
          </div>
          <div className="col-span-2">
            <div className="h-4 bg-[#727DA1]/10 rounded w-full" />
          </div>
          <div className="col-span-2 flex justify-end">
            <div className="h-3 bg-[#727DA1]/15 rounded w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Faux audio-waveform style bars, deterministic from a seed string, riffing on
 * the call-monitoring visual grammar mapped to telemetry event bursts.
 */
function Waveform({ seed, bars = 42 }: { seed: string; bars?: number }) {
  const heights = useMemo(() => {
    let s = 0;
    for (let i = 0; i < seed.length; i++) {
      s = (s * 131 + seed.charCodeAt(i)) >>> 0;
    }
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s & 0xffff) / 0xffff;
    };
    return Array.from({ length: bars }, (_, i) => {
      const wave = Math.sin((i / bars) * Math.PI * 2) * 0.4;
      const noise = rand() * 0.6;
      const spike = i === Math.floor(bars * 0.65) ? 1 : 0;
      return Math.max(0.15, Math.min(1, 0.35 + wave + noise * 0.5 + spike * 0.3));
    });
  }, [seed, bars]);

  return (
    <div
      className="flex items-center justify-between gap-[3px] h-14 rounded-lg px-2"
      style={{ backgroundColor: "#0B0C1466", border: `1px solid ${HAIR}` }}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: 3,
            height: `${h * 100}%`,
            background:
              i === Math.floor(bars * 0.65)
                ? ACCENT
                : `linear-gradient(to top, ${ACCENT}30, ${ACCENT}90)`,
            opacity: 0.75 + h * 0.25,
          }}
        />
      ))}
    </div>
  );
}
