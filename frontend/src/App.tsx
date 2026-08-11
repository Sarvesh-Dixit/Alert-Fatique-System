import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Incidents from "./pages/Incidents";
import IncidentDetail from "./pages/IncidentDetail";
import Applications from "./pages/Applications";
import ApplicationDetail from "./pages/ApplicationDetail";
import ApiKeys from "./pages/ApiKeys";
import Explorer from "./pages/Explorer";
import Devices from "./pages/Devices";
import Analytics from "./pages/Analytics";
import Integrations from "./pages/Integrations";
import PlatformHealth from "./pages/PlatformHealth";
import Demo from "./pages/Demo";
import Settings from "./pages/Settings";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-white/50">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<Protected><Overview /></Protected>} />
      <Route path="/incidents" element={<Protected><Incidents /></Protected>} />
      <Route path="/incidents/:incidentId" element={<Protected><IncidentDetail /></Protected>} />
      <Route path="/applications" element={<Protected><Applications /></Protected>} />
      <Route path="/applications/:appId" element={<Protected><ApplicationDetail /></Protected>} />
      <Route path="/applications/:appId/keys" element={<Protected><ApiKeys /></Protected>} />
      <Route path="/explorer" element={<Protected><Explorer /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/devices" element={<Protected><Devices /></Protected>} />
      <Route path="/integrations" element={<Protected><Integrations /></Protected>} />
      <Route path="/platform-health" element={<Protected><PlatformHealth /></Protected>} />
      <Route path="/demo" element={<Protected><Demo /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
