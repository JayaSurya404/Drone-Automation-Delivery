import React from 'react';
import { Modal } from '../common/Modal';
import { Sparkles, ArrowRight, Zap, Bot, Radio, Compass, Activity, ShieldCheck, ShoppingBag, Send, BarChart3, CheckCircle2 } from 'lucide-react';

interface OperationsUniverseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GALAXY_STATIONS = [
  { id: '1', title: 'Orders Ingestion', desc: 'Customer & merchant APIs submit orders with payload & SLA tags.', icon: ShoppingBag, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  { id: '2', title: 'Mission Engine', desc: 'Automated 4D corridor generator with DGCA DigitalSky deconfliction.', icon: Compass, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  { id: '3', title: 'Smart Asset Selection', desc: 'Multi-factor algorithm matches optimal drone by battery, health & range.', icon: Bot, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { id: '4', title: 'Trajectory Engine', desc: 'Lockstep waypoints with spatial altitude layer separation (80-120m).', icon: Radio, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  { id: '5', title: 'Airspace Corridors', desc: 'Live airspace volume with LiDAR collision monitoring & weather sync.', icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  { id: '6', title: 'Drone Autopilot', desc: 'Onboard deterministic flight controller executing real-time trajectory.', icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  { id: '7', title: 'Telemetry Stream', desc: '50+ parameters streaming at 10Hz over 5G mesh and RF failover link.', icon: Send, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
  { id: '8', title: 'Simulated AI Insights', desc: 'Automated rule engine for dynamic obstacle avoidance & weather reroutes.', icon: Sparkles, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  { id: '9', title: 'Precision Delivery', desc: 'Optical QR lock and automated winch release for zero-impact drops.', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  { id: '10', title: 'Fleet Analytics', desc: 'Post-flight black box analysis, battery health grading & maintenance forecasting.', icon: BarChart3, color: 'text-rose-400', bg: 'bg-rose-500/20' },
];

export const OperationsUniverseModal: React.FC<OperationsUniverseModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="SKYNAV OPERATIONS UNIVERSE — System Architecture Galaxy"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-6 text-xs text-slate-700 dark:text-slate-200">
        {/* Hero banner */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-950 text-white border-2 border-cyan-500/50 shadow-2xl space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-xs uppercase tracking-widest">
            <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} /> SKYNAV SIGNATURE PLATFORM ARCHITECTURE
          </div>
          <h3 className="text-xl font-black text-slate-100 tracking-tight">
            End-to-End Autonomous Aviation Pipeline
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-3xl">
            From customer order ingestion to 4D trajectory generation, autonomous flight execution, LiDAR obstacle avoidance, precision optical drop, and telemetry analytics.
          </p>
        </div>

        {/* 10-Station Visual Flow Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono">
          {GALAXY_STATIONS.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div
                key={st.id}
                className="p-4 rounded-3xl bg-slate-900/90 text-white border border-slate-800 space-y-2.5 relative group hover:border-cyan-500/50 transition-all shadow-md flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-2xl ${st.bg} ${st.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">STAGE {st.id}</span>
                  </div>
                  <h4 className="font-black text-xs text-slate-100">{st.title}</h4>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">{st.desc}</p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-cyan-400">
                  <span>Pipeline Synced</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-mono text-slate-400">DGCA Compliant Full-Stack Autonomous Avionics Architecture</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs"
          >
            Close Operations Universe
          </button>
        </div>
      </div>
    </Modal>
  );
};
