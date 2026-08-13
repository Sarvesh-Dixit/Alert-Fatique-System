import React from "react";
import {
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
import { BarChart3, ShieldAlert, Bell, ShieldCheck } from "lucide-react";

interface NoiseReductionPanelProps {
  kpis: NoiseReductionKPIs;
}

export default function NoiseReductionPanel({ kpis }: NoiseReductionPanelProps) {
  const eventsReceived = kpis.events_received ?? 0;
  const potentialAlerts = kpis.naive_notifications ?? 0;
  const actualNotifications = kpis.notifications_sent ?? 0;
  const noiseReductionRatio = kpis.noise_reduction_ratio ?? 0;
  const activeIncidents = kpis.active_incidents ?? 0;

  // Chart data
  const data = [
    {
      name: "Raw Untuned Volume",
      volume: eventsReceived,
      description: "Every raw warning/error log received",
      color: "#38BDF8", // Electric Cyan (neonCyan)
    },
    {
      name: "Rule-Based Baseline",
      volume: potentialAlerts,
      description: "Prometheus Alertmanager baseline (fingerprint-level alert trigger)",
      color: "#f59e0b", // Amber
    },
    {
      name: "AI Semantic Vector Engine",
      volume: actualNotifications,
      description: "Telemetry Highway (GPTrace similarity cluster + cooldown suppression)",
      color: "#10b981", // Emerald
    },
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* 4 Key Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Raw Events */}
        <div className="card border border-[#252940] bg-[#161928] p-5 flex flex-col justify-between hover:border-cyan-500/30 transition-all duration-200">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Raw Events Ingested</span>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-semibold font-mono tracking-tight text-white">
              {eventsReceived.toLocaleString()}
            </span>
            <p className="text-[10px] text-white/30 mt-1 font-mono tracking-tight">Raw telemetry stream ingress volume</p>
          </div>
        </div>

        {/* Card 2: Actionable Incidents */}
        <div className="card border border-[#252940] bg-[#161928] p-5 flex flex-col justify-between hover:border-cyan-500/30 transition-all duration-200">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Actionable Incidents</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-semibold font-mono tracking-tight text-rose-400">
              {activeIncidents.toLocaleString()}
            </span>
            <p className="text-[10px] text-white/30 mt-1 font-mono tracking-tight">Currently open correlated issues</p>
          </div>
        </div>

        {/* Card 3: Outbound Notifications */}
        <div className="card border border-[#252940] bg-[#161928] p-5 flex flex-col justify-between hover:border-cyan-500/30 transition-all duration-200">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Notifications Sent</span>
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-semibold font-mono tracking-tight text-amber-400">
              {actualNotifications.toLocaleString()}
            </span>
            <p className="text-[10px] text-white/30 mt-1 font-mono tracking-tight">External Slack/Discord dispatches</p>
          </div>
        </div>

        {/* Card 4: Noise Reduction Ratio */}
        <div className="card border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.05)] p-5 flex flex-col justify-between hover:scale-[1.01] transition-transform duration-300 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider">Noise Reduction</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <span className="text-3xl font-semibold font-mono tracking-tight">
                {noiseReductionRatio}%
              </span>
              <p className="text-[10px] text-white/40 mt-1 font-mono tracking-tight">Alert volume compression ratio</p>
            </div>
            {/* Live status indicator pill */}
            <div className="flex items-center gap-1.5 shrink-0 bg-[#0B0C14]/60 border border-emerald-500/20 px-2 py-1 rounded-full font-mono text-[8px] font-bold text-emerald-400">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>ACTIVE FILTERING ENGINE</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3-way Comparative Chart */}
      <div className="card bg-[#161928] border border-[#252940] shadow-2xl p-6 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Volume Suppression Comparison</span>
            </h3>
            <p className="text-white/40 text-xs">Comparison between Raw untuned events, exact rules, and AI Highway</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs text-emerald-400 font-bold font-mono tracking-tight">
            NRR: {noiseReductionRatio}% Compression
          </div>
        </div>

        <div className="min-h-[220px]">
          {eventsReceived === 0 && potentialAlerts === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-center text-white/30 text-sm italic">
              Awaiting simulated alert stream to draw comparison chart...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#252940" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={{ stroke: "#252940" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  axisLine={{ stroke: "#252940" }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.02)" }}
                  contentStyle={{
                    backgroundColor: "#141724",
                    borderColor: "#252940",
                    borderRadius: "8px",
                    color: "#f8fafc",
                    fontSize: "12px",
                    fontFamily: "JetBrains Mono",
                  }}
                  formatter={(value: any) => [
                    `${value.toLocaleString()} events`,
                    "Volume",
                  ]}
                />
                <Bar dataKey="volume" radius={[4, 4, 0, 0]} barSize={55}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-[#252940] grid grid-cols-3 gap-2 text-center">
          {data.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <span className="text-[10px] text-white/40 uppercase tracking-wide truncate max-w-full font-mono">
                {item.name}
              </span>
              <span className="text-sm font-bold mt-0.5 text-white/90 font-mono tracking-tight">
                {item.volume.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
