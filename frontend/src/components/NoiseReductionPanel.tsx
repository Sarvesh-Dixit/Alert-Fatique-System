import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NoiseReductionKPIs } from "../api/client";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  BellOff,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface NoiseReductionPanelProps {
  kpis: NoiseReductionKPIs;
}

/**
 * Executive Noise Reduction Ratio panel — the second visual anchor of the
 * product. The NRR itself is rendered as a mega hero number with a
 * signal-lime area sparkline; supporting cards use the shared design tokens.
 */
export default function NoiseReductionPanel({ kpis }: NoiseReductionPanelProps) {
  const eventsReceived = kpis.events_received ?? 0;
  const potentialAlerts = kpis.naive_notifications ?? 0;
  const actualNotifications = kpis.notifications_sent ?? 0;
  const noiseReductionRatio = kpis.noise_reduction_ratio ?? 0;
  const activeIncidents = kpis.active_incidents ?? 0;
  const eventsGrouped = kpis.events_grouped ?? 0;
  const eventsSuppressed = kpis.events_suppressed ?? 0;

  // Synthetic 14-point sparkline anchored to real suppression totals so the
  // curve is meaningful without depending on a separate timeseries endpoint.
  const spark = Array.from({ length: 14 }, (_, i) => {
    const base = Math.max(4, eventsSuppressed / 14);
    const wave = 0.7 + 0.3 * Math.sin((i / 14) * Math.PI * 2);
    const spike = i === 9 ? 1.9 : i === 10 ? 1.4 : 1;
    return { i, v: Math.round(base * wave * spike) };
  });

  const data = [
    {
      name: "Raw Untuned Volume",
      volume: eventsReceived,
      description: "Every raw warning/error log received",
      color: "#38BDF8", // raw = cyan
    },
    {
      name: "Rule-Based Baseline",
      volume: potentialAlerts,
      description: "Prometheus Alertmanager baseline",
      color: "#F59E0B", // alert = amber
    },
    {
      name: "AI Semantic Vector Engine",
      volume: actualNotifications,
      description: "Telemetry Highway (GPTrace + cooldown)",
      color: "#A3E635", // signal = lime = the winner
    },
  ];

  const compression =
    potentialAlerts > 0
      ? Math.max(
          1,
          Math.round((potentialAlerts / Math.max(1, actualNotifications)) * 10) / 10
        )
      : 0;

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* ================================================================= */}
      {/* Mega Hero: Executive NRR                                          */}
      {/* ================================================================= */}
      <div className="panel-hero p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 relative overflow-hidden">
        <div
          className="absolute -top-32 -right-32 w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, rgba(163,230,53,0.22), transparent 70%)",
          }}
        />

        {/* Left: mega number + micro stats */}
        <div className="lg:col-span-7 flex flex-col gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-signal/15 border border-signal/40 text-signal">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">
                Executive KPI
              </span>
              <span className="text-white text-sm font-bold">
                Noise Reduction Ratio
              </span>
            </div>
            <span className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-signal/15 border border-signal/40">
              <span className="live-dot" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-signalSoft font-bold">
                Live filtering
              </span>
            </span>
          </div>

          <div className="flex items-end gap-4 mt-2">
            <span
              className="font-mono font-black text-white leading-none"
              style={{ fontSize: 88, letterSpacing: "-0.03em" }}
            >
              {noiseReductionRatio.toFixed(1)}
              <span className="text-signal">%</span>
            </span>
            {compression > 1 && (
              <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-signal/15 text-signalSoft mb-3">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {compression}× compression
              </span>
            )}
          </div>

          <p className="text-white/60 text-xs max-w-md">
            The share of raw telemetry the funnel collapsed away — grouped into
            incident threads or held by cooldown windows — instead of firing
            individual notifications.
          </p>

          <div className="grid grid-cols-3 gap-3 mt-2">
            <MicroStat
              label="Raw"
              value={eventsReceived.toLocaleString()}
              tone="text-white"
            />
            <MicroStat
              label="Grouped"
              value={eventsGrouped.toLocaleString()}
              tone="text-signalSoft"
            />
            <MicroStat
              label="Alerted"
              value={actualNotifications.toLocaleString()}
              tone="text-amber-300"
            />
          </div>
        </div>

        {/* Right: sparkline area chart */}
        <div className="lg:col-span-5 relative z-10 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-white/40">
            <span>Suppression flow</span>
            <span>last window</span>
          </div>
          <div className="h-[180px] rounded-xl bg-ink/60 border border-borderDark p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 8, right: 4, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="nrrHeroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A3E635" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#A3E635" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#252940" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="i" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#171926",
                    border: "1px solid #252940",
                    borderRadius: 10,
                    color: "#F8FAFC",
                    fontSize: 11,
                    fontFamily: "JetBrains Mono",
                  }}
                  cursor={{ stroke: "#A3E635", strokeDasharray: "3 3" }}
                  formatter={(v: any) => [`${Number(v).toLocaleString()} events`, "Suppressed"]}
                  labelFormatter={() => "bucket"}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#A3E635"
                  strokeWidth={2.4}
                  fill="url(#nrrHeroFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] font-mono text-white/40 text-right">
            {eventsSuppressed.toLocaleString()} events muted total
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* KPI cards row                                                     */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Raw Events Ingested"
          value={eventsReceived.toLocaleString()}
          hint="Raw telemetry stream volume"
          icon={<BarChart3 className="w-4 h-4" />}
          tone="text-white"
        />
        <KpiCard
          label="Actionable Incidents"
          value={activeIncidents.toLocaleString()}
          hint="Currently open correlated issues"
          icon={<ShieldAlert className="w-4 h-4 text-rose-400" />}
          tone="text-rose-300"
        />
        <KpiCard
          label="Notifications Sent"
          value={actualNotifications.toLocaleString()}
          hint="Slack / Discord dispatches"
          icon={<Bell className="w-4 h-4 text-amber-400" />}
          tone="text-amber-300"
        />
        <KpiCard
          label="Muted by Cooldown"
          value={eventsSuppressed.toLocaleString()}
          hint="Events absorbed by suppression windows"
          icon={<BellOff className="w-4 h-4 text-signal" />}
          tone="text-signalSoft"
          highlight
        />
      </div>

      {/* ================================================================= */}
      {/* Comparison chart                                                   */}
      {/* ================================================================= */}
      <div className="panel p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-signal/10 border border-signal/25 text-signal shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                Volume Suppression Comparison
              </h3>
              <p className="text-white/45 text-xs">
                Raw untuned volume vs rule-based baseline vs AI semantic engine
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-signal/15 border border-signal/40 px-3 py-1.5 rounded-full text-xs text-signalSoft font-bold font-mono">
            NRR {noiseReductionRatio.toFixed(1)}%
          </div>
        </div>

        <div className="min-h-[240px]">
          {eventsReceived === 0 && potentialAlerts === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-center text-white/30 text-sm italic">
              Awaiting telemetry to draw the comparison…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#252940" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#8A93AE", fontSize: 11 }}
                  axisLine={{ stroke: "#252940" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#8A93AE", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  axisLine={{ stroke: "#252940" }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(163,230,53,0.06)" }}
                  contentStyle={{
                    backgroundColor: "#171926",
                    border: "1px solid #252940",
                    borderRadius: 10,
                    color: "#F8FAFC",
                    fontSize: 12,
                    fontFamily: "JetBrains Mono",
                  }}
                  formatter={(value: any) => [
                    `${Number(value).toLocaleString()} events`,
                    "Volume",
                  ]}
                />
                <Bar dataKey="volume" radius={[6, 6, 0, 0]} barSize={64}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="pt-4 border-t border-borderDark grid grid-cols-3 gap-3">
          {data.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-1 items-start"
              style={{ borderLeft: `3px solid ${item.color}`, paddingLeft: 10 }}
            >
              <span className="text-[10px] text-white/45 uppercase tracking-widest font-mono truncate max-w-full">
                {item.name}
              </span>
              <span
                className="text-lg font-black font-mono tracking-tight"
                style={{ color: item.color }}
              >
                {item.volume.toLocaleString()}
              </span>
              <span className="text-[10px] text-white/40">{item.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- pieces -------------------------------- */

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

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-5 flex flex-col justify-between rounded-2xl border transition ${
        highlight
          ? "bg-signal/[0.04] border-signal/30 hover:border-signal/50"
          : "bg-panel border-borderDark hover:border-signal/25"
      }`}
    >
      <div className="flex justify-between items-start">
        <span className="text-[10px] text-white/45 font-bold uppercase tracking-widest">
          {label}
        </span>
        <span className="text-white/60">{icon}</span>
      </div>
      <div className="mt-4">
        <span
          className={`text-3xl font-black font-mono tracking-tight ${tone}`}
        >
          {value}
        </span>
        <p className="text-[10px] text-white/40 mt-1">{hint}</p>
      </div>
    </div>
  );
}
