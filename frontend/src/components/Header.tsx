import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChevronRight, Play, ChevronDown, Radio } from "lucide-react";

interface HeaderProps {
  onSidebarToggle?: () => void;
  isSidebarCollapsed?: boolean;
}

export default function Header({ onSidebarToggle, isSidebarCollapsed }: HeaderProps) {
  const { user, organizations, currentOrg, setCurrentOrg, logout } = useAuth();
  const navigate = useNavigate();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    <header className="h-14 border-b border-[#252940] bg-[#0F101A] shrink-0 flex items-center justify-between px-6 z-10 font-sans">
      {/* Left side: Sidebar toggle & Breadcrumbs */}
      <div className="flex items-center gap-4">
        {isSidebarCollapsed && (
          <button
            onClick={onSidebarToggle}
            className="text-white/60 hover:text-white transition text-xs border border-[#252940] p-1.5 rounded bg-white/5 cursor-pointer flex items-center justify-center"
            title="Expand Navigation"
          >
            <Play className="w-3 h-3 fill-current" />
          </button>
        )}

        <div className="flex items-center gap-2 text-xs font-semibold text-white/40">
          <span className="hover:text-white cursor-pointer transition">Telemetry</span>
          <ChevronRight className="w-3.5 h-3.5 text-white/20" />
          <span className="hover:text-white cursor-pointer transition">{currentOrg?.name || "Global Scope"}</span>
          <ChevronRight className="w-3.5 h-3.5 text-white/20" />
          <span className="text-cyan-400 font-bold">AI Noise Filter</span>
        </div>
      </div>

      {/* Right side: Live Indicator, Org Selector, User Profile */}
      <div className="flex items-center gap-4">
        {/* API Status Indicator */}
        <div className="flex items-center gap-1.5 bg-[#161928] border border-[#252940] px-2.5 py-1 rounded-md text-[11px] font-semibold text-emerald-400 font-mono tracking-tight shadow-sm">
          <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse shrink-0" />
          <span>Live Filtering</span>
        </div>

        {/* Organization Switcher */}
        {organizations.length > 0 && (
          <div className="flex items-center gap-1 bg-[#161928] border border-[#252940] rounded-md px-2.5 py-1 shadow-sm">
            <span className="text-[9px] uppercase tracking-wider text-white/30 font-bold">Scope:</span>
            <select
              className="bg-transparent border-none text-xs text-white/80 focus:text-white outline-none cursor-pointer font-mono font-bold"
              value={currentOrg?.id ?? ""}
              onChange={(e) => {
                const org = organizations.find((o) => o.id === e.target.value);
                if (org) setCurrentOrg(org);
              }}
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id} className="bg-[#0f101a] text-white">
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 bg-[#161928] border border-[#252940] hover:border-[#727DA1]/30 rounded-md px-2.5 py-1 text-xs text-white/85 transition cursor-pointer shadow-sm"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#98A4F7] to-[#5B63D3] flex items-center justify-center font-bold text-white text-[10px]">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="hidden sm:inline font-mono text-[11px] font-medium">{user?.full_name || "User"}</span>
            <ChevronDown className="w-3 h-3 text-white/40" />
          </button>

          {profileDropdownOpen && (
            <>
              {/* Overlay backdrop to close dropdown */}
              <div 
                className="fixed inset-0 z-20 cursor-default" 
                onClick={() => setProfileDropdownOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-48 bg-[#181926]/90 backdrop-blur-xl border border-[#1F2433] rounded-lg shadow-xl py-1 z-30 font-sans">
                <div className="px-4 py-2 border-b border-[#1F2433]">
                  <div className="text-xs text-white font-semibold truncate">{user?.full_name}</div>
                  <div className="text-[10px] text-white/40 truncate">{user?.email}</div>
                </div>
                <Link
                  to="/"
                  className="block px-4 py-2 text-xs text-white/80 hover:bg-[#727DA1]/15 hover:text-white transition"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  Landing Page
                </Link>
                <a
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 text-xs text-white/80 hover:bg-[#727DA1]/15 hover:text-white transition"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  API Documentation
                </a>
                <div className="border-t border-[#1F2433] my-1" />
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
