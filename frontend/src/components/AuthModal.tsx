import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { X, Sparkles, Radio, ChevronLeft } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
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
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEvaluatorLogin = async () => {
    setError("");
    setBusy(true);
    const guestEmail = "evaluator@telemetryhighway.com";
    const guestPass = "evaluatorpass";
    try {
      await login(guestEmail, guestPass);
      onClose();
      navigate("/dashboard");
    } catch (err) {
      // Register guest on-demand if not exists
      try {
        await register({
          email: guestEmail,
          password: guestPass,
          full_name: "Guest Evaluator",
          organization_name: "Evaluator Organization",
        });
        onClose();
        navigate("/dashboard");
      } catch (regErr) {
        setError("Failed to initialize guest session: " + (regErr instanceof Error ? regErr.message : String(regErr)));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0C14]/80 backdrop-blur-md font-sans">
      <div className="bg-[#0F101A] border border-[#252940] shadow-2xl rounded-2xl p-6 max-w-md w-full relative">
        
        {/* Close Button Top Right */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-white/40 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            <Radio className="w-5 h-5 text-neonCyan animate-pulse" />
            <span>Evaluator Access Portal</span>
          </h2>
          <p className="text-white/40 text-xs mt-1">Access the Telemetry Highway Filtering Dashboard</p>
        </div>

        {/* 1-Click Guest Access Button */}
        <button
          onClick={handleEvaluatorLogin}
          disabled={busy}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg w-full mb-5 hover:opacity-90 transition flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.25)]"
        >
          <Sparkles className="w-4 h-4" />
          <span>1-Click Evaluator Auto-Login</span>
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-[#252940]" />
          <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">OR</span>
          <div className="h-px flex-1 bg-[#252940]" />
        </div>

        {/* Mode Toggle tabs */}
        <div className="flex bg-[#171926] p-1 rounded-lg gap-1 mb-4">
          <button
            type="button"
            className={`flex-1 py-1.5 rounded text-xs font-semibold cursor-pointer transition ${
              mode === "login" ? "bg-[#23273b] text-white" : "text-white/50 hover:text-white"
            }`}
            onClick={() => setMode("login")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 rounded text-xs font-semibold cursor-pointer transition ${
              mode === "register" ? "bg-[#23273b] text-white" : "text-white/50 hover:text-white"
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
                <label className="label">Full Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Jane SRE"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Organization Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Acme Corp"
                  value={form.organization_name}
                  onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="name@company.com"
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
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn bg-[#5B63D3] hover:bg-[#5B63D3]/90 text-white font-semibold py-2 rounded-lg mt-2 cursor-pointer"
          >
            {busy ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Return to Landing Page Button at Bottom */}
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-xs font-semibold text-center mt-5 w-full flex items-center justify-center gap-1.5 cursor-pointer hover:underline"
        >
          <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
          <span>Return to Landing Page</span>
        </button>

      </div>
    </div>
  );
}
