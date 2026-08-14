import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTelemetryInjection } from "../context/TelemetryToastContext";
import { 
  Sliders, 
  Plus, 
  Trash2, 
  Edit, 
  ToggleLeft, 
  ToggleRight, 
  Clock, 
  ShieldAlert, 
  X,
  User,
  Building
} from "lucide-react";
import PageHeader from "../components/PageHeader";

interface SuppressionRule {
  id: string;
  name: string;
  service: string;
  duration: number;
  threshold: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  active: boolean;
}

export default function Settings() {
  const { user, organizations, currentOrg } = useAuth();
  const { setToast } = useTelemetryInjection();

  // Preset rules lists
  const [rules, setRules] = useState<SuppressionRule[]>([
    {
      id: "rule-1",
      name: "Payment API Outage Cooldown",
      service: "payment-api",
      duration: 300,
      threshold: 0.88,
      severity: "CRITICAL",
      active: true,
    },
    {
      id: "rule-2",
      name: "High CPU Storm Preventer",
      service: "host-agent",
      duration: 180,
      threshold: 0.82,
      severity: "HIGH",
      active: true,
    },
    {
      id: "rule-3",
      name: "Auth Login Failures Filter",
      service: "sshd",
      duration: 600,
      threshold: 0.90,
      severity: "HIGH",
      active: true,
    },
    {
      id: "rule-4",
      name: "Database Connection Outage Filter",
      service: "orders",
      duration: 300,
      threshold: 0.85,
      severity: "CRITICAL",
      active: true,
    },
  ]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SuppressionRule | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formService, setFormService] = useState("");
  const [formDuration, setFormDuration] = useState(300);
  const [formThreshold, setFormThreshold] = useState(0.88);
  const [formSeverity, setFormSeverity] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("CRITICAL");
  const [formActive, setFormActive] = useState(true);

  // Open modal for creating new rule
  const handleAddRuleClick = () => {
    setEditingRule(null);
    setFormName("");
    setFormService("");
    setFormDuration(300);
    setFormThreshold(0.88);
    setFormSeverity("CRITICAL");
    setFormActive(true);
    setModalOpen(true);
  };

  // Open modal for editing existing rule
  const handleEditRuleClick = (rule: SuppressionRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormService(rule.service);
    setFormDuration(rule.duration);
    setFormThreshold(rule.threshold);
    setFormSeverity(rule.severity);
    setFormActive(rule.active);
    setModalOpen(true);
  };

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextState = !r.active;
          setToast({
            type: "success",
            message: "Rule Status Updated",
            sub: `Rule '${r.name}' is now ${nextState ? "active" : "disabled"}.`,
            icon: "⚙"
          });
          setTimeout(() => setToast(null), 3000);
          return { ...r, active: nextState };
        }
        return r;
      })
    );
  };

  const handleDeleteRule = (id: string, name: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    setToast({
      type: "success",
      message: "Suppression Rule Deleted",
      sub: `Rule '${name}' was successfully removed.`,
      icon: "🗑"
    });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formService.trim()) return;

    if (editingRule) {
      // Edit
      setRules((prev) =>
        prev.map((r) =>
          r.id === editingRule.id
            ? {
                ...r,
                name: formName,
                service: formService,
                duration: formDuration,
                threshold: formThreshold,
                severity: formSeverity,
                active: formActive,
              }
            : r
        )
      );
      setToast({
        type: "success",
        message: "Suppression Rule Updated",
        sub: `Rule '${formName}' was successfully modified.`,
        icon: "💾"
      });
    } else {
      // Add
      const newRule: SuppressionRule = {
        id: `rule-${Date.now()}`,
        name: formName,
        service: formService,
        duration: formDuration,
        threshold: formThreshold,
        severity: formSeverity,
        active: formActive,
      };
      setRules((prev) => [...prev, newRule]);
      setToast({
        type: "success",
        message: "Suppression Rule Created",
        sub: `Rule '${formName}' was successfully added to the anomaly engine.`,
        icon: "💾"
      });
    }

    setTimeout(() => setToast(null), 3000);
    setModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6 font-sans">
      <PageHeader 
        title="Suppression Rules Config" 
        badge="CONFIGURATION" 
        description="Fine-tune cosine thresholds and live escalation cooldown locks for the anomaly processor cluster."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Span: Suppression Rules Table */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider">Active Suppression Rules</h2>
            <button
              onClick={handleAddRuleClick}
              className="px-3 py-1.5 bg-[#A3E635] text-slate-950 hover:bg-[#A3E635]/90 transition text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Rule</span>
            </button>
          </div>

          <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/20">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-950/50 text-[10px] text-slate-450 uppercase font-mono tracking-wider font-extrabold select-none">
                  <th className="py-3 px-4">Rule Details</th>
                  <th className="py-3 px-4 w-28">Service Target</th>
                  <th className="py-3 px-4 w-24">Duration</th>
                  <th className="py-3 px-4 w-20">Cosine</th>
                  <th className="py-3 px-4 w-20 text-center">Status</th>
                  <th className="py-3 px-4 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/30 transition duration-150">
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-100 font-sans">{r.name}</span>
                        <span className={`text-[8.5px] font-mono font-bold border rounded px-1.5 py-0.2 self-start mt-1 ${
                          r.severity === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          {r.severity}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-300">{r.service}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{r.duration}s</td>
                    <td className="py-3.5 px-4 font-mono text-[#A3E635] font-bold">≥{r.threshold.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleRule(r.id)}
                        className="text-slate-400 hover:text-white transition cursor-pointer inline-flex items-center justify-center"
                        title={r.active ? "Disable Rule" : "Enable Rule"}
                      >
                        {r.active ? (
                          <ToggleRight className="w-6 h-6 text-[#A3E635]" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-600" />
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEditRuleClick(r)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                          title="Edit Rule"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(r.id, r.name)}
                          className="p-1 hover:bg-slate-800 rounded text-rose-400 hover:text-rose-300 transition cursor-pointer"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Span: Profile Info Cards */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card bg-slate-900/60 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/60 rounded-xl p-5 shadow-lg space-y-4">
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              <span>Evaluator Profile</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="text-slate-500">Name</div>
              <div className="text-slate-300 font-semibold">{user?.full_name}</div>
              <div className="text-slate-500">Email</div>
              <div className="text-slate-300 truncate">{user?.email}</div>
              <div className="text-slate-500">User ID</div>
              <div className="text-slate-400 font-bold truncate">{user?.id}</div>
            </div>
          </div>

          <div className="card bg-slate-900/60 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/60 rounded-xl p-5 shadow-lg space-y-4">
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Building className="w-4 h-4 text-cyan-400" />
              <span>Current Organization</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="text-slate-500">Name</div>
              <div className="text-slate-300 font-semibold">{currentOrg?.name}</div>
              <div className="text-slate-500">Slug</div>
              <div className="text-slate-300">{currentOrg?.slug}</div>
              <div className="text-slate-500">Role</div>
              <div className="text-slate-300">{currentOrg?.role}</div>
              <div className="text-slate-500">Org ID</div>
              <div className="text-slate-400 font-bold truncate">{currentOrg?.id}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Complex Form Modal Dialog Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
          <div 
            className="fixed inset-0" 
            onClick={() => setModalOpen(false)} 
          />
          <div className="relative w-full max-w-md p-6 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col gap-4 font-sans text-slate-300">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-slate-500 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-900">
              <Sliders className="w-4 h-4 text-[#A3E635]" />
              <span>{editingRule ? "Edit Suppression Rule" : "Create Suppression Rule"}</span>
            </h3>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-450 uppercase tracking-widest text-[9px]">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rate-limit payment outage burst"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 focus:border-[#A3E635]/65 outline-none text-slate-200"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-450 uppercase tracking-widest text-[9px]">Service Target</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. payment-api"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 focus:border-[#A3E635]/65 outline-none text-slate-200 font-mono"
                    value={formService}
                    onChange={(e) => setFormService(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-450 uppercase tracking-widest text-[9px]">Severity Level</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 focus:border-[#A3E635]/65 outline-none text-slate-200 cursor-pointer"
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as any)}
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-450 uppercase tracking-widest text-[9px] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Duration (seconds)</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={30}
                    max={3600}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 focus:border-[#A3E635]/65 outline-none text-slate-200 font-mono"
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-450 uppercase tracking-widest text-[9px] flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-slate-500" />
                    <span>Cosine Threshold</span>
                  </label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="range"
                      min={0.70}
                      max={0.99}
                      step={0.01}
                      className="w-full accent-[#A3E635]"
                      value={formThreshold}
                      onChange={(e) => setFormThreshold(Number(e.target.value))}
                    />
                    <span className="font-mono font-bold text-white text-[11px] min-w-[28px]">
                      {formThreshold.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-900 pt-3 mt-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormActive(!formActive)}
                    className="text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    {formActive ? (
                      <ToggleRight className="w-6 h-6 text-[#A3E635]" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-600" />
                    )}
                  </button>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Rule Active</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-bold rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[#A3E635] text-slate-950 hover:bg-[#A3E635]/90 font-bold rounded-lg transition cursor-pointer shadow-lg"
                  >
                    Save Rule
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
