import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ComparisonSection from "../components/ComparisonSection";
import LogoStrip from "../components/LogoStrip";
import HowItWorks from "../components/HowItWorks";
import AuthModal from "../components/AuthModal";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, 
  Database, 
  MessageSquare, 
  ShieldAlert, 
  Clock, 
  Code2, 
  ArrowRight,
  UserCheck,
  Play,
  ShieldCheck,
  AlertOctagon
} from "lucide-react";

export default function Landing() {
  const { user, login, register, guestLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [busy, setBusy] = useState(false);

  // Auto-open auth modal when redirected here with ?auth=login
  useEffect(() => {
    if (searchParams.get("auth") === "login") {
      setAuthOpen(true);
    }
  }, [searchParams]);

  // Redirect already-authenticated users to dashboard
  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleGuestAutoLogin = async () => {
    setBusy(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000); // 10 seconds timeout
    
    try {
      await guestLogin({ signal: controller.signal });
      clearTimeout(timeoutId);
      navigate("/dashboard");
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Guest auto-login failed:", err);
      // Fallback to modal if it fails, allowing user to see error/retry manually
      setAuthOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const carouselItems = [
    {
      title: "GPTrace Clustering",
      desc: "Maps exception stack traces to embedding spaces using cosine similarity (≥0.88) to group logical errors without relying on static regex matching.",
      icon: Code2,
      content: (
        <div className="bg-[#0a0c14] border border-[#23293e] font-mono text-xs text-slate-300 p-4 rounded-xl shadow-inner flex flex-col gap-2">
          <div className="flex items-center gap-1.5 border-b border-borderDark pb-2 text-[10px] text-white/40">
            <span>app/intelligence/embedding.py</span>
          </div>
          <div className="text-emerald-400"># GPTrace Similarity Matching</div>
          <div>trace_1 = <span className="text-[#7C87F7]">"DB Connection timeout on port 5432 after 10000ms"</span></div>
          <div>trace_2 = <span className="text-[#7C87F7]">"Postgres link failure: connection reset on port 5432"</span></div>
          <div className="text-cyan-400 mt-2 font-bold">engine.compute_similarity(trace_1, trace_2)</div>
          <div className="text-emerald-400 font-bold">&gt;&gt;&gt; 0.912  (SEMANTIC CLUSTER MATCH)</div>
        </div>
      )
    },
    {
      title: "Cooldown Matrix",
      desc: "Applies cascading rate-limiting timers to suppress repeated webhook storms during outage bursts.",
      icon: Clock,
      content: (
        <div className="grid grid-cols-2 gap-3">
          {[
            { app: "auth-service", cd: "1:45", sup: "125", tier: "CRITICAL", border: "border-rose-500/20 text-rose-400" },
            { app: "payment-gateway", cd: "4:12", sup: "340", tier: "HIGH", border: "border-amber-500/20 text-amber-400" },
          ].map((item, idx) => (
            <div key={idx} className="bg-[#0a0c14] border border-[#23293e] rounded-xl p-3 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-mono text-white/50">{item.app}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold ${item.border}`}>{item.tier}</span>
              </div>
              <div className="text-cyan-300 font-mono font-bold text-sm">Suppression: {item.cd}</div>
              <div className="text-[10px] font-mono bg-slate-800/40 text-slate-300 px-2 py-0.5 rounded w-fit border border-slate-700/50">
                {item.sup} suppressed
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      title: "LogHub Production Replay",
      desc: "Streams authentic distributed system logs (like HDFS outage warning streams) through the real proxy.",
      icon: Database,
      content: (
        <div className="bg-[#0a0c14] border border-[#23293e] font-mono text-[11px] text-[#C9D3EE] p-4 rounded-xl max-h-[160px] overflow-y-auto flex flex-col gap-1.5 scrollbar-thin">
          <div className="text-white/40 text-[9px]">[12:00:01] Ingestion proxy listening...</div>
          <div className="text-[#38BDF8]">[12:00:02] Ingested log: hdfs.DFSClient - Block missing in cluster</div>
          <div className="text-[#38BDF8]">[12:00:03] Ingested log: hdfs.DFSClient - Retrying block read (1/3)</div>
          <div className="text-[#10B981]">[12:00:03] GPTrace: Similarity cluster matches active Incident #1024</div>
          <div className="text-[#10B981] font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span>[12:00:03] Event Suppressed: Alert Fatigue blocked!</span>
          </div>
        </div>
      )
    },
    {
      title: "Webhook Summaries",
      desc: "Formats and aggregates incidents cleanly for outbound Slack and Discord alerts with quick direct actions.",
      icon: MessageSquare,
      content: (
        <div className="bg-[#101426] border border-[#7C87F7]/30 rounded-xl p-4 flex flex-col gap-2 font-sans text-xs">
          <div className="flex items-center gap-2 text-white font-bold">
            <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0" />
            <span>CRITICAL: Outage Spike - db-proxy</span>
          </div>
          <p className="text-[#C9D3EE] text-[10px] leading-relaxed">
            GPTrace Vector Match: <strong className="text-neonCyan">92% similarity</strong>. Total suppressed: <strong>499 warnings</strong>.
          </p>
          <div className="flex gap-2 mt-1">
            <button className="bg-[#7C87F7] hover:bg-[#7C87F7]/80 text-white font-semibold px-3 py-1 rounded text-[10px] transition cursor-pointer">
              View Incident
            </button>
            <button className="border border-[#727DA1]/30 hover:bg-white/5 text-[#C9D3EE] font-medium px-3 py-1 rounded text-[10px] transition cursor-pointer">
              Silence
            </button>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-[#0B0C14] text-[#C9D3EE] flex flex-col overflow-hidden relative selection:bg-[#7C87F7]/30 selection:text-white">
      <Navbar onOpenAuth={() => setAuthOpen(true)} />

      {/* Animated Background Ambient Glows */}
      <div className="absolute top-[8%] left-[10%] w-[380px] h-[380px] bg-gradient-to-r from-[#38BDF8]/10 via-[#7C87F7]/5 to-transparent blur-3xl rounded-full animate-pulse pointer-events-none" />
      <div className="absolute top-[35%] right-[10%] w-[420px] h-[420px] bg-gradient-to-r from-[#7C87F7]/10 via-indigo-500/5 to-transparent blur-3xl rounded-full animate-pulse pointer-events-none" />

      {/* Hero Section */}
      <section id="hero" className="pt-32 pb-20 px-6 max-w-6xl mx-auto flex flex-col items-center text-center gap-6 relative z-10">
        <motion.span 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-[#171926] border border-[#727DA1]/15 text-[#7C87F7] text-[10px] font-mono uppercase tracking-widest font-bold px-3 py-1 rounded-full"
        >
          Telemetry Highway Proxy Engine
        </motion.span>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="homepage-heading-gradient font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.15] text-center max-w-4xl mx-auto mt-4 mb-4"
        >
          The AI-Powered Telemetry Proxy &amp; Alert Fatigue Reducer
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-[#C9D3EE]/80 text-sm md:text-base leading-relaxed max-w-2xl"
        >
          Collapses 10,000 noisy logs into 1 actionable incident thread using GPTrace vector embeddings. Achieve ~99.8% Noise Reduction Ratio out of the box.
        </motion.p>

        {/* Hero Actions Section (No Email Input) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col items-center gap-4 mt-2 w-full"
        >
          <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-lg">
            <button
              onClick={handleGuestAutoLogin}
              disabled={busy}
              className="bg-gradient-to-r from-[#98A4F7] to-[#5B63D3] text-white font-semibold text-xs px-6 h-[46px] rounded-lg hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(124,135,247,0.15)] flex-1"
            >
              <Play className="w-4 h-4" />
              <span>{busy ? "Loading guest session..." : "Launch Interactive Simulator"}</span>
            </button>
            <button
              onClick={() => setAuthOpen(true)}
              className="border border-[#727DA1]/30 bg-[#171926]/40 hover:bg-[#727DA1]/10 text-white font-semibold text-xs px-6 h-[46px] rounded-lg transition flex items-center justify-center gap-2 cursor-pointer flex-1"
            >
              <span>Access Evaluator Portal / Sign In</span>
            </button>
          </div>

          {/* Guest pre-seeded badge pill */}
          <button 
            onClick={handleGuestAutoLogin}
            disabled={busy}
            className="group flex items-center gap-1.5 bg-[#171926]/60 border border-[#727DA1]/15 px-3 py-1 rounded-full text-[10px] font-mono text-neonCyan hover:border-[#38BDF8]/40 hover:bg-[#23273b] transition cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Auto-login pre-seeded guest organization for instant testing</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>

        {/* Hero Interactive Showcase Tabs */}
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="w-full max-w-4xl border border-[#939DB8]/15 bg-[#0F101A] rounded-[26px] p-6 mt-12 shadow-2xl flex flex-col gap-6 text-left"
        >
          {/* Tab Switchers */}
          <div className="flex flex-wrap gap-2 border-b border-[#727DA1]/10 pb-4">
            {carouselItems.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === idx 
                      ? "bg-[#23273b] text-neonCyan border border-[#38BDF8]/20" 
                      : "text-white/50 hover:bg-[#727DA1]/10 hover:text-white"
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>

          {/* Active Preview Section with AnimatePresence */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center min-h-[180px] overflow-hidden">
            <div className="md:col-span-5 flex flex-col gap-3">
              <h4 className="text-white font-bold text-sm uppercase tracking-wider">
                {carouselItems[activeTab].title}
              </h4>
              <p className="text-[#C9D3EE]/70 text-xs leading-relaxed">
                {carouselItems[activeTab].desc}
              </p>
            </div>
            <div className="md:col-span-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  {carouselItems[activeTab].content}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Ecosystem compatibility strip */}
      <LogoStrip />

      {/* How it works — three steps from noise to signal */}
      <HowItWorks />

      {/* Comparative ROI & Suppression section */}
      <div id="cooldown">
        <ComparisonSection />
      </div>

      {/* Feature Showcase Grid */}
      <section id="features" className="py-20 px-6 max-w-6xl mx-auto flex flex-col gap-12 border-t border-[#727DA1]/10">
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Engineered for Modern DevOps</h2>
          <p className="text-white/40 text-xs">Dynamic trace clustering with nanosecond middleware proxy latency</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div 
            id="gptrace"
            className="card bg-[#0F101A] border border-[#939DB8]/10 rounded-xl p-8 hover:scale-[1.01] hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(56,189,248,0.08)] transition-all duration-300 flex flex-col gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-[#7C87F7]/10 flex items-center justify-center border border-[#7C87F7]/25 text-[#7C87F7]">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="text-white font-bold text-base">GPTrace Vector Clustering</h3>
            <p className="text-[#C9D3EE]/70 text-xs leading-relaxed">
              Maps exception stack traces to high-dimensional embedding spaces. Uses Cosine Similarity (≥0.88) to group logical errors without relying on static regex matching.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="card bg-[#0F101A] border border-[#939DB8]/10 rounded-xl p-8 hover:scale-[1.01] hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(56,189,248,0.08)] transition-all duration-300 flex flex-col gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#38BDF8]/10 flex items-center justify-center border border-[#38BDF8]/25 text-[#38BDF8]">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-white font-bold text-base">Automated Cooldown Matrix</h3>
            <p className="text-[#C9D3EE]/70 text-xs leading-relaxed">
              Triggers localized escalation cooldown timers automatically based on incident priority (CRITICAL 2m, HIGH 5m, MEDIUM 15m, LOW 30m) to protect SRE pager channels.
            </p>
          </div>

          {/* Feature 3 */}
          <div 
            id="loghub"
            className="card bg-[#0F101A] border border-[#939DB8]/10 rounded-xl p-8 hover:scale-[1.01] hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(56,189,248,0.08)] transition-all duration-300 flex flex-col gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/25 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-white font-bold text-base">LogHub Replay Engine</h3>
            <p className="text-[#C9D3EE]/70 text-xs leading-relaxed">
              Allows administrators to stream authentic raw distributed system logs (like HDFS logs) to test, fine-tune, and benchmark clustering models on real noisy inputs.
            </p>
          </div>
        </div>
      </section>

      {/* SRE Testimonial Social Proof Grid */}
      <section id="integrations" className="py-20 px-6 max-w-6xl mx-auto flex flex-col gap-12 border-t border-[#727DA1]/10">
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Trusted by SRE Teams</h2>
          <p className="text-white/40 text-xs">Praising 1-click incident deduplication and alert suppression</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              quote: "Telemetry Highway is a lifesaver. We plugged it in as an OpenTelemetry gateway proxy, and our Slack alert channel went from a chaotic waterfall to a single clean threat incident context.",
              author: "Marcus V.",
              role: "Lead DevOps SRE",
              company: "CloudScale Systems"
            },
            {
              quote: "The GPTrace cosine similarity grouping resolved a major issue where changing trace IDs and hex values were bypassing our Prometheus grouping rules. Noise is down 99%.",
              author: "Elena R.",
              role: "Director of Reliability Engineering",
              company: "LogiFlow Global"
            }
          ].map((card, idx) => (
            <div 
              key={idx} 
              className="backdrop-blur-xl bg-[#171824]/80 border border-[#727DA1]/20 rounded-xl p-6 flex flex-col justify-between gap-4 shadow-xl hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(56,189,248,0.08)] transition-all duration-300"
            >
              <p className="text-white/80 text-xs italic leading-relaxed">
                "{card.quote}"
              </p>
              <div className="flex items-center gap-3 mt-2 border-t border-[#727DA1]/10 pt-3">
                <div className="w-8 h-8 rounded-full bg-[#7C87F7]/25 text-[#7C87F7] flex items-center justify-center font-bold text-xs shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-[10px]">
                  <strong className="text-white font-bold">{card.author}</strong>
                  <span className="text-[#646E87]">{card.role} · {card.company}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Simulator Redirect Anchor section on Landing */}
      <section id="demo-simulator" className="py-16 px-6 max-w-6xl mx-auto border-t border-[#727DA1]/10 text-center flex flex-col items-center gap-4 relative z-10">
        <div className="bg-[#7C87F7]/10 text-[#7C87F7] p-3 rounded-full border border-[#7C87F7]/25 mb-2">
          <Zap className="w-6 h-6 animate-bounce" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-wider">Ready to Test the Filter Engine?</h2>
        <p className="text-white/40 text-xs max-w-md">
          Authenticate as a guest evaluator to run burst simulations and trace NRR calculations live.
        </p>
        <button
          onClick={handleGuestAutoLogin}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs px-6 py-3 rounded-lg hover:opacity-95 transition cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.25)] mt-2"
        >
          {busy ? "Loading guest session..." : "1-Click Sign In & Access Simulator"}
        </button>
      </section>

      <Footer />

      {/* Embedded Auth Modal */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
