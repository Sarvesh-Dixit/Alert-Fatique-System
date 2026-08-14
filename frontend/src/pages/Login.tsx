import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Radio } from "lucide-react";

export default function Login() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    organization_name: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Redirect an already-authenticated user AFTER render (not during it) so React
  // does not warn about scheduling a state update mid-render.
  useEffect(() => {
    if (user) navigate("/overview", { replace: true });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      navigate("/overview", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold flex items-center justify-center gap-2"><Radio className="w-6 h-6 text-neonCyan animate-pulse" /> Telemetry Highway</div>
          <div className="text-white/40 mt-1">Secure multi-tenant observability</div>
        </div>

        <form className="card space-y-4" onSubmit={submit}>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm ${mode === "login" ? "bg-accent" : "bg-white/5"}`}
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm ${mode === "register" ? "bg-accent" : "bg-white/5"}`}
              onClick={() => setMode("register")}
            >
              Create account
            </button>
          </div>

          {mode === "register" && (
            <>
              <div>
                <label className="label">Full name</label>
                <input
                  className="input"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Organization name</label>
                <input
                  className="input"
                  value={form.organization_name}
                  onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
            />
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <button className="btn w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
