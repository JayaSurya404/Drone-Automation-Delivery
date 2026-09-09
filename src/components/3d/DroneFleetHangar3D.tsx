import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Bot, BatteryCharging, Wrench, ShieldCheck, Play, Radio, Eye, Layers, RotateCcw } from 'lucide-react';
import { Drone } from '../../types/skynav';
import { mockStore } from '../../services/mockDataStore';

interface DroneFleetHangar3DProps {
  onSelectDrone?: (drone: Drone) => void;
  className?: string;
}

export const DroneFleetHangar3D: React.FC<DroneFleetHangar3DProps> = ({
  onSelectDrone,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const drones = mockStore.getDrones();
  const [selectedDroneId, setSelectedDroneId] = useState<string>('D-001');
  const [hangarFilter, setHangarFilter] = useState<'all' | 'ready' | 'charging' | 'maintenance'>('all');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  const selectedDrone = drones.find((d) => d.id === selectedDroneId) || drones[0];

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.04);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 4.5, 9.5);
    camera.lookAt(0, 0.5, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Studio Lighting & Overhead Neon Trusses
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.8);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    mainLight.position.set(6, 12, 6);
    mainLight.castShadow = true;
    scene.add(mainLight);

    // 4. Hangar Floor & Launch Pads Grid
    const floorGeo = new THREE.PlaneGeometry(30, 20);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.6,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid Floor Overlay
    const grid = new THREE.GridHelper(30, 30, 0x06b6d4, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    // 5. Docking Bays & 3D Drone Models
    const droneBaysGroup = new THREE.Group();
    scene.add(droneBaysGroup);

    const bayPositions = [
      { id: 'D-001', name: 'Bay 01', x: -4.5, z: -2, status: 'ready' },
      { id: 'D-002', name: 'Bay 02', x: -1.5, z: -2, status: 'charging' },
      { id: 'D-003', name: 'Bay 03', x: 1.5, z: -2, status: 'ready' },
      { id: 'D-004', name: 'Bay 04', x: 4.5, z: -2, status: 'maintenance' },
      { id: 'D-005', name: 'Bay 05', x: -3.0, z: 2, status: 'ready' },
      { id: 'D-006', name: 'Bay 06', x: 0.0, z: 2, status: 'charging' },
      { id: 'D-007', name: 'Bay 07', x: 3.0, z: 2, status: 'ready' },
    ];

    const droneObjects: { id: string; group: THREE.Group; props: THREE.Mesh[]; rotorAngle: number }[] = [];

    bayPositions.forEach((bay) => {
      const bayGroup = new THREE.Group();
      bayGroup.position.set(bay.x, 0, bay.z);

      // Launch Pad Helipad Circle
      const padGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.05, 32);
      const padColor = bay.status === 'ready' ? 0x06b6d4 : bay.status === 'charging' ? 0x10b981 : 0xf59e0b;
      const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.5 });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.receiveShadow = true;
      bayGroup.add(padMesh);

      // Glowing Pad Perimeter Ring
      const ringGeo = new THREE.RingGeometry(1.02, 1.1, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: padColor, side: THREE.DoubleSide });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.03;
      bayGroup.add(ringMesh);

      // Docking Spot Light
      const spotLight = new THREE.PointLight(padColor, 1.5, 4);
      spotLight.position.set(0, 1.8, 0);
      bayGroup.add(spotLight);

      // Procedural 3D Drone Body
      const droneMeshGroup = new THREE.Group();
      droneMeshGroup.position.y = 0.35;

      const bodyGeo = new THREE.BoxGeometry(0.5, 0.12, 0.65);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      droneMeshGroup.add(body);

      // Drone Arms
      const armMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.9 });
      const props: THREE.Mesh[] = [];

      [-0.45, 0.45].forEach((ax) => {
        [-0.45, 0.45].forEach((az) => {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6), armMat);
          arm.position.set(ax * 0.5, 0, az * 0.5);
          arm.rotation.z = Math.PI / 2;
          arm.rotation.y = ax * az > 0 ? Math.PI / 4 : -Math.PI / 4;
          droneMeshGroup.add(arm);

          // Motor
          const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16), bodyMat);
          motor.position.set(ax, 0.06, az);
          droneMeshGroup.add(motor);

          // Propeller
          const prop = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.006, 0.04), armMat);
          prop.position.set(ax, 0.13, az);
          droneMeshGroup.add(prop);
          props.push(prop);
        });
      });

      bayGroup.add(droneMeshGroup);
      droneBaysGroup.add(bayGroup);

      droneObjects.push({
        id: bay.id,
        group: droneMeshGroup,
        props,
        rotorAngle: 0,
      });
    });

    // 6. Mouse Interaction Orbit
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
      droneBaysGroup.rotation.y += dx * 0.005;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => (isDragging = false);

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 7. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      if (autoRotate && !isDragging) {
        droneBaysGroup.rotation.y += delta * 0.08;
      }

      // Gentle floating / propeller idle rotation for active bays
      droneObjects.forEach((dObj, idx) => {
        dObj.group.position.y = 0.35 + Math.sin(time * 2 + idx) * 0.04;
        dObj.rotorAngle += delta * 12;
        dObj.props.forEach((prop, pIdx) => {
          prop.rotation.y = dObj.rotorAngle * (pIdx % 2 === 0 ? 1 : -1);
        });
      });

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 450;
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

  const handleSelect = (d: Drone) => {
    setSelectedDroneId(d.id);
    if (onSelectDrone) onSelectDrone(d);
  };

  return (
    <div className={`relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 shadow-2xl p-4 ${className}`}>
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 z-10 relative">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-slate-100 uppercase tracking-wide">
                SKYNAV 3D FLEET HANGAR & LAUNCH DOCKS
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[9px] uppercase">
                40 DOCKS ONLINE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Real-time hangar telemetry, smart charging status, and automated launch readiness
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[11px]">
            {(['all', 'ready', 'charging', 'maintenance'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setHangarFilter(f)}
                className={`px-2.5 py-1 rounded-xl font-bold capitalize transition-all ${
                  hangarFilter === f ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={() => setAutoRotate((p) => !p)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
              autoRotate ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle Hangar Orbit Rotation"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-80 sm:h-96 rounded-2xl cursor-grab active:cursor-grabbing relative overflow-hidden" />

      {/* Bottom Bay Strip */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pt-3">
        {drones.slice(0, 10).map((d) => (
          <button
            key={d.id}
            onClick={() => handleSelect(d)}
            className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all text-left shrink-0 ${
              selectedDrone.id === d.id
                ? 'bg-cyan-500/20 border-cyan-500/80 shadow-md text-slate-100'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${d.status === 'available' ? 'bg-emerald-400' : d.status === 'charging' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
            <div>
              <span className="font-mono font-bold text-xs block text-slate-100">{d.id}</span>
              <span className="text-[9px] font-mono text-slate-400">{d.model} • {d.battery}%</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
