import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, ChevronDown } from "lucide-react";

interface NavbarProps {
  onOpenAuth: () => void;
}

export default function Navbar({ onOpenAuth }: NavbarProps) {
  const navigate = useNavigate();
  const [platformOpen, setPlatformOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPlatformOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const hero = document.getElementById("hero");
    if (hero) {
      hero.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/");
    }
  };

  const scrollTo = (id: string) => {
    setPlatformOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[#0B0C14]/80 backdrop-blur-2xl border-b border-[#727DA1]/15 h-[52px] flex items-center justify-between px-6 font-sans">
      {/* Left side Logo + Nav Menus */}
      <div className="flex items-center gap-6">
        <a 
          href="/" 
          onClick={handleLogoClick} 
          className="flex items-center gap-2 text-white font-bold text-sm tracking-tight hover:opacity-90"
        >
          <Radio className="w-4 h-4 text-[#7C87F7] animate-pulse" />
          <span>Telemetry Highway</span>
        </a>

        <div className="hidden md:flex items-center gap-5 text-xs font-medium text-[#C9D3EE] relative">
          
          {/* Platform Dropdown */}
          <div ref={dropdownRef} className="relative">
            <button 
              onClick={() => setPlatformOpen(!platformOpen)}
              className="hover:text-white flex items-center gap-1 cursor-pointer py-2"
            >
              <span>Platform</span>
              <ChevronDown className={`w-3 h-3 text-white/40 transition-transform ${platformOpen ? "rotate-180" : ""}`} />
            </button>

            {platformOpen && (
              <div className="absolute top-[36px] left-0 bg-[#181926]/95 border border-[#1F2433] backdrop-blur-xl rounded-lg p-3 w-[260px] flex flex-col gap-1 shadow-2xl z-50">
                <button onClick={() => scrollTo("gptrace")} className="group flex flex-col gap-0.5 hover:bg-[#727DA1]/10 p-2 rounded-md transition text-left w-full cursor-pointer">
                  <span className="text-[11px] font-bold text-white group-hover:text-neonCyan">GPTrace Semantic Engine</span>
                  <span className="text-[9px] text-[#646E87]">Cosine similarity trace grouping</span>
                </button>
                <button onClick={() => scrollTo("cooldown")} className="group flex flex-col gap-0.5 hover:bg-[#727DA1]/10 p-2 rounded-md transition text-left w-full cursor-pointer">
                  <span className="text-[11px] font-bold text-white group-hover:text-neonCyan">Automated Cooldown Matrix</span>
                  <span className="text-[9px] text-[#646E87]">Cascading alert suppressor windows</span>
                </button>
                <button onClick={() => scrollTo("loghub")} className="group flex flex-col gap-0.5 hover:bg-[#727DA1]/10 p-2 rounded-md transition text-left w-full cursor-pointer">
                  <span className="text-[11px] font-bold text-white group-hover:text-neonCyan">LogHub Dataset Replay</span>
                  <span className="text-[9px] text-[#646E87]">Real HDFS production log streaming</span>
                </button>
                <button onClick={() => scrollTo("integrations")} className="group flex flex-col gap-0.5 hover:bg-[#727DA1]/10 p-2 rounded-md transition text-left w-full cursor-pointer">
                  <span className="text-[11px] font-bold text-white group-hover:text-neonCyan">Outbound Slack &amp; Discord</span>
                  <span className="text-[9px] text-[#646E87]">Clean webhook summaries &amp; alerts</span>
                </button>
              </div>
            )}
          </div>

          <button onClick={() => scrollTo("features")} className="hover:text-white cursor-pointer py-2">
            Features
          </button>
          
          <a 
            href="http://localhost:8000/docs" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-white py-2"
          >
            Docs
          </a>

          <button onClick={() => scrollTo("demo-simulator")} className="hover:text-white cursor-pointer py-2">
            Simulator
          </button>
        </div>
      </div>

      {/* Right side CTA Actions */}
      <div className="flex items-center gap-4 text-xs font-semibold">
        <button 
          onClick={onOpenAuth} 
          className="text-[#C9D3EE] hover:text-white transition cursor-pointer"
        >
          Sign in
        </button>
        <button
          onClick={onOpenAuth}
          className="bg-gradient-to-r from-[#98A4F7] to-[#5B63D3] text-white font-medium px-3.5 py-1.5 rounded-[6px] hover:opacity-90 transition cursor-pointer"
        >
          Try Demo / Start Free
        </button>
      </div>
    </nav>
  );
}
