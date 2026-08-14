import { useState } from "react";
import { API_BASE } from "../api/client";

type Language = "node" | "python" | "curl";

interface Props {
  apiKey: string;
  service?: string;
  environment?: string;
}

/**
 * Ready-to-paste starter snippets shown right after an API key is generated.
 * Provides the exact code a developer needs to integrate their app — the API
 * key and endpoint are pre-filled from the current context.
 */
export default function StarterSnippets({
  apiKey,
  service = "my-app",
  environment = "production",
}: Props) {
  const [lang, setLang] = useState<Language>("node");
  const [copied, setCopied] = useState<string | null>(null);

  const snippets: Record<Language, { install: string; usage: string }> = {
    node: {
      install: `npm install @telemetry-highway/node`,
      usage: `import { Monitor } from "@telemetry-highway/node";

// Initialize once, at app startup.
export const monitor = new Monitor({
  apiKey: process.env.TELEMETRY_API_KEY ?? "${apiKey}",
  endpoint: process.env.TELEMETRY_ENDPOINT ?? "${API_BASE}",
  service: "${service}",
  environment: "${environment}",
});

// Log anywhere in your code — these calls never throw.
monitor.info("Application started");
monitor.warning("Slow database query", { duration_ms: 1240 });
monitor.error("Payment failed", { orderId: "ord_123" });

// Capture exceptions with a full stack trace.
try {
  await riskyThing();
} catch (err) {
  monitor.exception(err as Error);
}

// Optional: auto-log every HTTP request (Express).
// import { expressMiddleware } from "@telemetry-highway/node";
// app.use(expressMiddleware(monitor));`,
    },
    python: {
      install: `pip install telemetry-highway-sdk`,
      usage: `import os
from telemetry_sdk import Monitor

# Initialize once, at app startup.
monitor = Monitor(
    api_key=os.getenv("TELEMETRY_API_KEY", "${apiKey}"),
    endpoint=os.getenv("TELEMETRY_ENDPOINT", "${API_BASE}"),
    service="${service}",
    environment="${environment}",
)

# Log anywhere in your code — these calls never raise.
monitor.info("Application started")
monitor.warning("Slow database query", duration_ms=1240)
monitor.error("Payment failed", order_id="ord_123")

# Capture exceptions with a full stack trace.
try:
    risky_thing()
except Exception as exc:
    monitor.exception(exc)`,
    },
    curl: {
      install: `# No install needed — just call the ingestion endpoint over HTTPS.`,
      usage: `# Single event
curl -X POST "${API_BASE}/api/v1/telemetry" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "service": "${service}",
    "environment": "${environment}",
    "severity": "ERROR",
    "message": "Database connection timeout",
    "metadata": {"instance": "web-01"}
  }'

# Batch (up to 500 events per request)
curl -X POST "${API_BASE}/api/v1/telemetry/batch" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "events": [
      {"service": "${service}", "severity": "INFO",    "message": "startup"},
      {"service": "${service}", "severity": "WARNING", "message": "slow query"}
    ]
  }'`,
    },
  };

  const current = snippets[lang];

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="card mb-6 border border-[#252940] bg-[#161928]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-white/90">Starter code</div>
          <div className="text-xs text-white/40 mt-0.5">
            Paste this into your project — the API key and endpoint are pre-filled.
          </div>
        </div>
        <div className="flex gap-1 bg-[#0B0C14] p-1 rounded-lg border border-[#252940]">
          {(["node", "python", "curl"] as Language[]).map((l) => (
            <button
              key={l}
              className={`px-3 py-1 rounded-md text-xs font-mono transition ${
                lang === l ? "bg-[#252940] text-white" : "text-white/50 hover:text-white/80"
              }`}
              onClick={() => setLang(l)}
            >
              {l === "node" ? "Node.js" : l === "python" ? "Python" : "cURL"}
            </button>
          ))}
        </div>
      </div>

      {current.install && lang !== "curl" && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Install</div>
            <button
              className="text-[11px] text-white/50 hover:text-white/80"
              onClick={() => copy(current.install, "install")}
            >
              {copied === "install" ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="bg-[#0B0C14] border border-[#252940] p-3 rounded-lg overflow-x-auto text-xs font-mono">
            <code>{current.install}</code>
          </pre>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
            {lang === "curl" ? "Send an event" : "Usage"}
          </div>
          <button
            className="text-[11px] text-white/50 hover:text-white/80"
            onClick={() => copy(current.usage, "usage")}
          >
            {copied === "usage" ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="bg-[#0B0C14] border border-[#252940] p-3 rounded-lg overflow-x-auto text-xs font-mono max-h-[420px]">
          <code>{current.usage}</code>
        </pre>
      </div>

      <div className="text-[11px] text-white/40 mt-3 leading-relaxed">
        💡 <span className="text-white/60">Store the API key in an environment variable</span> (e.g.{" "}
        <code className="text-white/70">TELEMETRY_API_KEY</code>) instead of hardcoding it — the key is
        shown here exactly once.
      </div>
    </div>
  );
}
