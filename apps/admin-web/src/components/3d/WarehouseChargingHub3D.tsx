import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Package, BatteryCharging, Zap, Layers, RotateCcw, CheckCircle2, Bot } from 'lucide-react';

interface WarehouseChargingHub3DProps {
  className?: string;
  heightClass?: string;
}

export const WarehouseChargingHub3D: React.FC<WarehouseChargingHub3DProps> = ({
  className = '',
  heightClass = 'h-[440px]',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'warehouse' | 'charging'>('warehouse');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 440;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c16);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 4.5, 8.5);
    camera.lookAt(0, 0.5, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    dirLight.position.set(6, 12, 6);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const floorLight = new THREE.PointLight(0x06b6d4, 1.5, 6);
    floorLight.position.set(0, 0.5, 0);
    scene.add(floorLight);

    const hubGroup = new THREE.Group();
    scene.add(hubGroup);

    // 4. Floor Grid
    const floorGeo = new THREE.PlaneGeometry(16, 16);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    hubGroup.add(floor);

    const grid = new THREE.GridHelper(16, 16, 0x06b6d4, 0x1e293b);
    grid.position.y = 0.01;
    hubGroup.add(grid);

    // 5. Package Conveyor Belt System
    const beltGeo = new THREE.BoxGeometry(4.5, 0.15, 0.8);
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.set(-2, 0.4, 0);
    hubGroup.add(belt);

    // Conveyor Legs
    [-3.8, -2, -0.2].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), beltMat);
      leg.position.set(lx, 0.2, 0);
      hubGroup.add(leg);
    });

    // Optical Barcode Scanner Arch
    const archGeo = new THREE.BoxGeometry(0.12, 0.8, 1.0);
    const archMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.3 });
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.position.set(-2, 0.8, 0);
    hubGroup.add(arch);

    const scanLaser = new THREE.Mesh(
      new THREE.PlaneGeometry(0.02, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
    );
    scanLaser.position.set(-2, 0.8, 0);
    hubGroup.add(scanLaser);

    // Packages on Conveyor
    const packages: THREE.Mesh[] = [];
    [-3.2, -1.8, -0.4].forEach((px) => {
      const pGeo = new THREE.BoxGeometry(0.35, 0.25, 0.35);
      const pMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set(px, 0.6, 0);
      hubGroup.add(p);
      packages.push(p);
    });

    // 6. Launch Pad & Automated Charging Station
    const launchPad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.1, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 })
    );
    launchPad.position.set(2.4, 0.05, 0);
    hubGroup.add(launchPad);

    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.4, 32),
      new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.set(2.4, 0.11, 0);
    hubGroup.add(padRing);

    // 3D Drone Docked on Pad
    const drone = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.14, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 })
    );
    drone.position.set(2.4, 0.35, 0);
    hubGroup.add(drone);

    // Mouse Controls
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      hubGroup.rotation.y += dx * 0.006;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => (isDragging = false);

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      if (autoRotate && !isDragging) {
        hubGroup.rotation.y += delta * 0.1;
      }

      // Pulse Laser
      scanLaser.scale.y = 1.0 + Math.sin(time * 6) * 0.1;

      // Animate conveyor movement
      packages.forEach((p, idx) => {
        p.position.x += delta * 0.3;
        if (p.position.x > 0.4) p.position.x = -3.6;
      });

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 700;
      const h = container.clientHeight || 440;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [autoRotate]);

  return (
    <div className={`relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 shadow-2xl p-4 ${className}`}>
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 z-10 relative">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-slate-100 uppercase tracking-wide">
                3D WAREHOUSE CONVEYOR & FAST-CHARGE DOCK
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[9px] uppercase">
                ACTIVE PIPELINE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Automated barcode scanning ➔ Payload bay loading ➔ Fast-charge contact sync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRotate((p) => !p)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
              autoRotate ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle Hub Orbit"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className={`w-full ${heightClass} rounded-2xl cursor-grab active:cursor-grabbing relative overflow-hidden`} />

      {/* Process Step Breadcrumb */}
      <div className="flex items-center justify-between gap-2 pt-3 text-[11px] font-mono text-slate-400 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold">1. Ingest Order</span> ➔
          <span className="text-cyan-400 font-bold">2. Laser Scan</span> ➔
          <span className="text-emerald-400 font-bold">3. Auto-Load Locker</span> ➔
          <span className="text-slate-200 font-bold">4. Fast Charge (85 kW)</span> ➔
          <span className="text-cyan-400 font-bold">5. Launch (VTOL)</span>
        </div>
        <span className="text-emerald-400 font-bold flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Mission MS-10294
        </span>
      </div>
    </div>
  );
};
