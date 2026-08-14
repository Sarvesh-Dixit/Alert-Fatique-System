import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

interface BaselineComparisonChartProps {
  eventsReceived: number;
  potentialAlerts: number;
  actualNotifications: number;
  noiseReductionRatio: number;
}

export default function BaselineComparisonChart({
  eventsReceived,
  potentialAlerts,
  actualNotifications,
  noiseReductionRatio,
}: BaselineComparisonChartProps) {
  // Generate a realistic trend over time based on current aggregate metrics
  const generateComparisonHistory = () => {
    return Array.from({ length: 10 }, (_, i) => {
      const factor = i === 3 || i === 4 ? 3.8 : i === 5 ? 2.1 : 1.0;
      const raw = Math.floor((eventsReceived / 10) * factor);
      const rule = Math.floor((potentialAlerts / 10) * factor);
      const ai = Math.floor((actualNotifications / 10) * factor);
      return {
        time: `${10 - i}m ago`,
        "Raw Untuned": raw,
        "Rule-Based String": rule,
        "AI Semantic Vector": ai,
      };
    });
  };

  const chartData = generateComparisonHistory();

  return (
    <div className="card backdrop-blur-md bg-opacity-70 border border-borderDark shadow-2xl p-6 flex flex-col justify-between h-full bg-[#161928]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Baseline Comparison</h3>
          <p className="text-white/40 text-xs">Alert volume reduction: Raw vs. Rule-Based vs. AI Engine</p>
        </div>
        <div className="flex items-center gap-2 bg-signal/10 border border-signal/30 px-3 py-1 rounded-full shrink-0 font-mono text-xs">
          <span className="text-white/60">NRR</span>
          <span className="text-signalSoft font-extrabold">{noiseReductionRatio}%</span>
        </div>
      </div>

      <div className="flex-1 min-h-[220px]">
        {eventsReceived === 0 && potentialAlerts === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-center text-white/30 text-sm italic">
            Waiting for telemetry simulation to populate metrics...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRaw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRule" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A3E635" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#A3E635" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#252940" vertical={false} />
              <XAxis 
                dataKey="time" 
                stroke="#64748b" 
                tick={{ fill: "#64748b", fontSize: 11 }} 
                axisLine={{ stroke: "#252940" }}
                tickLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                tick={{ fill: "#64748b", fontSize: 11 }} 
                axisLine={{ stroke: "#252940" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#141724",
                  borderColor: "#252940",
                  borderRadius: "8px",
                  color: "#f8fafc",
                }}
              />
              <Legend 
                iconType="square" 
                wrapperStyle={{ paddingTop: "15px", fontSize: "11px", color: "#94a3b8" }}
              />
              <Area 
                type="monotone" 
                dataKey="Raw Untuned" 
                stroke="#00f0ff" 
                fillOpacity={1} 
                fill="url(#colorRaw)" 
                strokeWidth={2} 
              />
              <Area 
                type="monotone" 
                dataKey="Rule-Based String" 
                stroke="#f59e0b" 
                fillOpacity={1} 
                fill="url(#colorRule)" 
                strokeWidth={2} 
              />
              <Area 
                type="monotone" 
                dataKey="AI Semantic Vector" 
                stroke="#A3E635" 
                fillOpacity={1} 
                fill="url(#colorAI)" 
                strokeWidth={2.4} 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-borderDark grid grid-cols-3 gap-2 text-center">
        {[
          { name: "Raw Volume", val: eventsReceived, col: "text-neonCyan" },
          { name: "Rule-Based", val: potentialAlerts, col: "text-neonYellow" },
          { name: "AI Semantic", val: actualNotifications, col: "text-signalSoft" },
        ].map((item, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <span className="text-[10px] text-white/40 uppercase tracking-wide truncate max-w-full font-mono">
              {item.name}
            </span>
            <span className={`text-sm font-bold mt-0.5 ${item.col} font-mono`}>
              {item.val.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
