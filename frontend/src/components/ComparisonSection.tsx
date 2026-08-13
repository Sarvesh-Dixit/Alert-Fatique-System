import React, { useState, useEffect } from "react";
import { AlertCircle, ShieldAlert, Sparkles, Clock } from "lucide-react";

export default function ComparisonSection() {
  const [countdown, setCountdown] = useState(254);

  // Countdown timer simulation for AI Cooldown preview
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : 300));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const formatMinSec = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <section className="py-16 px-6 max-w-6xl mx-auto font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: High impact SRE facts */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <h2 className="text-3xl font-black tracking-tight text-white leading-tight">
            Stop drowning in alerts. Run at a fraction of on-call fatigue.
          </h2>
          <p className="text-[#C9D3EE] text-sm leading-relaxed">
            Standard monitoring pipes dispatch notifications for every trace ID mismatch, microservice disconnect, and log variance. Telemetry Highway acts as a smart, lightning-fast proxy layer filtering out duplicated alert loops.
          </p>

          <div className="flex flex-col gap-4 mt-2">
            {[
              { val: "99.8% NRR", label: "Noise Reduction Ratio verified in production" },
              { val: "0 Spams", label: "Zero false-positive Slack page storms during outage bursts" },
              { val: "3ms Latency", label: "Ultralight inline telemetry proxy processing speed" },
            ].map((stat, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold bg-[#171926] border border-[#727DA1]/15 px-3 py-1 rounded text-[#7C87F7]">
                  {stat.val}
                </span>
                <span className="text-xs text-[#646E87] font-medium">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Comparative pricing-style card */}
        <div className="lg:col-span-7 bg-[#0F101A] border border-[#939DB8]/15 rounded-[26px] p-6 sm:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
          <div>
            <h3 className="text-white text-base font-bold">Inbound Volume Suppression Engine</h3>
            <p className="text-[#646E87] text-xs">Comparing alert flow fatigue per 10,000 application events</p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Row 1: Datadog Raw */}
            <div className="bg-[#171926]/40 border border-[#727DA1]/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Raw Alert Ingress (Datadog/NewRelic)</span>
                  <span className="text-[10px] text-[#646E87] mt-0.5">Dispatches paging notifications for every log stream match</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-mono font-bold text-rose-400">10,000 alerts/day</span>
                <p className="text-[9px] text-[#646E87] mt-0.5">High SRE Fatigue</p>
              </div>
            </div>

            {/* Row 2: Standard Rule-Based */}
            <div className="bg-[#171926]/40 border border-[#727DA1]/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Rule-Based Matcher (Alertmanager)</span>
                  <span className="text-[10px] text-[#646E87] mt-0.5">Groups strictly by string hash values and fixed regex rules</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-mono font-bold text-amber-400">~1,200 alerts/day</span>
                <p className="text-[9px] text-[#646E87] mt-0.5">Misses semantic variants</p>
              </div>
            </div>

            {/* Row 3: Telemetry Highway AI Engine */}
            <div className="bg-gradient-to-r from-[#98A4F7]/10 via-[#5B63D3]/5 to-transparent border border-[#7C87F7]/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(124,135,247,0.05)]">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-neonCyan shrink-0 mt-0.5 animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <span>Telemetry Highway (AI Semantic Engine)</span>
                    <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-mono uppercase tracking-widest px-2 py-0.5 rounded">GPTrace Active</span>
                  </span>
                  <span className="text-[10px] text-[#C9D3EE] mt-0.5">Similarity grouping (≥0.88 cosine) + cooldown suppression</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-mono font-black text-emerald-400">1 Incident Thread</span>
                <div className="flex items-center gap-1.5 justify-end mt-0.5 text-[#C9D3EE] text-[9px] font-mono bg-[#171926] px-2 py-0.5 rounded border border-[#727DA1]/15">
                  <Clock className="w-3 h-3 text-neonCyan animate-spin-slow" />
                  <span>Cooldown: {formatMinSec(countdown)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
