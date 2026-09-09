import React from 'react';
import { StoryScene } from './simulationStories';
import {
  Crosshair,
  Compass,
  Radio,
  Wifi,
  Battery,
  ShieldCheck,
  AlertTriangle,
  Camera,
  Activity,
} from 'lucide-react';

interface SimulatedDroneCameraHUDProps {
  scene: StoryScene;
  isObstacleAlert: boolean;
}

export const SimulatedDroneCameraHUD: React.FC<SimulatedDroneCameraHUDProps> = ({
  scene,
  isObstacleAlert,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 font-mono select-none text-cyan-400 text-xs z-20">
      {/* 1. Top HUD Header: Camera Banner, Heading Tape & Rec Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/40 shadow-lg">
          <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="font-bold text-slate-100 tracking-wider text-[11px]">REC • LIVE FPV</span>
          <span className="text-[10px] text-cyan-300 font-bold px-1.5 py-0.2 rounded bg-cyan-500/20">
            SIMULATED DRONE CAMERA
          </span>
        </div>

        {/* Heading Compass Tape */}
        <div className="hidden sm:flex items-center gap-3 bg-slate-950/80 backdrop-blur-md px-4 py-1.5 rounded-xl border border-cyan-500/40">
          <Compass className="w-4 h-4 text-cyan-400" />
          <div className="flex items-center gap-2 text-xs font-black tracking-widest text-slate-100">
            <span>NW</span>
            <span className="text-cyan-400 font-mono">|</span>
            <span className="text-cyan-300 font-mono text-sm">{scene.heading.toString().padStart(3, '0')}°</span>
            <span className="text-cyan-400 font-mono">|</span>
            <span>N</span>
          </div>
        </div>

        {/* RTK Lock & 5G Link */}
        <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/40">
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
            <Radio className="w-3.5 h-3.5" /> RTK FIX (28 SAT)
          </span>
          <span className="text-slate-400">|</span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
            <Wifi className="w-3.5 h-3.5" /> 5G {-scene.signalRssi} dBm
          </span>
        </div>
      </div>

      {/* 2. Center Reticle & Artificial Horizon Pitch Ladder */}
      <div className="relative flex-1 flex items-center justify-center">
        {/* Pitch Ladder Lines */}
        <div className="absolute w-44 h-24 border-t border-b border-cyan-500/30 flex flex-col justify-between items-center opacity-70">
          <div className="w-24 border-t border-cyan-400/50 flex justify-between text-[9px] text-cyan-300">
            <span>+10°</span>
            <span>+10°</span>
          </div>
          <div className="w-36 border-t-2 border-cyan-400/80 flex justify-between text-[10px] text-cyan-200 font-bold">
            <span>--- 0° HORIZON ---</span>
          </div>
          <div className="w-24 border-t border-cyan-400/50 flex justify-between text-[9px] text-cyan-300">
            <span>-10°</span>
            <span>-10°</span>
          </div>
        </div>

        {/* Crosshair Center */}
        <div className="relative">
          <Crosshair className="w-12 h-12 text-cyan-400/80 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
          </div>
        </div>

        {/* Left Airspeed Tape */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-slate-950/80 backdrop-blur-md p-2.5 rounded-2xl border border-cyan-500/40 text-center space-y-1 shadow-lg">
          <span className="text-[9px] text-slate-400 font-bold block uppercase">AIRSPEED</span>
          <p className="text-lg font-black text-cyan-300">{scene.speed}</p>
          <span className="text-[9px] text-cyan-500 font-bold block">KM/H</span>
        </div>

        {/* Right Altitude Tape */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-950/80 backdrop-blur-md p-2.5 rounded-2xl border border-cyan-500/40 text-center space-y-1 shadow-lg">
          <span className="text-[9px] text-slate-400 font-bold block uppercase">ALTITUDE</span>
          <p className="text-lg font-black text-emerald-400">{scene.altitude}</p>
          <span className="text-[9px] text-emerald-500 font-bold block">METERS AGL</span>
        </div>

        {/* Obstacle Collision Warning Overlay */}
        {(isObstacleAlert || scene.isObstaclePresent) && (
          <div className="absolute top-12 flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-500/20 border border-rose-500/80 backdrop-blur-md text-rose-400 font-bold shadow-2xl animate-pulse">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <div>
              <span className="block text-xs uppercase tracking-widest font-black">COLLISION PROXIMITY ALERT</span>
              <span className="text-[10px] text-rose-200">Obstacle in Corridor • Autopilot Reroute Engaged</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom HUD Status Bar: Battery, Temperature, Mission, Flight Phase */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-cyan-500/40 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Battery className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-bold">BAT:</span>
            <span className="text-emerald-400 font-black">{scene.battery}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-300 font-bold">TEMP:</span>
            <span className="text-cyan-300 font-black">{scene.temperature}°C</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-slate-300 font-bold">PAYLOAD:</span>
            <span className="text-slate-100 font-black">{scene.payloadAttached ? '2.8 kg (Secured)' : 'DELIVERED'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400 uppercase">FLIGHT MODE:</span>
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-black text-[10px] uppercase tracking-wider">
            ● AUTONOMOUS {scene.flightPhase.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
};
