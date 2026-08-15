import React, { useEffect, useRef, useState } from "react";
import { useTelemetryInjection } from "../context/TelemetryToastContext";

export default function TelemetryTerminal() {
  const { logs, clearLogs } = useTelemetryInjection();
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const formatLogLine = (line: string, index: number) => {
    const timeStr = `[${new Date().toLocaleTimeString()}]`;
    
    if (line.startsWith("[INIT]")) {
      return (
        <div key={index} className="text-zinc-300 leading-relaxed py-0.5 whitespace-pre-wrap">
          <span className="text-zinc-650 mr-2 font-mono select-none">{timeStr}</span>
          <span className="text-cyan-400 font-bold mr-1.5 font-mono select-none">[INIT]</span>
          <span className="text-zinc-200">{line.replace("[INIT]", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[STREAM]")) {
      return (
        <div key={index} className="text-zinc-300 leading-relaxed py-0.5 whitespace-pre-wrap">
          <span className="text-zinc-650 mr-2 font-mono select-none">{timeStr}</span>
          <span className="text-emerald-400 font-bold mr-1.5 font-mono select-none">[STREAM]</span>
          <span className="text-zinc-200">{line.replace("[STREAM]", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[WARN]")) {
      return (
        <div key={index} className="text-zinc-300 leading-relaxed py-0.5 whitespace-pre-wrap">
          <span className="text-zinc-650 mr-2 font-mono select-none">{timeStr}</span>
          <span className="text-amber-400 font-bold mr-1.5 font-mono select-none">[WARN]</span>
          <span className="text-zinc-200">{line.replace("[WARN]", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[SUPPRESS]")) {
      return (
        <div key={index} className="text-zinc-300 leading-relaxed py-0.5 whitespace-pre-wrap">
          <span className="text-zinc-650 mr-2 font-mono select-none">{timeStr}</span>
          <span className="text-violet-400 font-bold mr-1.5 font-mono select-none">[SUPPRESS]</span>
          <span className="text-zinc-200">{line.replace("[SUPPRESS]", "")}</span>
        </div>
      );
    }
    if (line.startsWith("[DONE]")) {
      return (
        <div key={index} className="text-zinc-200 leading-relaxed py-0.5 whitespace-pre-wrap">
          <span className="text-zinc-650 mr-2 font-mono select-none">{timeStr}</span>
          <span className="text-green-400 font-bold mr-1.5 font-mono select-none">[DONE] ✔</span>
          <span className="text-zinc-100 font-semibold">{line.replace("[DONE]", "").replace("✔", "")}</span>
        </div>
      );
    }
    
    return (
      <div key={index} className="text-zinc-400 leading-relaxed py-0.5 whitespace-pre-wrap">
        <span className="text-zinc-650 mr-2 font-mono select-none">{timeStr}</span>
        <span>{line}</span>
      </div>
    );
  };

  return (
    <div className="w-full bg-black/90 border border-zinc-800/90 rounded-xl p-4 font-mono text-xs shadow-2xl flex flex-col gap-2">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-zinc-900 pb-2 mb-1 text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span>[TELEMETRY HIGHWAY REAL-TIME INGESTION LOGS]</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Scroll Lock Toggle */}
          <button 
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-0.5 border rounded text-[9px] transition cursor-pointer select-none ${
              autoScroll 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold" 
                : "bg-zinc-900 text-zinc-400 border-zinc-800"
            }`}
          >
            {autoScroll ? "Scroll Lock: ON" : "Scroll Lock: OFF"}
          </button>
          
          {/* Clear Buffer */}
          <button 
            onClick={clearLogs}
            className="px-2 py-0.5 border border-zinc-800 rounded bg-[#121215] text-[9px] hover:text-white hover:border-zinc-700 transition cursor-pointer select-none"
          >
            Clear Buffer
          </button>
        </div>
      </div>
      
      {/* Logs Scroll container */}
      <div 
        ref={containerRef}
        className="flex flex-col gap-1 max-h-64 overflow-y-auto font-mono scrollbar-thin scrollbar-thumb-zinc-800 pr-1 text-left"
      >
        {logs.length === 0 ? (
          <div className="text-zinc-650 italic py-2">
            &gt;&gt; Terminal idle. Run quick injections or simulation scenarios to pipe log payloads.
          </div>
        ) : (
          logs.slice(-500).map((log, idx) => formatLogLine(log, idx))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
