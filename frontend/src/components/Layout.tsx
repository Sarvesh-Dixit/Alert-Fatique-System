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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="h-screen flex bg-[#09090b] text-zinc-100 font-sans overflow-hidden relative">
      {/* Mobile Backdrop Overlay */}
      {mobileNavOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sleek Vertical Rail Sidebar: Slide-over drawer on mobile, static rail on desktop */}
      <aside 
        className={`
          fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0c0c0e] border-r border-zinc-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out shrink-0
          md:relative md:translate-x-0 md:z-auto h-full
          ${mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${collapsed ? "md:w-0 md:overflow-hidden md:border-none" : "md:w-64"}
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between border-b border-zinc-800 h-14 shrink-0">
          <div 
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => { navigate("/"); setMobileNavOpen(false); }}
          >
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-wider text-white">Telemetry Highway</span>
              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 mt-0.5 self-start uppercase font-mono tracking-widest font-bold">
                Phase 3 • Production
              </span>
            </div>
          </div>
          <button 
            className="hidden md:block text-zinc-500 hover:text-white transition cursor-pointer"
            onClick={() => setCollapsed(true)}
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 p-3 flex flex-col gap-1.5 overflow-y-auto">
          {/* Live Monitor */}
          <NavLink
            to="/monitor"
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition border duration-150 ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border-l-4 border-l-emerald-500 shadow-sm"
                  : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              }`
            }
          >
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="flex-1">Live Monitor</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          </NavLink>

          {/* Active Incidents */}
          <NavLink 
            to="/incidents" 
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition border duration-150 ${
                isActive && location.pathname.startsWith("/incidents")
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border-l-4 border-l-emerald-500 shadow-sm"
                  : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              }`
            }
          >
            <Activity className="w-4 h-4" />
            <span>Active Incidents</span>
          </NavLink>

          {/* Demo Simulator */}
          <NavLink 
            to="/demo" 
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition border duration-150 ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border-l-4 border-l-emerald-500 shadow-sm"
                  : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              }`
            }
          >
            <Zap className="w-4 h-4" />
            <span>Demo Simulator</span>
          </NavLink>

          {/* Suppression Rules */}
          <NavLink 
            to="/rules" 
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition border duration-150 ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border-l-4 border-l-emerald-500 shadow-sm"
                  : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              }`
            }
          >
            <Settings className="w-4 h-4" />
            <span>Suppression Rules</span>
          </NavLink>
        </nav>

        {/* Minimalist Profile Footer Pinned Cleanly to Bottom */}
        <div className="p-4 border-t border-zinc-800 bg-[#121215] shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300 text-xs shrink-0">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "G"}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-zinc-200 truncate">{user?.full_name || "Guest Evaluator"}</div>
              <div className="text-[10px] text-zinc-500 truncate">{user?.email || "evaluator@local.host"}</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/"); setMobileNavOpen(false); }}
            className="text-zinc-500 hover:text-rose-450 p-1.5 rounded hover:bg-zinc-900 transition shrink-0 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header Bar */}
        <Header 
          onSidebarToggle={() => setCollapsed(false)} 
          isSidebarCollapsed={collapsed} 
          onMobileMenuToggle={() => setMobileNavOpen(true)}
        />

        {/* Child Screen Page Router Container */}
        <main className="flex-1 overflow-y-auto bg-[#09090b] p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
