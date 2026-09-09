import React, { useState } from 'react';
import { Clock, Play, Pause, RotateCcw, FastForward, Rewind, Layers, Activity, Radio, Compass, ShieldCheck } from 'lucide-react';
import { AUTONOMOUS_DELIVERY_STORY, StoryScene } from './simulationStories';

interface MissionTimeMachineProps {
  onSelectSceneIndex?: (index: number) => void;
  className?: string;
}

export const MissionTimeMachine: React.FC<MissionTimeMachineProps> = ({
  onSelectSceneIndex,
  className = '',
}) => {
  const [scrubberIndex, setScrubberIndex] = useState<number>(14); // Default to scene 15 (completed)
  const currentScene = AUTONOMOUS_DELIVERY_STORY[scrubberIndex] || AUTONOMOUS_DELIVERY_STORY[0];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    setScrubberIndex(idx);
    if (onSelectSceneIndex) onSelectSceneIndex(idx);
  };

  return (
    <div className={`rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-xs font-mono space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-100 uppercase tracking-wide">
              MISSION TIME MACHINE & 4D HISTORICAL RECONSTRUCTION
            </h3>
            <p className="text-[10px] text-slate-400">
              Scrub to any millisecond point to reconstruct drone position, battery SoC, weather, and decisions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 font-bold">
            {currentScene.sceneNumber} • {currentScene.badge}
          </span>
        </div>
      </div>

      {/* Scrubber Range Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] text-slate-400">
          <span>12:03:10 (Takeoff)</span>
          <span className="text-cyan-400 font-bold text-xs">
            {currentScene.title} ({scrubberIndex + 1} / {AUTONOMOUS_DELIVERY_STORY.length})
          </span>
          <span>12:08:20 (Charging)</span>
        </div>

        <input
          type="range"
          min={0}
          max={AUTONOMOUS_DELIVERY_STORY.length - 1}
          value={scrubberIndex}
          onChange={handleSliderChange}
          className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500 border border-slate-800"
        />

        {/* Phase Step Ticks */}
        <div className="flex justify-between text-[9px] text-slate-600 px-1">
          <span>01. Order</span>
          <span>06. Preflight</span>
          <span>09. Takeoff</span>
          <span>14. Obstacle</span>
          <span>19. Optical Lock</span>
          <span>22. Delivery</span>
          <span>26. Complete</span>
        </div>
      </div>

      {/* Reconstructed State Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">ALTITUDE AGL</span>
          <span className="text-base font-black text-emerald-400">{currentScene.altitude} m</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">GROUND SPEED</span>
          <span className="text-base font-black text-cyan-400">{currentScene.speed} km/h</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">BATTERY (SoC)</span>
          <span className="text-base font-black text-emerald-400">{currentScene.battery}%</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">ESC TEMP</span>
          <span className="text-base font-black text-amber-400">{currentScene.temperature}°C</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">DISTANCE TRAVELED</span>
          <span className="text-base font-black text-slate-200">{currentScene.distanceTraveledKm} km</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">PAYLOAD STATUS</span>
          <span className={`text-base font-black ${currentScene.payloadAttached ? 'text-cyan-400' : 'text-emerald-400'}`}>
            {currentScene.payloadAttached ? 'LOCKED (2.8kg)' : 'DELIVERED'}
          </span>
        </div>
      </div>

      {/* Snapshot Narrative Box */}
      <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
        <span className="text-[10px] text-slate-400 uppercase font-bold block">Historical Event Log:</span>
        <p className="text-[11px] text-slate-200 leading-relaxed font-mono">{currentScene.eventLog}</p>
        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{currentScene.explanation}</p>
      </div>
    </div>
  );
};
