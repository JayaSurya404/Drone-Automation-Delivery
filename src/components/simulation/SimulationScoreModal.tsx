import React from 'react';
import { Modal } from '../common/Modal';
import {
  Award,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Clock,
  Compass,
  RotateCcw,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  Radio,
  Cpu,
} from 'lucide-react';

interface SimulationScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplay: () => void;
  scenarioTitle?: string;
  droneId?: string;
}

export const SimulationScoreModal: React.FC<SimulationScoreModalProps> = ({
  isOpen,
  onClose,
  onReplay,
  scenarioTitle = 'Urban Autonomous Medical Delivery',
  droneId = 'D-024',
}) => {
  if (!isOpen) return null;

  const metrics = [
    { label: 'Mission Success Rate', value: '100%', score: 100, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'Route Corridor Efficiency', value: '94.2%', score: 94, icon: Compass, color: 'text-cyan-500' },
    { label: 'Battery Energy Conservation', value: '91.8%', score: 92, icon: Zap, color: 'text-amber-500' },
    { label: 'Airspace Safety & Separation', value: '98.5%', score: 98, icon: ShieldCheck, color: 'text-emerald-500' },
    { label: 'Autonomous Decision Latency', value: '42 ms (96%)', score: 96, icon: Cpu, color: 'text-blue-500' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Autonomous Simulation Performance Evaluation & Flight Audit"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5 text-xs text-slate-700 dark:text-slate-200">
        {/* 1. Hero Score Banner */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white border border-slate-800 shadow-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px] uppercase tracking-wider">
              ● SIMULATION AUDIT VERIFIED
            </span>
            <h3 className="text-lg font-black text-slate-100">{scenarioTitle}</h3>
            <p className="text-xs text-slate-400 font-mono">
              Asset: {droneId} • Mission: MIS-20491 • Order: ORD-10482 • Hub: Coimbatore 01
            </p>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
            <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">OVERALL SCORE</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-cyan-400 font-mono">95</span>
                <span className="text-xs text-slate-400 font-mono">/ 100 (Grade A+)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Key Performance Indicators Grid */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Evaluation Breakdown
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {metrics.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.label}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${m.color}`} />
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{m.label}</span>
                  </div>
                  <span className={`font-mono font-black text-xs ${m.color}`}>{m.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Detailed Operational Stats Table */}
        <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Post-Flight Mission Log Summary
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900">
              <span className="text-slate-400 block text-[10px]">TOTAL DISTANCE</span>
              <span className="font-black text-slate-900 dark:text-slate-100">7.0 km</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900">
              <span className="text-slate-400 block text-[10px]">FLIGHT DURATION</span>
              <span className="font-black text-slate-900 dark:text-slate-100">4m 12s</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900">
              <span className="text-slate-400 block text-[10px]">BATTERY USED</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">28% (0.42 kWh)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900">
              <span className="text-slate-400 block text-[10px]">INCIDENTS MITIGATED</span>
              <span className="font-black text-cyan-600 dark:text-cyan-400">1 (Autonomous Reroute)</span>
            </div>
          </div>
        </div>

        {/* 4. Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => {
              onClose();
              onReplay();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 font-bold hover:bg-cyan-500/25 transition-all shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Replay Simulation</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all"
            >
              Done & Return to Console
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
