import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChevronRight, Play, ChevronDown, Radio, Sparkles } from "lucide-react";
import { useTelemetryInjection } from "../context/TelemetryToastContext";

interface HeaderProps {
  onSidebarToggle?: () => void;
  isSidebarCollapsed?: boolean;
}

export default function Header({ onSidebarToggle, isSidebarCollapsed }: HeaderProps) {
  const { user, organizations, currentOrg, setCurrentOrg, logout } = useAuth();
  const { setToast } = useTelemetryInjection();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Dropdown / Popover States
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [isFilterActive, setIsFilterActive] = useState(true);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith("/monitor")) return "Live Monitor";
    if (path.startsWith("/incidents")) {
      if (path.includes("/incidents/")) {
        return "Incident Detail";
      }
      return "Active Incidents Feed";
    }
    if (path.startsWith("/demo")) return "Demo Simulator Workbench";
    if (path.startsWith("/rules")) return "Suppression Rules";
    if (path.startsWith("/settings")) return "Suppression Rules";
    return "Dashboard";
  };

  return (
    <header className="h-14 border-b border-zinc-800/85 bg-[#121215] shrink-0 flex items-center justify-between px-6 z-10 font-sans">
      {/* Left side: Sidebar toggle & Breadcrumbs */}
      <div className="flex items-center gap-4">
        {isSidebarCollapsed && (
          <button
            onClick={onSidebarToggle}
            className="text-zinc-400 hover:text-white transition text-xs border border-zinc-800 p-1.5 rounded bg-zinc-900/60 cursor-pointer flex items-center justify-center"
            title="Expand Navigation"
          >
            <Play className="w-3 h-3 fill-current" />
          </button>
        )}

        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
          <span className="hover:text-zinc-200 cursor-pointer transition">Telemetry</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
          <span className="hover:text-zinc-200 cursor-pointer transition">{currentOrg?.name || "Evaluator Organization"}</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
          <span className="text-emerald-400 font-bold">{getPageTitle()}</span>
        </div>
      </div>

      {/* Right side: Popover controls for Live Filtering, Org Scope Selector, and Profile */}
      <div className="flex items-center gap-3">
        
        {/* 1. Live Filtering Popover */}
        <div className="relative">
          <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            className="flex items-center gap-1.5 bg-zinc-900/60 hover:bg-[#18181b] border border-zinc-800/80 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-emerald-400 font-mono tracking-tight shadow-sm cursor-pointer select-none"
          >
            <Radio className={`w-2.5 h-2.5 shrink-0 ${isFilterActive ? "text-emerald-400 animate-pulse" : "text-amber-450 animate-none"}`} />
            <span>Live Filtering: {isFilterActive ? "ACTIVE" : "PAUSED"}</span>
          </button>

          {filterDropdownOpen && (
            <>
              <div className="fixed inset-0 z-20 cursor-default" onClick={() => setFilterDropdownOpen(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-[#121215]/95 border border-zinc-800 rounded-lg shadow-xl p-4.5 z-30 font-sans backdrop-blur-md text-left text-zinc-300">
                <div className="font-bold text-white text-xs border-b border-zinc-900 pb-2 mb-2 flex items-center justify-between">
                  <span>AI Telemetry Processor</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold ${
                    isFilterActive 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    {isFilterActive ? "RUNNING" : "PAUSED"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between my-3 text-xs">
                  <span className="text-zinc-400">Processor status</span>
                  <button
                    onClick={() => {
                      setIsFilterActive(!isFilterActive);
                      setToast({
                        type: "success",
                        message: `Telemetry Highway: ${!isFilterActive ? "Active" : "Paused"}`,
                        sub: `Anomaly pipeline has been ${!isFilterActive ? "successfully resumed" : "paused for triage"}.`,
                        icon: "⚙"
                      });
                      setTimeout(() => setToast(null), 3000);
                    }}
                    className={`px-2.5 py-1 font-bold text-[10px] rounded transition cursor-pointer ${
                      isFilterActive 
                        ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20" 
                        : "bg-[#A3E635]/15 text-emerald-450 hover:bg-[#A3E635]/25 border border-[#A3E635]/20"
                    }`}
                  >
                    {isFilterActive ? "Pause Engine" : "Resume Engine"}
                  </button>
                </div>
                
                <div className="border-t border-zinc-900/60 pt-2 space-y-1.5 text-[10px] font-mono text-zinc-400">
                  <div className="flex justify-between"><span>SSE Stream:</span><span className="text-emerald-400 font-bold">CONNECTED</span></div>
                  <div className="flex justify-between"><span>Engine Cluster:</span><span>gptrace-v2</span></div>
                  <div className="flex justify-between"><span>Active Rules:</span><span>4 active</span></div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 2. Scope Selector Popover */}
        {organizations.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setScopeDropdownOpen(!scopeDropdownOpen)}
              className="flex items-center gap-2 bg-zinc-900/60 hover:bg-[#18181b] border border-zinc-800/80 rounded-md px-2.5 py-1.5 text-xs text-white/85 transition cursor-pointer shadow-sm font-mono"
            >
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Scope:</span>
              <span className="font-bold text-[#A3E635]">{currentOrg?.name || "Evaluator Organization"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/40" />
            </button>

            {scopeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-20 cursor-default" onClick={() => setScopeDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-[#121215]/95 border border-zinc-800 rounded-lg shadow-xl py-1 z-30 font-sans backdrop-blur-md">
                  <div className="px-3 py-1.5 border-b border-zinc-900 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Select Scope
                  </div>
                  {organizations.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setCurrentOrg(o);
                        setScopeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between ${
                        currentOrg?.id === o.id
                          ? "bg-[#A3E635]/15 text-[#A3E635] font-bold border-l-2 border-[#A3E635]"
                          : "text-zinc-300 hover:bg-[#18181b] hover:text-white"
                      }`}
                    >
                      <span>{o.name}</span>
                      {currentOrg?.id === o.id && <span className="text-[8px] font-mono font-bold bg-[#A3E635]/25 text-[#A3E635] px-1.5 py-0.2 rounded border border-[#A3E635]/20">Active</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. User Badge (User Profile Dropdown) */}
        <div className="relative">
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 rounded-md px-2.5 py-1.5 text-xs text-white/85 transition cursor-pointer shadow-sm"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 flex items-center justify-center font-bold text-white text-[10px]">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="hidden sm:inline font-mono text-[11px] font-medium">{user?.full_name || "Guest Evaluator"}</span>
            <ChevronDown className="w-3 h-3 text-white/40" />
          </button>

          {profileDropdownOpen && (
            <>
              {/* Overlay backdrop to close dropdown */}
              <div 
                className="fixed inset-0 z-20 cursor-default" 
                onClick={() => setProfileDropdownOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-48 bg-[#121215]/95 border border-zinc-800 rounded-lg shadow-xl py-1 z-30 font-sans backdrop-blur-md">
                <div className="px-4 py-2 border-b border-zinc-900 text-left">
                  <div className="text-xs text-white font-semibold truncate">{user?.full_name || "Guest Evaluator"}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{user?.email || "evaluator@local.host"}</div>
                </div>
                <Link
                  to="/"
                  className="block px-4 py-2 text-xs text-white/80 hover:bg-[#18181b] hover:text-white transition text-left"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  Landing Page
                </Link>
                <a
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 text-xs text-white/80 hover:bg-[#18181b] hover:text-white transition text-left"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  API Documentation
                </a>
                <div className="border-t border-zinc-900 my-1" />
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    logout();
                    navigate("/");
                  }}
                  className="block w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
