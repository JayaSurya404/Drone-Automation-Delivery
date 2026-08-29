import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Radio, Compass, ShieldCheck, Activity, Plane } from 'lucide-react';

export const RealisticDroneHero: React.FC = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Subtle cursor tracking 3D tilt
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (window.innerWidth / 2);
      const dy = (e.clientY - cy) / (window.innerHeight / 2);
      setTilt({ x: dy * -8, y: dx * 8 });
    };

    const handleMouseLeave = () => {
      setTilt({ x: 0, y: 0 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="realistic-hero-stage" ref={containerRef}>
      {/* ── High-Tech Radar Ring & Compass Background ── */}
      <div className="drone-hud-radar-circle">
        <div className="radar-grid-line line-h" />
        <div className="radar-grid-line line-v" />
        <div className="radar-sweep-beam" />
        <div className="radar-coordinates-tag">
          <Radio size={11} className="pulse-ping" /> 37°46'29"N · 122°25'10"W
        </div>
      </div>

      {/* ── Telemetry HUD Stats Pill (Top Right) ── */}
      <div className="drone-telemetry-hud-card">
        <div className="telemetry-item">
          <Activity size={13} color="#0ea5e9" />
          <span>Air Speed: <strong>64 km/h</strong></span>
        </div>
        <div className="telemetry-item">
          <ShieldCheck size={13} color="#10b981" />
          <span>Sonar Drop: <strong>Active</strong></span>
        </div>
      </div>

      {/* ── Realistic 3D Drone Core Image with 3D Tilt ── */}
      <div
        className="realistic-drone-core-wrap"
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        <img
          src="/drone_hero.jpg"
          alt="SkyLink Autonomous Delivery Drone"
          className="realistic-drone-photo"
        />

        {/* Dynamic Soft Aerodynamic Shadow */}
        <div className="realistic-drone-shadow" />
      </div>

      {/* ── Floating Product Card 1: Truffle Pizza ── */}
      <div
        className="hero-floating-card card-top-left"
        onClick={() => navigate('/products/prod_food_1')}
        title="View Artisan Truffle Pizza"
      >
        <img
          src="https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&auto=format&fit=crop&q=80"
          alt="Truffle Pizza"
          className="floating-card-thumb"
        />
        <div className="floating-card-info">
          <span className="floating-card-title">Artisan Truffle Pizza</span>
          <div className="floating-card-meta">
            <span className="floating-price">$21.99</span>
            <span className="floating-eta">
              <Zap size={10} fill="#0284c7" color="#0284c7" /> 14 min air
            </span>
          </div>
        </div>
      </div>

      {/* ── Floating Product Card 2: Fast GaN Charger ── */}
      <div
        className="hero-floating-card card-bottom-right"
        onClick={() => navigate('/products/prod_elec_1')}
        title="View VoltWave 100W GaN"
      >
        <img
          src="https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=200&auto=format&fit=crop&q=80"
          alt="GaN Charger"
          className="floating-card-thumb"
        />
        <div className="floating-card-info">
          <span className="floating-card-title">VoltWave 100W GaN</span>
          <div className="floating-card-meta">
            <span className="floating-price">$39.99</span>
            <span className="floating-badge">IN STOCK</span>
          </div>
        </div>
      </div>

      {/* ── Floating Corridor Altitude Status Pill (Bottom Center) ── */}
      <div className="hero-floating-status-pill">
        <span className="status-indicator-dot" />
        <span>Skyway Alpha-7 Corridor · 120m Cruise Altitude</span>
      </div>
    </div>
  );
};
