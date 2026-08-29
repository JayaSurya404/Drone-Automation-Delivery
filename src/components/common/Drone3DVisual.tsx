import React, { useRef, useEffect, useState } from 'react';

interface Drone3DVisualProps {
  size?: number;
  hasCargo?: boolean;
  status?: 'idle' | 'preparing' | 'flying' | 'landing' | 'delivered';
  className?: string;
  enableParallax?: boolean;
}

export const Drone3DVisual: React.FC<Drone3DVisualProps> = ({
  size = 340,
  hasCargo = true,
  status = 'flying',
  className = '',
  enableParallax = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const isFlying = status === 'flying' || status === 'idle' || status === 'preparing';
  const isDelivered = status === 'delivered';

  // Subtle cursor-tracking parallax tilt
  useEffect(() => {
    if (!enableParallax) return;
    const handleMouseMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (window.innerWidth / 2);
      const dy = (e.clientY - cy) / (window.innerHeight / 2);
      setTilt({ x: dy * -6, y: dx * 6 });
    };
    const handleMouseLeave = () => setTilt({ x: 0, y: 0 });
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enableParallax]);

  return (
    <div
      ref={containerRef}
      className={`perspective-container ${className}`}
      style={{
        width: `${size}px`,
        height: `${size * 0.9}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* 3D Drone Body with parallax tilt */}
      <div
        className={isFlying ? 'animate-drone-hover' : ''}
        style={{
          width: `${size}px`,
          height: `${size * 0.75}px`,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'transform',
        }}
      >
        <svg
          viewBox="0 0 480 360"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
          aria-label="SkyLink delivery drone"
          role="img"
        >
          <defs>
            {/* Body gradient — top-lit white */}
            <linearGradient id="dv-bodyGrad" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="45%" stopColor="#f0f9ff" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>

            {/* Arm gradient — dark carbon */}
            <linearGradient id="dv-armGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>

            {/* Accent stripe */}
            <linearGradient id="dv-accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>

            {/* Cargo blue */}
            <linearGradient id="dv-cargoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>

            {/* Rotor disc cyan */}
            <radialGradient id="dv-rotorGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(14,165,233,0.35)" />
              <stop offset="100%" stopColor="rgba(14,165,233,0.05)" />
            </radialGradient>

            {/* Fuselage canopy */}
            <radialGradient id="dv-canopyGrad" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>

            {/* Soft drop shadow */}
            <filter id="dv-softShadow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#0f172a" floodOpacity="0.12" />
            </filter>

            {/* Sensor glow */}
            <filter id="dv-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Body shadow */}
            <filter id="dv-bodyShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="8" stdDeviation="8" floodColor="#0284c7" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* ── Carbon Arms ── */}
          <g filter="url(#dv-softShadow)">
            <line x1="115" y1="100" x2="365" y2="260" stroke="url(#dv-armGrad)" strokeWidth="13" strokeLinecap="round" />
            <line x1="365" y1="100" x2="115" y2="260" stroke="url(#dv-armGrad)" strokeWidth="13" strokeLinecap="round" />
            {/* Arm accent highlight */}
            <line x1="115" y1="98" x2="230" y2="172" stroke="rgba(148,163,184,0.25)" strokeWidth="4" strokeLinecap="round" />
            <line x1="365" y1="98" x2="250" y2="172" stroke="rgba(148,163,184,0.25)" strokeWidth="4" strokeLinecap="round" />
          </g>

          {/* ── Motor Pods & Rotors ── */}
          {/* Top-Left */}
          <g transform="translate(115, 100)">
            <circle cx="0" cy="0" r="18" fill="#1e293b" filter="url(#dv-softShadow)" />
            <circle cx="0" cy="0" r="10" fill="#0ea5e9" filter="url(#dv-glow)" opacity="0.9" />
            <circle cx="0" cy="0" r="5" fill="#ffffff" opacity="0.8" />
            <ellipse cx="0" cy="0" rx="56" ry="20" fill="url(#dv-rotorGrad)" stroke="rgba(14,165,233,0.45)" strokeWidth="1.5" className="animate-rotor" />
          </g>

          {/* Top-Right */}
          <g transform="translate(365, 100)">
            <circle cx="0" cy="0" r="18" fill="#1e293b" filter="url(#dv-softShadow)" />
            <circle cx="0" cy="0" r="10" fill="#0ea5e9" filter="url(#dv-glow)" opacity="0.9" />
            <circle cx="0" cy="0" r="5" fill="#ffffff" opacity="0.8" />
            <ellipse cx="0" cy="0" rx="56" ry="20" fill="url(#dv-rotorGrad)" stroke="rgba(14,165,233,0.45)" strokeWidth="1.5" className="animate-rotor" />
          </g>

          {/* Bottom-Left */}
          <g transform="translate(115, 260)">
            <circle cx="0" cy="0" r="18" fill="#1e293b" filter="url(#dv-softShadow)" />
            <circle cx="0" cy="0" r="10" fill="#10b981" filter="url(#dv-glow)" opacity="0.85" />
            <circle cx="0" cy="0" r="5" fill="#ffffff" opacity="0.8" />
            <ellipse cx="0" cy="0" rx="56" ry="20" fill="rgba(16,185,129,0.18)" stroke="rgba(16,185,129,0.45)" strokeWidth="1.5" className="animate-rotor" />
          </g>

          {/* Bottom-Right */}
          <g transform="translate(365, 260)">
            <circle cx="0" cy="0" r="18" fill="#1e293b" filter="url(#dv-softShadow)" />
            <circle cx="0" cy="0" r="10" fill="#10b981" filter="url(#dv-glow)" opacity="0.85" />
            <circle cx="0" cy="0" r="5" fill="#ffffff" opacity="0.8" />
            <ellipse cx="0" cy="0" rx="56" ry="20" fill="rgba(16,185,129,0.18)" stroke="rgba(16,185,129,0.45)" strokeWidth="1.5" className="animate-rotor" />
          </g>

          {/* ── Cargo Pod ── */}
          {hasCargo && !isDelivered && (
            <g transform="translate(188, 200)" filter="url(#dv-bodyShadow)">
              {/* Suspension cable */}
              <path d="M26 0 L26 -10 L78 -10 L78 0" stroke="rgba(148,163,184,0.8)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {/* Cargo box */}
              <rect x="0" y="0" width="104" height="60" rx="10" fill="url(#dv-cargoGrad)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
              {/* Top face highlight */}
              <rect x="0" y="0" width="104" height="20" rx="10" fill="rgba(255,255,255,0.12)" />
              {/* SkyLink logo circle */}
              <circle cx="52" cy="32" r="14" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              {/* "S" symbol */}
              <text x="52" y="37" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="system-ui">S</text>
              {/* Corner LEDs */}
              <circle cx="12" cy="12" r="3" fill="#0ea5e9" opacity="0.8" filter="url(#dv-glow)" />
              <circle cx="92" cy="12" r="3" fill="#10b981" opacity="0.8" filter="url(#dv-glow)" />
            </g>
          )}

          {/* ── Central Fuselage ── */}
          <g filter="url(#dv-bodyShadow)">
            {/* Main shell */}
            <path
              d="M178 180 C178 140 196 122 240 120 C284 122 302 140 302 180 C302 220 284 238 240 238 C196 238 178 220 178 180 Z"
              fill="url(#dv-bodyGrad)"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="2.5"
            />

            {/* Aerodynamic ridge line */}
            <path
              d="M195 178 L285 178"
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Canopy dome */}
            <ellipse
              cx="240"
              cy="168"
              rx="46"
              ry="34"
              fill="url(#dv-canopyGrad)"
            />

            {/* Canopy glass reflection */}
            <ellipse
              cx="228"
              cy="158"
              rx="18"
              ry="12"
              fill="rgba(255,255,255,0.08)"
              transform="rotate(-15, 228, 158)"
            />

            {/* Front sensor bar glow */}
            <path
              d="M212 165 Q240 160 268 165"
              stroke="#0ea5e9"
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#dv-glow)"
            />

            {/* Dual optical sensors */}
            <circle cx="226" cy="178" r="5.5" fill="#0ea5e9" filter="url(#dv-glow)" />
            <circle cx="254" cy="178" r="5.5" fill="#0ea5e9" filter="url(#dv-glow)" />

            {/* Bottom accent stripe */}
            <path
              d="M196 222 Q240 230 284 222"
              stroke="url(#dv-accentGrad)"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Side SkyLink logo */}
            <circle cx="240" cy="198" r="10" fill="rgba(14,165,233,0.1)" stroke="rgba(14,165,233,0.3)" strokeWidth="1" />
            <text x="240" y="202" textAnchor="middle" fill="#0284c7" fontSize="9" fontWeight="800" fontFamily="system-ui">SL</text>
          </g>

          {/* ── LED Status Indicator ── */}
          {isFlying && (
            <g>
              <circle cx="240" cy="120" r="4" fill="#0ea5e9" filter="url(#dv-glow)" opacity="0.9">
                <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.2s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* ── Delivered checkmark ── */}
          {isDelivered && (
            <g transform="translate(195, 130)">
              <circle cx="45" cy="45" r="40" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth="2.5" />
              <path d="M25 45 L38 58 L65 32" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          )}
        </svg>
      </div>

      {/* Dynamic Ground Shadow */}
      <div
        className="animate-shadow-pulse"
        style={{
          width: `${size * 0.65}px`,
          height: '18px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(2, 132, 199, 0.2) 0%, rgba(15, 23, 42, 0.08) 40%, transparent 75%)',
          marginTop: '-16px',
          flexShrink: 0,
        }}
      />
    </div>
  );
};
