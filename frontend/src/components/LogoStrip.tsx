import React from "react";
import {
  Boxes,
  Cloud,
  Container,
  Cpu,
  GitBranch,
  MessageCircle,
  Server,
  Slack,
} from "lucide-react";

/**
 * Compatibility strip shown on the landing page.
 * The icons are meant to communicate ecosystem coverage without using
 * third-party trademarked logos.
 */
const items = [
  { icon: Slack, label: "Slack" },
  { icon: MessageCircle, label: "Discord" },
  { icon: Container, label: "Docker" },
  { icon: Boxes, label: "Kubernetes" },
  { icon: GitBranch, label: "GitOps" },
  { icon: Server, label: "OpenTelemetry" },
  { icon: Cpu, label: "Prometheus" },
  { icon: Cloud, label: "Any Cloud" },
];

export default function LogoStrip() {
  return (
    <section
      aria-label="Compatible platforms"
      className="py-14 px-6 max-w-6xl mx-auto border-t border-[#727DA1]/10 flex flex-col items-center gap-8 relative z-10"
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#646E87]">
        Plugs into the stack you already run
      </p>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-6 w-full items-center">
        {items.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="group flex flex-col items-center gap-1.5 opacity-70 hover:opacity-100 transition"
            title={label}
          >
            <Icon className="w-6 h-6 text-[#C9D3EE] group-hover:text-neonCyan transition-colors" />
            <span className="text-[9px] font-mono text-[#646E87] group-hover:text-[#C9D3EE] transition-colors">
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
