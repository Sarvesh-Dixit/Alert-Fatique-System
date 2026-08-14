import React from "react";
import { Terminal, GitMerge, BellRing } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    n: "01",
    icon: Terminal,
    title: "Point your telemetry at the proxy",
    desc:
      "Drop-in OpenTelemetry / syslog / HTTP endpoint. One env var change on your existing collector — no SDK rewrite required.",
    code: "OTEL_EXPORTER_OTLP_ENDPOINT=\n  https://ingest.your-highway.dev",
  },
  {
    n: "02",
    icon: GitMerge,
    title: "GPTrace clusters the noise",
    desc:
      "Vector embeddings + cosine similarity fold thousands of near-duplicate stack traces into a single incident thread with a stable fingerprint.",
    code: "cluster.match(similarity ≥ 0.88)\n→ incident #1024 (+499 suppressed)",
  },
  {
    n: "03",
    icon: BellRing,
    title: "Ship one clean alert",
    desc:
      "The cooldown matrix picks the right channel, formats a summary with actions, and holds back the rest until the storm passes.",
    code: "POST /webhooks/slack\n  1 message · 499 muted · cd 4:12",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 px-6 max-w-6xl mx-auto flex flex-col gap-12 border-t border-[#727DA1]/10 relative z-10"
    >
      <div className="text-center flex flex-col gap-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-neonCyan">
          How it works
        </span>
        <h2 className="text-2xl font-black text-white uppercase tracking-wider">
          From pager storm to signal in three steps
        </h2>
        <p className="text-white/40 text-xs">
          Sit between your collectors and your on-call channels. That's it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="relative bg-[#0F101A] border border-[#939DB8]/10 rounded-xl p-6 flex flex-col gap-4 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(56,189,248,0.08)] transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#646E87] tracking-widest">
                  STEP {step.n}
                </span>
                <div className="w-9 h-9 rounded-lg bg-[#7C87F7]/10 flex items-center justify-center border border-[#7C87F7]/25 text-[#7C87F7]">
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <h3 className="text-white font-bold text-sm leading-snug">
                {step.title}
              </h3>
              <p className="text-[#C9D3EE]/70 text-xs leading-relaxed">
                {step.desc}
              </p>

              <pre className="mt-1 bg-[#0a0c14] border border-[#23293e] rounded-lg p-3 text-[10px] font-mono text-emerald-300/90 whitespace-pre-wrap leading-relaxed">
                {step.code}
              </pre>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
