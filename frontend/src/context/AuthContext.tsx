import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearToken, getToken, setToken, type Organization } from "../api/client";

interface User {
  id: string;
  email: string;
  full_name: string;
}
interface MeResponse {
  user: User;
  organizations: Organization[];
}
interface AuthState {
  user: User | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  loading: boolean;
  setCurrentOrg: (o: Organization) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}
interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  organization_name: string;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<MeResponse>("/auth/me");
      setUser(me.user);
      setOrganizations(me.organizations);
      setCurrentOrg((prev) => prev ?? me.organizations[0] ?? null);
    } catch {
      clearToken();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ access_token: string }>("/auth/login", { email, password });
    setToken(res.access_token);
    await refresh();
  }

  async function register(data: RegisterData) {
    const res = await api.post<{ access_token: string }>("/auth/register", data);
    setToken(res.access_token);
    await refresh();
  }

  function logout() {
    clearToken();
    setUser(null);
    setOrganizations([]);
    setCurrentOrg(null);
  }

  return (
    <AuthCtx.Provider
      value={{ user, organizations, currentOrg, loading, setCurrentOrg, login, register, logout, refresh }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
