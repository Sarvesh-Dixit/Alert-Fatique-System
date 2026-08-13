import React from "react";
import { Link } from "react-router-dom";
import { Radio } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#0B0C14] border-t border-[#727DA1]/15 py-12 px-6 font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
        {/* Brand Meta Column */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Radio className="w-4 h-4 text-[#7C87F7]" />
            <span>Telemetry Highway</span>
          </div>
          <p className="text-[#646E87] text-xs leading-relaxed">
            Intelligent Alert Fatigue Reducer. Collapsing telemetry noise into actionable SRE signals.
          </p>
        </div>

        {/* Links: Solutions */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider mb-1">Solutions</span>
          <Link to="/demo" className="text-[#C9D3EE] hover:text-white text-xs transition">AI SRE Pipeline</Link>
          <Link to="/dashboard" className="text-[#C9D3EE] hover:text-white text-xs transition">Cooldown Matrix</Link>
          <Link to="/demo" className="text-[#C9D3EE] hover:text-white text-xs transition">LogHub Replay</Link>
        </div>

        {/* Links: Integrations */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider mb-1">Integrations</span>
          <Link to="/integrations" className="text-[#C9D3EE] hover:text-white text-xs transition">Slack Webhooks</Link>
          <Link to="/integrations" className="text-[#C9D3EE] hover:text-white text-xs transition">Discord Channels</Link>
          <Link to="/integrations" className="text-[#C9D3EE] hover:text-white text-xs transition">OpenTelemetry Proxy</Link>
          <span className="text-[#646E87] text-xs">PagerDuty (Soon)</span>
        </div>

        {/* Links: Resources */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider mb-1">Resources</span>
          <Link to="/analytics" className="text-[#C9D3EE] hover:text-white text-xs transition">OpenAPI Docs</Link>
          <Link to="/dashboard" className="text-[#C9D3EE] hover:text-white text-xs transition">NRR Benchmarks</Link>
          <span className="text-[#646E87] text-xs">SRE Handbook</span>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="max-w-6xl mx-auto pt-6 border-t border-[#727DA1]/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center bg-[#171926]/40 border border-[#727DA1]/15 px-3 py-1 rounded-full text-[10px] font-mono font-bold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-2" />
          <span>Telemetry Highway Filtering Engine: 100% Operational</span>
        </div>
        <div className="text-[10px] text-[#646E87]">
          &copy; {new Date().getFullYear()} Telemetry Highway. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
