import React, { useState } from 'react';
import { DroneStatus } from '../../types/skynav';
import { Battery, ShieldCheck, Zap, Radio } from 'lucide-react';

export const DRONE_MODEL_ASSETS: Record<string, { image: string; name: string; type: string; payload: string; maxRange: string; speed: string }> = {
  'SKYNAV X1': {
    image: '/assets/drones/skynav_x1.jpg',
    name: 'SKYNAV X1',
    type: 'Autonomous Urban Courier',
    payload: '2.5 kg',
    maxRange: '28 km',
    speed: '45 km/h',
  },
  'SKYNAV X2': {
    image: '/assets/drones/skynav_x2.jpg',
    name: 'SKYNAV X2',
    type: 'Hexacopter Express Logistics',
    payload: '4.5 kg',
    maxRange: '35 km',
    speed: '55 km/h',
  },
  'SKYNAV Cargo': {
    image: '/assets/drones/skynav_cargo.jpg',
    name: 'SKYNAV Cargo',
    type: 'Heavy-Duty Modular Octocopter',
    payload: '8.5 kg',
    maxRange: '40 km',
    speed: '50 km/h',
  },
  'SKYNAV VTOL': {
    image: '/assets/drones/skynav_vtol.jpg',
    name: 'SKYNAV VTOL',
    type: 'Long-Range Fixed-Wing Tilt-Rotor',
    payload: '5.0 kg',
    maxRange: '75 km',
    speed: '85 km/h',
  },
  'SKYNAV Heavy Cargo': {
    image: '/assets/drones/skynav_heavy_cargo.jpg',
    name: 'SKYNAV Heavy Cargo',
    type: 'Industrial Tethered Winch Transport',
    payload: '15.0 kg',
    maxRange: '30 km',
    speed: '40 km/h',
  },
};

export const getDroneModelInfo = (modelName?: string) => {
  if (!modelName) return DRONE_MODEL_ASSETS['SKYNAV X1'];
  const key = Object.keys(DRONE_MODEL_ASSETS).find((k) =>
    modelName.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(modelName.toLowerCase())
  );
  return key ? DRONE_MODEL_ASSETS[key] : DRONE_MODEL_ASSETS['SKYNAV X1'];
};

interface DroneVisualProps {
  model?: string;
  id?: string;
  status?: DroneStatus | string;
  battery?: number;
  health?: number;
  payload?: number;
  missionId?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero' | 'full';
  showSpecs?: boolean;
  className?: string;
  interactive?: boolean;
}

export const DroneVisual: React.FC<DroneVisualProps> = ({
  model = 'SKYNAV X1',
  id,
  status,
  battery,
  health,
  payload,
  missionId,
  size = 'md',
  showSpecs = false,
  className = '',
  interactive = true,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const modelInfo = getDroneModelInfo(model);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -16;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePos({ x: 0, y: 0 });
  };

  const sizeHeights = {
    sm: 'h-36',
    md: 'h-48',
    lg: 'h-64',
    hero: 'h-80',
    full: 'h-full min-h-[220px]',
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full ${sizeHeights[size]} rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80 shadow-inner group perspective-1000 ${className}`}
    >
      {/* Dynamic Background Light Cone / Glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-cyan-500/10 pointer-events-none z-10" />
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-3/4 h-28 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />

      {/* 3D Transform Container */}
      <div
        className="w-full h-full relative z-0 transition-transform duration-300 ease-out preserve-3d flex items-center justify-center"
        style={{
          transform: isHovered
            ? `rotateY(${mousePos.x}deg) rotateX(${mousePos.y}deg) scale(1.03)`
            : 'rotateY(0deg) rotateX(0deg) scale(1)',
        }}
      >
        {!imageError ? (
          <img
            src={modelInfo.image}
            alt={modelInfo.name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-center filter brightness-[0.98] contrast-[1.05] transition-all duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          /* High-Fidelity SVG Fallback if Image Fails to Load */
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-900 text-cyan-400">
            <Radio className="w-12 h-12 text-cyan-400 animate-pulse mb-2" />
            <span className="font-mono text-xs font-bold uppercase">{modelInfo.name}</span>
            <span className="text-[10px] text-slate-400">{modelInfo.type}</span>
          </div>
        )}
      </div>

      {/* Top Model Badge & ID */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-700 text-[10px] font-mono font-bold text-cyan-400 shadow-md">
          {id || modelInfo.name}
        </span>
        {status && (
          <span
            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider backdrop-blur-md border shadow-sm ${
              status === 'in_flight'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                : status === 'available'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : status === 'charging'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : status === 'emergency'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-ping'
                : 'bg-slate-800/80 text-slate-300 border-slate-700'
            }`}
          >
            ● {String(status).replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Specs Overlay (if requested) */}
      {showSpecs && (
        <div className="absolute bottom-3 left-3 right-3 z-20 grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[10px] text-slate-300">
          <div className="flex items-center gap-1">
            <Battery className="w-3 h-3 text-cyan-400" />
            <span>{battery !== undefined ? `${battery}%` : '88%'}</span>
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>{health !== undefined ? `${health}%` : '96%'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>{payload !== undefined ? `${payload} kg` : modelInfo.payload}</span>
          </div>
        </div>
      )}

      {/* Bottom Floating Mission Tag */}
      {missionId && !showSpecs && (
        <div className="absolute bottom-2.5 right-2.5 z-20 px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[9px] font-mono text-slate-400 backdrop-blur-md">
          Mission: <span className="text-cyan-300 font-bold">{missionId}</span>
        </div>
      )}
    </div>
  );
};
