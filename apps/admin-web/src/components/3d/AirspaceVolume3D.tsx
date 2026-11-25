import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Layers, ShieldCheck, Radio, AlertTriangle, Wind, Compass, Bot, CheckCircle2, RotateCcw } from 'lucide-react';

interface AirspaceDrone {
  id: string;
  altitudeM: number;
  speedKmH: number;
  corridor: string;
  status: 'nominal' | 'diverted' | 'caution';
  heading: number;
  x: number;
  z: number;
}

export const AIRSPACE_DRONES_DATA: AirspaceDrone[] = [
  { id: 'D-024', altitudeM: 120, speedKmH: 48, corridor: 'Peelamedu Tech Alpha', status: 'nominal', heading: 45, x: -1.8, z: -0.5 },
  { id: 'D-018', altitudeM: 100, speedKmH: 42, corridor: 'RS Puram Express Bravo', status: 'nominal', heading: 90, x: 0.5, z: -1.2 },
  { id: 'D-031', altitudeM: 80, speedKmH: 36, corridor: 'Saravanampatti Echo', status: 'caution', heading: 270, x: 1.4, z: 1.1 },
  { id: 'D-009', altitudeM: 120, speedKmH: 52, corridor: 'Gandhipuram Medical Skyway', status: 'nominal', heading: 180, x: -0.8, z: 1.6 },
  { id: 'D-014', altitudeM: 100, speedKmH: 40, corridor: 'Singanallur Cargo Charlie', status: 'nominal', heading: 60, x: 2.1, z: -0.2 },
];

interface AirspaceVolume3DProps {
  className?: string;
}

export const AirspaceVolume3D: React.FC<AirspaceVolume3DProps> = ({
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedAltitudeLayer, setSelectedAltitudeLayer] = useState<number | 'all'>('all');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 420;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a12);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(4.5, 3.8, 6.0);
    camera.lookAt(0, 1.2, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const airspaceGroup = new THREE.Group();
    scene.add(airspaceGroup);

    // 4. Ground Terrain Plane
    const groundGeo = new THREE.PlaneGeometry(8, 8);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x091428, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    airspaceGroup.add(ground);

    const groundGrid = new THREE.GridHelper(8, 16, 0x0284c7, 0x1e293b);
    groundGrid.position.y = 0.01;
    airspaceGroup.add(groundGrid);

    // 5. Vertical Altitude Planes (80m, 100m, 120m)
    const layers = [
      { alt: 80, y: 0.8, color: 0x10b981, label: '80m Layer (Standard Transit)' },
      { alt: 100, y: 1.5, color: 0x06b6d4, label: '100m Layer (Express Corridors)' },
      { alt: 120, y: 2.2, color: 0x3b82f6, label: '120m Layer (High-Speed Medical)' },
    ];

    layers.forEach((l) => {
      const planeGeo = new THREE.PlaneGeometry(7.2, 7.2);
      const planeMat = new THREE.MeshBasicMaterial({
        color: l.color,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.rotation.x = -Math.PI / 2;
      planeMesh.position.y = l.y;
      airspaceGroup.add(planeMesh);

      // Boundary boundary box
      const edgeBoxGeo = new THREE.BoxGeometry(7.2, 0.02, 7.2);
      const edgeBoxMat = new THREE.MeshBasicMaterial({ color: l.color, wireframe: true, transparent: true, opacity: 0.3 });
      const edgeBox = new THREE.Mesh(edgeBoxGeo, edgeBoxMat);
      edgeBox.position.y = l.y;
      airspaceGroup.add(edgeBox);
    });

    // 6. Drone Markers in 3D Space with Altitude Tether Lines
    const droneMarkers: { mesh: THREE.Group; line: THREE.Line; drone: AirspaceDrone; basePos: THREE.Vector3 }[] = [];

    AIRSPACE_DRONES_DATA.forEach((d) => {
      const droneGroup = new THREE.Group();
      const layerY = d.altitudeM === 80 ? 0.8 : d.altitudeM === 100 ? 1.5 : 2.2;
      droneGroup.position.set(d.x, layerY, d.z);

      // Drone model icon mesh
      const dMat = new THREE.MeshBasicMaterial({ color: d.status === 'caution' ? 0xf59e0b : 0x06b6d4 });
      const dBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.22), dMat);
      droneGroup.add(dBody);

      // Proximity Bubble Sphere
      const bubbleGeo = new THREE.SphereGeometry(0.35, 16, 16);
      const bubbleMat = new THREE.MeshBasicMaterial({
        color: dMat.color,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      });
      const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
      droneGroup.add(bubble);

      airspaceGroup.add(droneGroup);

      // Vertical Tether Line from Ground to Drone
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(d.x, 0, d.z),
        new THREE.Vector3(d.x, layerY, d.z),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color: dMat.color,
        dashSize: 0.1,
        gapSize: 0.05,
        transparent: true,
        opacity: 0.5,
      });
      const tetherLine = new THREE.Line(lineGeo, lineMat);
      tetherLine.computeLineDistances();
      airspaceGroup.add(tetherLine);

      droneMarkers.push({
        mesh: droneGroup,
        line: tetherLine,
        drone: d,
        basePos: new THREE.Vector3(d.x, layerY, d.z),
      });
    });

    // 7. Mouse Orbit Controls
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
      airspaceGroup.rotation.y += dx * 0.006;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => (isDragging = false);

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 8. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      if (autoRotate && !isDragging) {
        airspaceGroup.rotation.y += delta * 0.12;
      }

      // Gentle drift animation for airborne drones
      droneMarkers.forEach((m, idx) => {
        m.mesh.position.y = m.basePos.y + Math.sin(time * 2 + idx) * 0.03;
      });

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 700;
      const h = container.clientHeight || 420;
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 z-10 relative">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-slate-100 uppercase tracking-wide">
                3D AIRSPACE VERTICAL SEPARATION CONTROL
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[9px] uppercase">
                DGCA LAYER LOCK
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Altitude corridor management (80m, 100m, 120m) & dynamic collision avoidance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[11px]">
            {([80, 100, 120] as const).map((alt) => (
              <button
                key={alt}
                onClick={() => setSelectedAltitudeLayer(alt)}
                className={`px-2.5 py-1 rounded-xl font-bold font-mono text-xs transition-all ${
                  selectedAltitudeLayer === alt ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                {alt}m
              </button>
            ))}
            <button
              onClick={() => setSelectedAltitudeLayer('all')}
              className={`px-2.5 py-1 rounded-xl font-bold font-mono text-xs transition-all ${
                selectedAltitudeLayer === 'all' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Layers
            </button>
          </div>

          <button
            onClick={() => setAutoRotate((p) => !p)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
              autoRotate ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle Airspace Orbit"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-80 sm:h-96 rounded-2xl cursor-grab active:cursor-grabbing relative overflow-hidden" />

      {/* Active Airspace Corridor Drones Status Table */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-3">
        {AIRSPACE_DRONES_DATA.map((d) => (
          <div key={d.id} className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs font-mono space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold text-cyan-400">{d.id}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${d.status === 'nominal' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {d.altitudeM}m AGL
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">{d.corridor}</p>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>{d.speedKmH} km/h</span>
              <span>Heading: {d.heading}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
