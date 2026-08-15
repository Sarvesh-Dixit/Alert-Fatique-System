import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Radio, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

export default function Register() {
  const { register, guestLogin, user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/monitor", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({
        email,
        password,
        full_name: fullName,
        organization_name: orgName,
      });
      navigate("/monitor", { replace: true });
    } catch (err: any) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError("");
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000); // 10 seconds timeout
    
    try {
      await guestLogin({ signal: controller.signal });
      clearTimeout(timeoutId);
      navigate("/monitor", { replace: true });
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Guest evaluator login failed:", err);
      const isTimeout = err.name === "AbortError" || controller.signal.aborted;
      const errorMsg = isTimeout
        ? "Request timed out after 10 seconds (backend database may be overloaded or locked)."
        : err instanceof Error ? err.message : String(err);
      setError("Failed to initialize guest session: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />

      <div className="relative z-10 w-full max-w-md bg-[#121215]/90 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
            <Radio className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Telemetry Highway</h1>
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            Intelligent Alert Noise Reduction Gateway
          </p>
        </div>

        {/* 1-Click Guest Evaluator Quick Access (High Visibility for Judges) */}
        <button
          type="button"
          onClick={handleGuestLogin}
          disabled={loading}
          className="w-full py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>LAUNCH INSTANT EVALUATOR SESSION</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-zinc-800 w-full" />
          <span className="bg-[#121215] px-3 text-[11px] font-mono text-zinc-500 uppercase">Or register organization</span>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-zinc-400 uppercase mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane SRE"
              className="w-full bg-[#18181b] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-zinc-400 uppercase mb-1.5">
              Organization Name
            </label>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Corp"
              className="w-full bg-[#18181b] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-zinc-400 uppercase mb-1.5">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="evaluator@telemetryhighway.com"
              className="w-full bg-[#18181b] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-zinc-400 uppercase mb-1.5">
              Password (min 8 chars)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#18181b] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400 font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-sm transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : 'Register Organization'}
          </button>
        </form>

        {/* Footer Switch Link */}
        <div className="text-center text-xs text-zinc-500">
          Already have an account?{' '}
          <Link className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors" to="/login">
            Sign In to Highway
          </Link>
        </div>
      </div>
    </div>
  );
}
