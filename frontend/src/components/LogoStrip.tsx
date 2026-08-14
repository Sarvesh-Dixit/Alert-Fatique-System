import {
  Bell,
  Code2,
  Cpu,
  Database,
  Globe,
  Layers,
  MessageSquare,
  Server,
} from "lucide-react";

/**
 * Compatibility strip shown on the landing page.
 * Icons are generic glyphs — no third-party trademarked logos are shipped.
 * Every icon here is one already proven to exist in the installed lucide-react.
 */
const items = [
  { icon: MessageSquare, label: "Slack" },
  { icon: Bell, label: "Discord" },
  { icon: Layers, label: "Docker" },
  { icon: Server, label: "Kubernetes" },
  { icon: Code2, label: "GitOps" },
  { icon: Database, label: "OpenTelemetry" },
  { icon: Cpu, label: "Prometheus" },
  { icon: Globe, label: "Any Cloud" },
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
