import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import Incidents from "./pages/Incidents";
import IncidentDetail from "./pages/IncidentDetail";
import Settings from "./pages/Settings";
import Demo from "./pages/Demo";
import Landing from "./pages/Landing";
import LiveMonitor from "./pages/LiveMonitor";

import Login from "./pages/Login";
import Register from "./pages/Register";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-white/50 font-sans">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-white/50 font-sans">Loading…</div>;
  if (user) return <Navigate to="/monitor" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/signup" element={<Navigate to="/register" replace />} />
      <Route path="/" element={<RootRoute />} />
      
      {/* Redirection routes */}
      <Route path="/overview" element={<Protected><Navigate to="/monitor" replace /></Protected>} />
      <Route path="/dashboard" element={<Protected><Navigate to="/monitor" replace /></Protected>} />
      
      {/* Active tabs */}
      <Route path="/monitor" element={<Protected><LiveMonitor /></Protected>} />
      <Route path="/incidents" element={<Protected><Incidents /></Protected>} />
      <Route path="/incidents/:incidentId" element={<Protected><IncidentDetail /></Protected>} />
      <Route path="/demo" element={<Protected><Demo /></Protected>} />
      <Route path="/rules" element={<Protected><Settings /></Protected>} />
      <Route path="/settings" element={<Protected><Navigate to="/rules" replace /></Protected>} />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/monitor" replace />} />
    </Routes>
  );
}
