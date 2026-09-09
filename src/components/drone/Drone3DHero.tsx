import React, { useState } from 'react';
import { getDroneModelInfo } from './DroneVisual';
import { Battery, Radio, Gauge, Compass } from 'lucide-react';

interface Drone3DHeroProps {
  status?: string;
  battery?: number;
  altitude?: number;
  speed?: number;
  model?: string;
  id?: string;
  className?: string;
}

export const Drone3DHero: React.FC<Drone3DHeroProps> = ({
  status = 'IN FLIGHT',
  battery = 78,
  altitude = 82,
  speed = 34,
  model = 'SKYNAV X1',
  id = 'D-024',
  className = '',
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const modelInfo = getDroneModelInfo(model);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePos({ x: 0, y: 0 });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full max-w-lg h-80 rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 shadow-2xl p-4 flex items-center justify-center perspective-1000 group ${className}`}
    >
      {/* Background Lighting & Radial Glow */}
      <div className="absolute inset-0 bg-radial-gradient from-cyan-500/15 via-blue-600/5 to-transparent rounded-3xl blur-2xl pointer-events-none" />
      
      {/* Ambient Floor Reflection & Radar Scanning Ring */}
      <div className="absolute bottom-4 w-72 h-20 rounded-full border border-cyan-500/20 bg-cyan-500/5 transform rotate-x-60 pointer-events-none flex items-center justify-center">
        <div className="w-52 h-14 rounded-full border border-dashed border-cyan-400/30 animate-pulse" />
        <div className="absolute w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
      </div>

      {/* 3D Commercial Drone Model Visual */}
      <div
        className="relative z-10 w-64 h-48 sm:w-80 sm:h-56 transition-transform duration-300 ease-out preserve-3d flex items-center justify-center"
        style={{
          transform: isHovered
            ? `rotateY(${mousePos.x}deg) rotateX(${mousePos.y}deg) translateY(-8px) scale(1.04)`
            : 'rotateY(0deg) rotateX(0deg) translateY(0px) scale(1)',
        }}
      >
        <img
          src={modelInfo.image}
          alt={modelInfo.name}
          className="w-full h-full object-contain filter drop-shadow-[0_20px_35px_rgba(6,182,212,0.35)] transition-all duration-500"
        />
      </div>

      {/* Floating Telemetry Glass Badges */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 text-xs text-slate-200 shadow-xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono font-bold text-cyan-400">{id} • {status}</span>
      </div>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 text-xs text-slate-200 shadow-xl">
        <Battery className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] text-slate-400 font-mono">BATTERY</span>
        <span className="font-mono font-bold text-emerald-400">{battery}%</span>
      </div>

      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 text-xs text-slate-200 shadow-xl">
        <Gauge className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[10px] text-slate-400 font-mono">ALTITUDE</span>
        <span className="font-mono font-bold text-cyan-300">{altitude} m</span>
      </div>

      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 text-xs text-slate-200 shadow-xl">
        <Compass className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-[10px] text-slate-400 font-mono">SPEED</span>
        <span className="font-mono font-bold text-blue-300">{speed} km/h</span>
      </div>
    </div>
  );
};
