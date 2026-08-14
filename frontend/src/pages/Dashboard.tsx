import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api, type Incident, type NoiseReductionKPIs, type CooldownState } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useIncidentStream } from "../hooks/useIncidentStream";
import { SeverityBadge, StatusBadge, fmtTime } from "../ui";
import CooldownMatrix from "../components/CooldownMatrix";
import BaselineComparisonChart from "../components/BaselineComparisonChart";
import DemoSimulator from "../components/DemoSimulator";
import { Clock, Activity, ShieldAlert, Zap, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { currentOrg } = useAuth();
  const [kpis, setKpis] = useState<NoiseReductionKPIs | null>(null);
  const [cooldowns, setCooldowns] = useState<CooldownState[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);

  // Category Collapsibility State
  const [cat1Open, setCat1Open] = useState(true);
  const [cat2Open, setCat2Open] = useState(true);
  const [cat3Open, setCat3Open] = useState(true);
  const [incidentsOpen, setIncidentsOpen] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const [k, cds, inc] = await Promise.all([
      api.get<NoiseReductionKPIs>(`/organizations/${currentOrg.id}/kpis`),
      api.get<CooldownState[]>(`/organizations/${currentOrg.id}/cooldown-matrix`),
      api.get<Incident[]>(`/organizations/${currentOrg.id}/incidents?status=OPEN&limit=8`),
    ]);
    setKpis(k);
    setCooldowns(cds);
    setIncidents(inc);
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  // Connect to real-time SSE updates
  // Connect to real-time SSE updates
  useIncidentStream(currentOrg?.id, load, {
    isSimulationRunning,
    onEvent: (event) => {
      if (event.type === "cooldown_update") {
        const updatedCd = event.data;
        setCooldowns((prev) => {
          const exists = prev.some((c) => c.incident_id === updatedCd.incident_id);
          if (exists) {
            return prev.map((c) => (c.incident_id === updatedCd.incident_id ? updatedCd : c));
          } else {
            return [updatedCd, ...prev];
          }
        });
      } else if (
        event.type === "incident_updated" ||
        event.type === "incident_created" ||
        event.type === "suppression_active"
      ) {
        load();
      }
    }
  });

  const formatMetric = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  // Generate step data representing raw vs suppressed alerts over time
  const generateSpikeChartData = () => {
    if (!kpis) return [];
    const events = kpis.events_received ?? 0;
    const suppressed = kpis.events_suppressed ?? 0;
    const notifications = kpis.notifications_sent ?? 0;

    const baseRaw = Math.max(10, Math.floor(events / 10));
    const baseSuppressed = Math.max(5, Math.floor(suppressed / 10));
    const baseNotifs = Math.max(1, Math.floor(notifications / 10));

    return Array.from({ length: 10 }, (_, i) => {
      const isSpike = i === 4 || i === 5;
      const isSubside = i === 6 || i === 7;
      const multiplier = isSpike ? 4.5 : isSubside ? 2.2 : 1.0;

      return {
        time: `${10 - i}m ago`,
        "Raw Volume": Math.floor(baseRaw * multiplier),
        "Suppressed": Math.floor(baseSuppressed * (isSpike || isSubside ? multiplier * 1.2 : 1.0)),
        "Notifications": isSpike ? baseNotifs * 3 : baseNotifs,
      };
    });
  };

  const spikeData = generateSpikeChartData();

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Telemetry Simulator Quick-Controls Banner */}
      <DemoSimulator onScenarioTriggered={load} onSimulationStateChange={setIsSimulationRunning} />

      {/* Category 1: Executive Overview & Noise Reduction */}
      <div className="flex flex-col gap-3">
        <div 
          onClick={() => setCat1Open(!cat1Open)} 
          className="flex items-center justify-between border-b border-[#252940] pb-2 cursor-pointer hover:text-white transition group"
        >
          <h2 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
            <span>{cat1Open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</span>
            <span>Executive Overview & Noise Reduction</span>
          </h2>
          <span className="text-[10px] bg-[#727DA1]/15 text-white/40 group-hover:text-white px-2 py-0.5 rounded-full font-mono font-semibold">
            3 metrics & charts
          </span>
        </div>

        {cat1Open && (
          <div className="flex flex-col gap-6">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Raw Events */}
              <div className="card border border-[#252940] bg-[#161928] p-5 flex flex-col justify-between h-[120px] hover:scale-[1.01] transition-transform duration-200">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Raw Events Ingested</span>
                <span className="text-3xl font-semibold font-mono tracking-tight text-white mt-1">
                  {kpis ? formatMetric(kpis.events_received) : "0"}
                </span>
                <span className="text-[10px] text-white/30 font-mono tracking-tight">Total ingress logs</span>
              </div>

              {/* Card 2: Actionable Incidents */}
              <div className="card border border-[#252940] bg-[#161928] p-5 flex flex-col justify-between h-[120px] hover:scale-[1.01] transition-transform duration-200">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Actionable Incidents</span>
                <span className="text-3xl font-semibold font-mono tracking-tight text-rose-400 mt-1">
                  {kpis ? formatMetric(kpis.active_incidents) : "0"}
                </span>
                <span className="text-[10px] text-white/30 font-mono tracking-tight">Open issues thread</span>
              </div>

              {/* Card 3: Outbound Alerts */}
              <div className="card border border-[#252940] bg-[#161928] p-5 flex flex-col justify-between h-[120px] hover:scale-[1.01] transition-transform duration-200">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Outbound Alerts</span>
                <span className="text-3xl font-semibold font-mono tracking-tight text-amber-400 mt-1">
                  {kpis ? formatMetric(kpis.notifications_sent) : "0"}
                </span>
                <span className="text-[10px] text-white/30 font-mono tracking-tight">Dispatched webhooks</span>
              </div>

              {/* Card 4: Noise Reduction Ratio */}
              <div className="card border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.05)] p-5 flex flex-col justify-between h-[120px] hover:scale-[1.01] transition-transform duration-200 relative overflow-hidden">
                <span className="text-[10px] font-bold uppercase tracking-wider">Noise Reduction</span>
                <span className="text-3xl font-semibold font-mono tracking-tight">
                  {kpis ? `${kpis.noise_reduction_ratio}%` : "0%"}
                </span>
                {/* Live Status indicator pill */}
                <div className="flex items-center gap-1.5 mt-0.5 bg-[#0B0C14]/50 border border-emerald-500/20 px-2 py-0.5 rounded-full w-fit">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[8px] font-bold font-mono tracking-widest text-emerald-400 uppercase">ACTIVE FILTERING ENGINE</span>
                </div>
              </div>
            </div>

            {/* Spike Chart Panel */}
            <div className="card bg-[#161928] border border-[#252940] p-5 flex flex-col justify-between h-[240px]">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Signal vs Noise Spike Chart</h3>
                  <p className="text-[10px] text-white/40">Alert rate spikes collapsing under automated cooldown suppression</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-white/50">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-[#00f0ff]" />
                    <span>Raw Vol</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-[#10b981]" />
                    <span>Suppressed</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                {spikeData.length === 0 ? (
                  <div className="text-xs text-white/30 italic text-center py-16">Waiting for telemetry...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={spikeData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#252940" vertical={false} />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#252940' }} />
                      <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={{ stroke: '#252940' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#141724', borderColor: '#252940', borderRadius: '8px', color: '#f8fafc', fontSize: '11px', fontFamily: 'JetBrains Mono' }} />
                      <Line type="stepAfter" dataKey="Raw Volume" stroke="#00f0ff" strokeWidth={2} dot={false} name="Raw" />
                      <Line type="stepAfter" dataKey="Suppressed" stroke="#10b981" strokeWidth={2} dot={false} name="Suppressed" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category 2: Automated Cooldown Matrix & Active Suppression */}
      <div className="flex flex-col gap-3">
        <div 
          onClick={() => setCat2Open(!cat2Open)} 
          className="flex items-center justify-between border-b border-[#252940] pb-2 cursor-pointer hover:text-white transition group"
        >
          <h2 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
            <span>{cat2Open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Automated Cooldown Matrix & Active Suppression</span>
            </span>
          </h2>
          <span className="text-[10px] bg-[#727DA1]/15 text-white/40 group-hover:text-white px-2 py-0.5 rounded-full font-mono font-semibold">
            4 severity tiers
          </span>
        </div>

        {cat2Open && (
          <CooldownMatrix cooldowns={cooldowns} />
        )}
      </div>

      {/* Category 3: AI Semantic Clustering & Baseline Comparison */}
      <div className="flex flex-col gap-3">
        <div 
          onClick={() => setCat3Open(!cat3Open)} 
          className="flex items-center justify-between border-b border-[#252940] pb-2 cursor-pointer hover:text-white transition group"
        >
          <h2 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
            <span>{cat3Open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</span>
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>AI Semantic Clustering & Baseline Comparison</span>
            </span>
          </h2>
          <span className="text-[10px] bg-[#727DA1]/15 text-white/40 group-hover:text-white px-2 py-0.5 rounded-full font-mono font-semibold">
            2 chart comparisons
          </span>
        </div>

        {cat3Open && (
          <div className="grid grid-cols-1 gap-6">
            <BaselineComparisonChart
              eventsReceived={kpis?.events_received ?? 0}
              potentialAlerts={kpis?.naive_notifications ?? 0}
              actualNotifications={kpis?.notifications_sent ?? 0}
              noiseReductionRatio={kpis?.noise_reduction_ratio ?? 0}
            />
          </div>
        )}
      </div>

      {/* Active Incidents List */}
      <div className="flex flex-col gap-3">
        <div 
          onClick={() => setIncidentsOpen(!incidentsOpen)} 
          className="flex items-center justify-between border-b border-[#252940] pb-2 cursor-pointer hover:text-white transition group"
        >
          <h2 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
            <span>{incidentsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</span>
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Active Incidents List</span>
            </span>
          </h2>
          <span className="text-[10px] bg-[#727DA1]/15 text-white/40 group-hover:text-white px-2 py-0.5 rounded-full font-mono font-semibold">
            {incidents.length} open issues
          </span>
        </div>

        {incidentsOpen && (
          <div className="card bg-[#161928] border border-[#252940]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-white text-sm">Active Incidents</div>
                <p className="text-white/40 text-[11px]">Currently open operational alerts requiring action</p>
              </div>
              <Link to="/incidents" className="text-cyan-400 text-xs hover:underline flex items-center gap-1 font-semibold">
                <span>View all incidents</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {incidents.length === 0 ? (
              <div className="text-white/40 text-xs py-8 text-center italic">No active incidents — all clear.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-white/40 border-b border-[#252940]/60 text-[10px] uppercase tracking-wider font-mono">
                      <th className="pb-2">Severity</th>
                      <th className="pb-2">Title</th>
                      <th className="pb-2 text-right">Event Count</th>
                      <th className="pb-2 text-center">Status</th>
                      <th className="pb-2 text-right">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((i) => (
                      <tr key={i.id} className="border-b border-[#252940]/40 hover:bg-white/[0.01] transition-all">
                        <td className="py-2.5"><SeverityBadge severity={i.severity} /></td>
                        <td className="py-2.5 font-medium text-white/90">
                          <Link to={`/incidents/${i.id}`} className="hover:text-cyan-400 transition">{i.title}</Link>
                        </td>
                        <td className="text-white/70 py-2.5 text-right font-mono tracking-tight">{i.event_count}</td>
                        <td className="py-2.5 text-center"><StatusBadge status={i.status} /></td>
                        <td className="text-white/40 py-2.5 text-right whitespace-nowrap font-mono tracking-tight">{fmtTime(i.last_seen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
