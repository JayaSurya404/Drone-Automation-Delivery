import React, { useState } from 'react';
import { PlaneTakeoff, Sparkles, CheckCircle2, Shield, Battery, Gauge, Scale } from 'lucide-react';

interface RealDroneGalleryProps {
  onDroneTouch?: () => void;
  className?: string;
}

export const REAL_DRONE_MODELS = [
  {
    image: '/assets/drones/skynav_x1.jpg',
    model: 'SKYNAV X1',
    name: 'Autonomous Urban Courier',
    payload: '2.5 kg',
    speed: '45 km/h',
    range: '22 km',
    type: 'Quadcopter',
    badge: 'Express Logistics',
  },
  {
    image: '/assets/drones/skynav_vtol.jpg',
    model: 'SKYNAV VTOL',
    name: 'Long-Range Tilt-Rotor',
    payload: '5.0 kg',
    speed: '85 km/h',
    range: '65 km',
    type: 'Hybrid VTOL',
    badge: 'Regional Medical Corridor',
  },
  {
    image: '/assets/drones/skynav_cargo.jpg',
    model: 'SKYNAV Cargo',
    name: 'Heavy-Duty Freight Carrier',
    payload: '8.5 kg',
    speed: '50 km/h',
    range: '35 km',
    type: 'Octocopter',
    badge: 'Industrial Multi-Pod',
  },
  {
    image: '/assets/drones/skynav_heavy_cargo.jpg',
    model: 'SKYNAV Heavy Cargo',
    name: 'Industrial Tethered Transport',
    payload: '15.0 kg',
    speed: '38 km/h',
    range: '28 km',
    type: 'Heavy Multi-Rotor',
    badge: 'High-Capacity Cargo',
  },
];

export const RealDroneGallery: React.FC<RealDroneGalleryProps> = ({ onDroneTouch, className = '' }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isTouched, setIsTouched] = useState(false);
  const [imageError, setImageError] = useState(false);

  const currentDrone = REAL_DRONE_MODELS[activeIdx];

  const handleTouch = () => {
    setIsTouched(true);
    setTimeout(() => setIsTouched(false), 800);
    if (onDroneTouch) {
      onDroneTouch();
    }
  };

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {/* 3D Glassmorphism Frame Container */}
      <div
        onClick={handleTouch}
        className={`relative w-full max-w-lg rounded-3xl overflow-hidden cursor-pointer group transition-all duration-500 transform ${
          isTouched
            ? 'scale-105 rotate-x-12 rotate-y-6 shadow-[0_25px_60px_rgba(6,182,212,0.5)]'
            : 'hover:scale-[1.02] hover:-translate-y-1 shadow-2xl'
        } border border-slate-700/60 bg-slate-900/90 backdrop-blur-xl`}
      >
        {/* Real Commercial Drone Photo */}
        <div className="relative h-72 w-full overflow-hidden bg-slate-950">
          {!imageError ? (
            <img
              src={currentDrone.image}
              alt={currentDrone.name}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-cyan-400 p-6 space-y-2">
              <PlaneTakeoff className="w-16 h-16 animate-pulse" />
              <p className="font-bold text-sm text-slate-100">{currentDrone.model}</p>
              <p className="text-xs text-slate-400">{currentDrone.name}</p>
            </div>
          )}

          {/* Ambient Dark Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

          {/* Top Status & Model Badge */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-full px-3 py-1 text-xs flex items-center gap-2 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-mono text-[10px] font-bold text-cyan-400 uppercase">
                {currentDrone.badge}
              </span>
            </div>

            <div className="bg-cyan-500/20 backdrop-blur-md border border-cyan-500/40 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-black text-cyan-300">
              {currentDrone.model}
            </div>
          </div>

          {/* Interactive Touch Prompt */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/40 backdrop-blur-xs">
            <div className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xl shadow-cyan-500/40 animate-pulse">
              <Sparkles className="w-4 h-4" /> Touch Drone To Auto-Fill Sign In
            </div>
          </div>

          {/* Bottom Drone Telemetry Specs */}
          <div className="absolute bottom-4 left-4 right-4 text-slate-100 space-y-2">
            <div>
              <h4 className="text-base font-black text-white drop-shadow-md">{currentDrone.name}</h4>
              <p className="text-[11px] text-cyan-300 font-mono">{currentDrone.type} Commercial Platform</p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700/60 text-[10px] font-mono text-slate-300">
              <div className="flex items-center gap-1 bg-slate-950/70 rounded-lg p-1 px-2 border border-slate-800">
                <Scale className="w-3 h-3 text-cyan-400" />
                <span>Max: {currentDrone.payload}</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-950/70 rounded-lg p-1 px-2 border border-slate-800">
                <Gauge className="w-3 h-3 text-amber-400" />
                <span>Spd: {currentDrone.speed}</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-950/70 rounded-lg p-1 px-2 border border-slate-800">
                <Battery className="w-3 h-3 text-emerald-400" />
                <span>Rng: {currentDrone.range}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Model Selector */}
        <div className="p-3 bg-slate-900/95 border-t border-slate-800 grid grid-cols-4 gap-1.5">
          {REAL_DRONE_MODELS.map((d, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIdx(idx);
                setImageError(false);
              }}
              className={`py-1.5 px-2 rounded-xl text-[10px] font-mono font-bold transition-all border text-center ${
                activeIdx === idx
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-md shadow-cyan-500/10'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {d.model.replace('SKYNAV ', '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
