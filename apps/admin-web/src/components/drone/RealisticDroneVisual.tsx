import React from 'react';

interface RealisticDroneVisualProps {
  status?: string;
  battery?: number;
  model?: string;
  id?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RealisticDroneVisual: React.FC<RealisticDroneVisualProps> = ({
  status = 'IN FLIGHT',
  battery = 84,
  model = 'SKYNAV-X1',
  id = 'D-024',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-40 h-28',
    md: 'w-64 h-44',
    lg: 'w-80 h-56',
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Background Radial Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* SVG Realistic Commercial Delivery Hexacopter */}
      <svg viewBox="0 0 320 220" className={`${sizeClasses[size]} drop-shadow-[0_12px_24px_rgba(2,132,199,0.3)]`}>
        <defs>
          <linearGradient id="fuselage" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="payloadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="arm" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Shadow Ground Ellipse */}
        <ellipse cx="160" cy="205" rx="90" ry="10" fill="#000000" opacity="0.35" className="animate-pulse" />

        {/* Hexacopter Carbon Structural Arms */}
        <line x1="60" y1="50" x2="160" y2="110" stroke="url(#arm)" strokeWidth="7" strokeLinecap="round" />
        <line x1="260" y1="50" x2="160" y2="110" stroke="url(#arm)" strokeWidth="7" strokeLinecap="round" />
        <line x1="40" y1="110" x2="160" y2="110" stroke="url(#arm)" strokeWidth="8" strokeLinecap="round" />
        <line x1="280" y1="110" x2="160" y2="110" stroke="url(#arm)" strokeWidth="8" strokeLinecap="round" />
        <line x1="60" y1="170" x2="160" y2="110" stroke="url(#arm)" strokeWidth="7" strokeLinecap="round" />
        <line x1="260" y1="170" x2="160" y2="110" stroke="url(#arm)" strokeWidth="7" strokeLinecap="round" />

        {/* Rotor Assemblies */}
        {[
          { cx: 60, cy: 50 },
          { cx: 260, cy: 50 },
          { cx: 40, cy: 110 },
          { cx: 280, cy: 110 },
          { cx: 60, cy: 170 },
          { cx: 260, cy: 170 },
        ].map((r, i) => (
          <g key={i} transform={`translate(${r.cx}, ${r.cy})`}>
            {/* Spinning Rotor Disc */}
            <circle cx="0" cy="0" r="28" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" className="animate-spin origin-center" style={{ animationDuration: `${0.4 + i * 0.05}s` }} />
            <ellipse cx="0" cy="0" rx="26" ry="5" fill="#38bdf8" opacity="0.6" className="animate-spin origin-center" style={{ animationDuration: `${0.3 + i * 0.04}s` }} />
            {/* Rotor Hub */}
            <circle cx="0" cy="0" r="7" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
          </g>
        ))}

        {/* Main Aerodynamic Chassis Body */}
        <polygon points="120,70 200,70 220,110 200,145 120,145 100,110" fill="url(#fuselage)" stroke="#38bdf8" strokeWidth="2" />
        
        {/* Cockpit Canopy Glass Cover */}
        <path d="M 125 80 L 195 80 C 205 90 205 105 195 110 L 125 110 C 115 105 115 90 125 80 Z" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
        
        {/* Optical Sensor Dome & Gimbal */}
        <circle cx="160" cy="125" r="9" fill="#0284c7" opacity="0.9" filter="url(#glow)" />
        <circle cx="160" cy="125" r="4" fill="#ffffff" />

        {/* Secure Autonomous Cargo Payload Bay */}
        <rect x="135" y="145" width="50" height="30" rx="5" fill="url(#payloadGrad)" stroke="#38bdf8" strokeWidth="1.5" />
        <text x="160" y="164" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">
          SKYNAV
        </text>

        {/* Status LED Lights */}
        <circle cx="40" cy="110" r="3" fill="#ef4444" className="animate-ping" />
        <circle cx="280" cy="110" r="3" fill="#10b981" className="animate-ping" />
      </svg>
    </div>
  );
};
