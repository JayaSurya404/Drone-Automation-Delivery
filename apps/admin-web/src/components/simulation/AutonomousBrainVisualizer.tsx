import React from 'react';
import { Cpu, ArrowRight, ShieldCheck, Zap, Bot, Radio, Compass, Activity, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';

interface AutonomousDecisionEvent {
  title: string;
  whatHappened: string;
  why: string;
  riskScore: number;
  decision: string;
  action: string;
  result: string;
  latencyMs: number;
  timestamp: string;
}

interface AutonomousBrainVisualizerProps {
  currentStageIndex?: number;
  activeDecision?: AutonomousDecisionEvent;
  className?: string;
}

export const PIPELINE_NODES = [
  { id: 'orders', label: '1. Orders Ingested', icon: Zap, status: 'complete' },
  { id: 'mission_engine', label: '2. Mission Engine', icon: Compass, status: 'complete' },
  { id: 'drone_selection', label: '3. Drone Selection', icon: Bot, status: 'complete' },
  { id: 'route_engine', label: '4. Route Engine', icon: Radio, status: 'complete' },
  { id: 'env_analysis', label: '5. Environmental Analysis', icon: Activity, status: 'active' },
  { id: 'decision', label: '6. Autonomous Decision', icon: Cpu, status: 'active' },
  { id: 'execution', label: '7. Drone Execution', icon: Bot, status: 'pending' },
  { id: 'telemetry', label: '8. Telemetry & Analytics', icon: ShieldCheck, status: 'pending' },
];

export const AutonomousBrainVisualizer: React.FC<AutonomousBrainVisualizerProps> = ({
  currentStageIndex = 5,
  activeDecision = {
    title: 'DYNAMIC OBSTACLE AVOIDANCE ENGAGED',
    whatHappened: 'Unscheduled construction crane mast detected at 180m directly in planned corridor.',
    why: 'Collision probability (78%) exceeds safety limit under DGCA 120m envelope.',
    riskScore: 78,
    decision: 'Lateral Bypass Reroute (West Vector +120m)',
    action: 'Autopilot banks 18° left, updating waypoints in real-time trajectory ledger.',
    result: 'Safe corridor restored with 120m separation. Zero impact on battery reserve.',
    latencyMs: 38,
    timestamp: '12:05:18 IST',
  },
  className = '',
}) => {
  return (
    <div className={`rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-950 border-2 border-cyan-500/50 p-5 shadow-2xl text-white space-y-4 ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-mono font-black">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-cyan-400 uppercase tracking-wide">
                SKYNAV AUTONOMOUS INTELLIGENCE CORE
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold text-[9px] uppercase border border-amber-500/40">
                SIMULATED AI INSIGHT
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Deterministic Autonomous Rule Engine • Real-Time 4D Deconfliction Pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-slate-400">Decision Latency: <b className="text-emerald-400">{activeDecision.latencyMs} ms</b></span>
          <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">
            {activeDecision.timestamp}
          </span>
        </div>
      </div>

      {/* Animated Pipeline Nodes Flow */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs font-mono">
        {PIPELINE_NODES.map((node, idx) => {
          const Icon = node.icon;
          const isPassed = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          return (
            <div
              key={node.id}
              className={`p-2.5 rounded-2xl border transition-all flex flex-col items-center text-center space-y-1 ${
                isCurrent
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/20 font-bold'
                  : isPassed
                  ? 'bg-slate-900 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${isCurrent ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800'}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] leading-tight">{node.label}</span>
            </div>
          );
        })}
      </div>

      {/* Structured Decision Card: WHAT HAPPENED -> WHY -> DECISION -> ACTION -> RESULT */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
            <h4 className="font-black text-xs text-amber-300 uppercase tracking-wide">
              {activeDecision.title}
            </h4>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold text-[10px] border border-rose-500/40">
            COLLISION RISK: {activeDecision.riskScore}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">1. WHAT HAPPENED</span>
            <p className="text-[11px] text-slate-200 mt-1">{activeDecision.whatHappened}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-amber-400 block font-bold">2. WHY (REASON)</span>
            <p className="text-[11px] text-slate-200 mt-1">{activeDecision.why}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-cyan-400 block font-bold">3. DECISION</span>
            <p className="text-[11px] text-cyan-300 font-bold mt-1">{activeDecision.decision}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-blue-400 block font-bold">4. ACTION</span>
            <p className="text-[11px] text-slate-200 mt-1">{activeDecision.action}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-emerald-400 block font-bold">5. RESULT</span>
            <p className="text-[11px] text-emerald-300 font-bold mt-1">{activeDecision.result}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
