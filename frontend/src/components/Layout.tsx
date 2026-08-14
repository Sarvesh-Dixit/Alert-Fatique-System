import React, { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Header from "./Header";
import {
  Folder,
  Terminal,
  Activity,
  BarChart3,
  ShieldAlert,
  Unplug,
  Cpu,
  Zap,
  Radio,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronDown,
  ChevronRight
} from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(true);

  const activeClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
      isActive
        ? "bg-signal/10 text-signal border-l-2 border-signal shadow-sm"
        : "text-white/65 hover:bg-white/5 hover:text-white"
    }`;

  const activeSubClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-[11px] font-medium transition ${
      isActive ? "text-signal font-bold" : "text-white/40 hover:text-white hover:bg-white/5"
    }`;

  return (
    <div className="h-screen flex bg-[#0B0C14] text-white/90 font-sans overflow-hidden">
      {/* 1. Far-Left Slim Icon Strip */}
      <aside className="w-16 shrink-0 bg-[#0B0C14] border-r border-[#252940] flex flex-col items-center py-4 justify-between">
        {/* Brand Logo */}
        <div 
          className="cursor-pointer hover:scale-110 transition-transform" 
          onClick={() => navigate("/")}
        >
          <Radio className="w-6 h-6 text-signal animate-pulse" />
        </div>

        {/* System Icons (Bottom) */}
        <div className="flex flex-col gap-6 text-white/40">
          <button 
            className="hover:text-signal transition cursor-pointer" 
            title="System Rules & Settings" 
            onClick={() => navigate("/rules")}
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            className="hover:text-rose-500 transition cursor-pointer" 
            title="Sign Out" 
            onClick={() => { logout(); navigate("/"); }}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* 2. Main Navigation Sidebar */}
      <aside 
        className={`${
          collapsed ? "w-0 overflow-hidden border-none" : "w-60"
        } shrink-0 bg-[#0F101A] border-r border-[#252940] flex flex-col transition-all duration-300`}
      >
        <div className="p-4 flex items-center justify-between border-[#252940] h-14 shrink-0 border-b">
          <div 
            className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => navigate("/")}
          >
            <span className="text-xs font-bold tracking-wider text-white">Telemetry Highway</span>
            <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono">Phase 3 · Production</span>
          </div>
          <button 
            className="text-white/40 hover:text-white transition cursor-pointer"
            onClick={() => setCollapsed(true)}
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {/* Live Monitor */}
          <NavLink
            to="/monitor"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Radio className="w-4 h-4 text-emerald-450 animate-pulse" />
            <span className="flex-1 text-[#A3E635]">Live Monitor</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          </NavLink>

          {/* Incidents Feed */}
          <NavLink 
            to="/incidents" 
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                isActive && location.pathname.startsWith("/incidents")
                  ? "bg-signal/10 text-signal border-l-2 border-signal shadow-sm"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Activity className="w-4 h-4" />
            <span>Incidents Feed</span>
          </NavLink>

          {/* Demo Simulator */}
          <NavLink to="/demo" className={activeClass}>
            <Zap className="w-4 h-4" />
            <span>Demo Simulator</span>
          </NavLink>

          {/* Rules */}
          <NavLink to="/rules" className={activeClass}>
            <Settings className="w-4 h-4" />
            <span>Rules</span>
          </NavLink>
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-[#252940] bg-[#0E101D]/50 shrink-0">
          <div className="text-[11px] text-white/50 truncate font-semibold">{user?.full_name}</div>
          <div className="text-[9px] text-white/30 truncate">{user?.email}</div>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <Header 
          onSidebarToggle={() => setCollapsed(false)} 
          isSidebarCollapsed={collapsed} 
        />

        {/* Child Screen Page Router Container */}
        <main className="flex-1 overflow-y-auto bg-[#0B0C14] p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
