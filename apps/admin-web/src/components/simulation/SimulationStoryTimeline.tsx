import React from 'react';
import { StoryScene } from './simulationStories';
import {
  CheckCircle2,
  Circle,
  Play,
  Package,
  Send,
  Bot,
  Gauge,
  PlaneTakeoff,
  Compass,
  Radio,
  AlertTriangle,
  RotateCcw,
  Check,
  Shield,
  Award,
} from 'lucide-react';

interface SimulationStoryTimelineProps {
  scenes: StoryScene[];
  currentSceneIndex: number;
  onSelectScene: (index: number) => void;
  progressInScene: number; // 0 to 1
}

export const SimulationStoryTimeline: React.FC<SimulationStoryTimelineProps> = ({
  scenes,
  currentSceneIndex,
  onSelectScene,
  progressInScene,
}) => {
  const getSceneIcon = (index: number) => {
    switch (index) {
      case 0: return Package;
      case 1: return Send;
      case 2: return Bot;
      case 3: return Gauge;
      case 4: return PlaneTakeoff;
      case 5: return Compass;
      case 6: return Radio;
      case 7: return AlertTriangle;
      case 8: return RotateCcw;
      case 9: return Compass;
      case 10: return Gauge;
      case 11: return Package;
      case 12: return CheckCircle2;
      case 13: return PlaneTakeoff;
      case 14: return Award;
      default: return Circle;
    }
  };

  return (
    <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Autonomous Delivery Story Progress ({currentSceneIndex + 1} / {scenes.length})
          </h4>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Click any scene to inspect stage
        </span>
      </div>

      {/* Horizontal Scrollable Timeline */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 custom-scrollbar">
        {scenes.map((sc, idx) => {
          const Icon = getSceneIcon(idx);
          const isPassed = idx < currentSceneIndex;
          const isCurrent = idx === currentSceneIndex;

          return (
            <button
              key={sc.id}
              onClick={() => onSelectScene(idx)}
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all shrink-0 text-left ${
                isCurrent
                  ? 'bg-cyan-500 text-slate-950 font-black border-cyan-400 shadow-md shadow-cyan-500/20 scale-105'
                  : isPassed
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl shrink-0 ${
                  isCurrent
                    ? 'bg-slate-950 text-cyan-400'
                    : isPassed
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {isPassed ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              </div>

              <div className="min-w-0">
                <span
                  className={`text-[9px] block uppercase font-mono tracking-wider ${
                    isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  {sc.sceneNumber}
                </span>
                <span className="text-[11px] font-bold truncate block max-w-[120px]">
                  {sc.title}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
