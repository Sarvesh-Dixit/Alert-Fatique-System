import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { X, Radio, ChevronLeft, ShieldCheck, Loader2 } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register, guestLogin } = useAuth();
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          organization_name: form.organization_name,
        });
      }
      onClose();
      navigate("/monitor");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEvaluatorLogin = async () => {
    setError("");
    setBusy(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000); // 10 seconds timeout
    
    try {
      await guestLogin({ signal: controller.signal });
      clearTimeout(timeoutId);
      onClose();
      navigate("/monitor");
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Guest evaluator login failed:", err);
      const isTimeout = err.name === "AbortError" || controller.signal.aborted;
      const errorMsg = isTimeout
        ? "Request timed out after 10 seconds (backend database may be overloaded or locked)."
        : err instanceof Error ? err.message : String(err);
      setError("Failed to initialize guest session: " + errorMsg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-md font-sans">
      <div className="bg-[#121215]/95 border border-zinc-800/85 shadow-2xl rounded-2xl p-8 max-w-md w-full relative space-y-6">
        
        {/* Close Button Top Right */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-white/40 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center space-y-2 mb-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
            <Radio className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center justify-center gap-2">
            <span>Evaluator Access Portal</span>
          </h2>
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-400 text-center">
            Intelligent Alert Noise Reduction Gateway
          </p>
        </div>

        {/* 1-Click Guest Evaluator Quick Access */}
        <button
          type="button"
          onClick={handleEvaluatorLogin}
          disabled={busy}
          className="w-full py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>LAUNCH INSTANT EVALUATOR SESSION</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-zinc-800 w-full" />
          <span className="bg-[#121215] px-3 text-[11px] font-mono text-zinc-500 uppercase">Or continue with credentials</span>
        </div>

        {/* Mode Toggle tabs */}
        <div className="flex bg-[#18181b] p-1 rounded-lg gap-1 border border-zinc-805">
          <button
            type="button"
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
              mode === "login" ? "bg-zinc-800 text-white" : "text-white/50 hover:text-white"
            }`}
            onClick={() => setMode("login")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
              mode === "register" ? "bg-zinc-800 text-white" : "text-white/50 hover:text-white"
            }`}
            onClick={() => setMode("register")}
          >
            Sign Up
          </button>
        </div>

        {/* Form fields */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-2.5 rounded-lg">
              {error}
            </div>
          )}

          {mode === "register" && (
            <>
              <div>
                <label className="block text-xs font-mono font-medium text-zinc-400 uppercase mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane SRE"
                  className="w-full bg-[#18181b] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-medium text-zinc-400 uppercase mb-1.5">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp"
                  className="w-full bg-[#18181b] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  value={form.organization_name}
                  onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-mono font-medium text-zinc-400 uppercase mb-1.5">
              Work Email
            </label>
            <input
              type="email"
              required
              placeholder="evaluator@telemetryhighway.com"
              className="w-full bg-[#18181b] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-zinc-400 uppercase mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              className="w-full bg-[#18181b] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-sm transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin text-zinc-950" /> : mode === "login" ? "Sign In to Highway" : "Create Account"}
          </button>
        </form>

        {/* Return to Landing Page Button at Bottom */}
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-xs font-semibold text-center mt-5 w-full flex items-center justify-center gap-1.5 cursor-pointer hover:underline bg-transparent border-none outline-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Return to Landing Page</span>
        </button>

      </div>
    </div>
  );
}
