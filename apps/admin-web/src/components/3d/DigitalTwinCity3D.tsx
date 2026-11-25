import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Building2, Navigation, Layers, ShieldCheck, MapPin, Eye, RotateCcw } from 'lucide-react';

interface DigitalTwinCity3DProps {
  className?: string;
  heightClass?: string;
}

export const DigitalTwinCity3D: React.FC<DigitalTwinCity3DProps> = ({
  className = '',
  heightClass = 'h-[460px]',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeLayer, setActiveLayer] = useState<'all' | 'corridors' | 'restricted' | 'hubs'>('all');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 460;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(10, 8, 12);
    camera.lookAt(0, 0, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.0);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    sunLight.position.set(12, 20, 10);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const cityGroup = new THREE.Group();
    scene.add(cityGroup);

    // 4. Ground Terrain & Road Grid
    const groundGeo = new THREE.PlaneGeometry(32, 32);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x09101d, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    cityGroup.add(ground);

    const roadGrid = new THREE.GridHelper(32, 32, 0x0284c7, 0x1e293b);
    roadGrid.position.y = 0.01;
    cityGroup.add(roadGrid);

    // 5. Procedural 3D City Buildings
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.7,
    });
    const glassMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });

    const buildingBlocks = [
      { x: -5, z: -5, w: 2.2, d: 2.2, h: 3.5 },
      { x: -5, z: -2, w: 1.8, d: 1.8, h: 4.8 },
      { x: -5, z: 2, w: 2.0, d: 2.0, h: 2.8 },
      { x: -5, z: 5, w: 1.6, d: 2.2, h: 5.2 },
      { x: -2, z: -5, w: 1.8, d: 2.2, h: 4.2 },
      { x: -2, z: 5, w: 2.4, d: 1.8, h: 3.0 },
      { x: 2, z: -5, w: 2.0, d: 2.0, h: 5.6 },
      { x: 2, z: 5, w: 2.2, d: 2.0, h: 3.8 },
      { x: 5, z: -5, w: 1.8, d: 1.8, h: 3.2 },
      { x: 5, z: -2, w: 2.0, d: 2.0, h: 4.6 },
      { x: 5, z: 2, w: 1.8, d: 2.2, h: 5.0 },
      { x: 5, z: 5, w: 2.2, d: 2.0, h: 2.6 },
    ];

    buildingBlocks.forEach((b) => {
      const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const bMesh = new THREE.Mesh(bGeo, buildingMat);
      bMesh.position.set(b.x, b.h / 2, b.z);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      cityGroup.add(bMesh);

      // Wireframe building edge glow
      const wire = new THREE.Mesh(bGeo, glassMat);
      wire.position.set(b.x, b.h / 2, b.z);
      cityGroup.add(wire);
    });

    // 6. Hub Launch Pads (Central Warehouse Hub + Customer Drop Pad)
    const hubPositions = [
      { x: 0, z: -1.5, label: 'Coimbatore HQ Pad', color: 0x06b6d4 },
      { x: 0, z: 2.5, label: 'RS Puram Customer Drop', color: 0x10b981 },
      { x: -2.5, z: 0, label: 'KMCH Care Center', color: 0xef4444 },
    ];

    hubPositions.forEach((h) => {
      const padGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.1, 32);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5 });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set(h.x, 0.05, h.z);
      cityGroup.add(padMesh);

      const ringGeo = new THREE.RingGeometry(1.1, 1.2, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: h.color, side: THREE.DoubleSide });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(h.x, 0.11, h.z);
      cityGroup.add(ringMesh);

      const spot = new THREE.PointLight(h.color, 2.0, 5);
      spot.position.set(h.x, 1.5, h.z);
      cityGroup.add(spot);
    });

    // 7. Active 3D Flight Corridor Tube (Glowing curve through the city)
    const corridorCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.5, -1.5),
      new THREE.Vector3(0, 3.5, -0.5),
      new THREE.Vector3(-1.2, 4.2, 0.5),
      new THREE.Vector3(0, 3.2, 1.8),
      new THREE.Vector3(0, 0.5, 2.5),
    ]);
    const tubeGeo = new THREE.TubeGeometry(corridorCurve, 40, 0.25, 12, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    cityGroup.add(tubeMesh);

    // 8. Restricted Airspace Cylinder (Airport / High-Security Dome)
    const restrictedGeo = new THREE.CylinderGeometry(2.2, 2.2, 5, 24, 1, true);
    const restrictedMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const restrictedMesh = new THREE.Mesh(restrictedGeo, restrictedMat);
    restrictedMesh.position.set(3.5, 2.5, 0);
    cityGroup.add(restrictedMesh);

    // 9. Active Airborne Drone along Corridor
    const droneMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.08, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.2, metalness: 0.8, emissive: 0x06b6d4, emissiveIntensity: 0.4 })
    );
    cityGroup.add(droneMesh);

    // Mouse Interaction
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
      cityGroup.rotation.y += dx * 0.006;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => (isDragging = false);

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation Loop
    let animId: number;
    let progress = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (autoRotate && !isDragging) {
        cityGroup.rotation.y += delta * 0.08;
      }

      // Animate drone along corridor curve
      progress = (progress + delta * 0.12) % 1.0;
      const pt = corridorCurve.getPoint(progress);
      const tangent = corridorCurve.getTangent(progress);
      droneMesh.position.copy(pt);
      droneMesh.lookAt(pt.clone().add(tangent));

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 460;
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
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 z-10 relative">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-slate-100 uppercase tracking-wide">
                3D DIGITAL TWIN CITY & CORRIDOR TOPOLOGY
              </span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-[9px] uppercase">
                COIMBATORE URBAN TWIN
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              High-fidelity structural buildings, active corridor tubes, and no-fly safety cylinders
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRotate((p) => !p)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
              autoRotate ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle City Orbit"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className={`w-full ${heightClass} rounded-2xl cursor-grab active:cursor-grabbing relative overflow-hidden`} />

      {/* Footer Info Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Active Flight Tube</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Precision Drop Pad</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Restricted Airspace Cylinder</span>
        </div>
        <span className="text-[10px]">DGCA Geospatial Elevation Map Active</span>
      </div>
    </div>
  );
};
