import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/overview", label: "Overview" },
  { to: "/analytics", label: "Executive Analytics" },
  { to: "/incidents", label: "Incidents" },
  { to: "/applications", label: "Applications" },
  { to: "/explorer", label: "Telemetry Explorer" },
  { to: "/devices", label: "Devices & Security" },
  { to: "/integrations", label: "Integrations" },
  { to: "/platform-health", label: "Platform Health" },
  { to: "/demo", label: "Demo Simulator" },
  { to: "/settings", label: "Settings" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, organizations, currentOrg, setCurrentOrg, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 bg-panel border-r border-white/5 p-4 flex flex-col">
        <div className="text-lg font-bold mb-1">🛰️ Telemetry Highway</div>
        <div className="text-xs text-white/40 mb-6">Phase 3 · Production</div>

        {organizations.length > 0 && (
          <select
            className="input mb-6 text-sm"
            value={currentOrg?.id ?? ""}
            onChange={(e) => {
              const org = organizations.find((o) => o.id === e.target.value);
              if (org) setCurrentOrg(org);
            }}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm transition ${
                  isActive ? "bg-accent text-white" : "text-white/70 hover:bg-white/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5">
          <div className="text-sm text-white/70 truncate">{user?.full_name}</div>
          <div className="text-xs text-white/40 truncate mb-3">{user?.email}</div>
          <button
            className="btn-ghost w-full"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
