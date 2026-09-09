import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Globe, Radio, Layers, Navigation, ZoomIn, ZoomOut, RotateCcw, ShieldCheck, MapPin } from 'lucide-react';

interface OperatingHub {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  activeDrones: number;
  missionsToday: number;
  status: 'optimal' | 'busy' | 'restricted';
  weather: string;
}

export const OPERATING_HUBS: OperatingHub[] = [
  { id: 'cbe', name: 'Coimbatore Airspace Hub (Primary)', code: 'CJB-HQ', lat: 11.0168, lng: 76.9558, activeDrones: 17, missionsToday: 142, status: 'optimal', weather: '24°C Clear' },
  { id: 'blr', name: 'Bengaluru Tech Corridor Hub', code: 'BLR-01', lat: 12.9716, lng: 77.5946, activeDrones: 24, missionsToday: 218, status: 'busy', weather: '22°C Part Cloudy' },
  { id: 'maa', name: 'Chennai Coastal Logistics Hub', code: 'MAA-02', lat: 13.0827, lng: 80.2707, activeDrones: 12, missionsToday: 98, status: 'optimal', weather: '29°C Humid' },
  { id: 'hyd', name: 'Hyderabad Cyberabad Aero Hub', code: 'HYD-03', lat: 17.3850, lng: 78.4867, activeDrones: 19, missionsToday: 164, status: 'optimal', weather: '26°C Clear' },
  { id: 'bom', name: 'Mumbai Western Express Hub', code: 'BOM-04', lat: 19.0760, lng: 72.8777, activeDrones: 15, missionsToday: 130, status: 'busy', weather: '28°C Hazy' },
  { id: 'del', name: 'Delhi NCR High-Speed Airway', code: 'DEL-05', lat: 28.7041, lng: 77.1025, activeDrones: 8, missionsToday: 76, status: 'restricted', weather: '21°C Wind Shear' },
];

interface OperationsGlobe3DProps {
  onSelectHub?: (hub: OperatingHub) => void;
  className?: string;
  heightClass?: string;
}

export const OperationsGlobe3D: React.FC<OperationsGlobe3DProps> = ({
  onSelectHub,
  className = '',
  heightClass = 'h-[480px]',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedHub, setSelectedHub] = useState<OperatingHub>(OPERATING_HUBS[0]);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [overlayMode, setOverlayMode] = useState<'corridors' | 'heatmaps' | 'weather'>('corridors');

  // Convert GPS (lat, lng) on sphere radius R to 3D Cartesian coordinates
  const latLngToVector3 = (lat: number, lng: number, radius: number = 3): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 480;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2, 7.5);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // 3. Lighting (Sun + Ambient + Rim light)
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    sunLight.position.set(8, 6, 6);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.5);
    rimLight.position.set(-8, -4, -6);
    scene.add(rimLight);

    // 4. Globe Sphere
    const globeRadius = 2.8;
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Base Earth sphere
    const globeGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const globeMat = new THREE.MeshStandardMaterial({
      color: 0x091428,
      roughness: 0.6,
      metalness: 0.8,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    globeGroup.add(globeMesh);

    // Wireframe Grid / Parallels & Meridians overlay
    const wireGeo = new THREE.SphereGeometry(globeRadius * 1.002, 32, 16);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    globeGroup.add(wireMesh);

    // Atmosphere Halo Glow
    const atmosphereGeo = new THREE.SphereGeometry(globeRadius * 1.15, 48, 48);
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
          gl_FragColor = vec4(0.02, 0.71, 0.83, 1.0) * intensity * 0.75;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    scene.add(atmosphereMesh);

    // 5. Operating Hub Pins & Beacons
    const hubMarkers: { mesh: THREE.Mesh; hub: OperatingHub; light: THREE.PointLight }[] = [];
    OPERATING_HUBS.forEach((hub) => {
      const pos = latLngToVector3(hub.lat, hub.lng, globeRadius * 1.01);
      
      const pinGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({
        color: hub.status === 'optimal' ? 0x10b981 : hub.status === 'busy' ? 0x06b6d4 : 0xf59e0b,
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.copy(pos);
      globeGroup.add(pinMesh);

      // Outer pulsing ring
      const ringGeo = new THREE.RingGeometry(0.08, 0.12, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: pinMat.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(new THREE.Vector3(0, 0, 0));
      globeGroup.add(ringMesh);

      const light = new THREE.PointLight(pinMat.color, 1.5, 1.5);
      light.position.copy(pos);
      globeGroup.add(light);

      hubMarkers.push({ mesh: pinMesh, hub, light });
    });

    // 6. Drone Flight Arcs between Hubs (Quadratic Bezier Curves with photon pulses)
    const arcCurves: { curve: THREE.QuadraticBezierCurve3; photon: THREE.Mesh; progress: number; speed: number }[] = [];
    const connections: [number, number][] = [
      [0, 1], // Coimbatore -> Bengaluru
      [0, 2], // Coimbatore -> Chennai
      [1, 3], // Bengaluru -> Hyderabad
      [3, 4], // Hyderabad -> Mumbai
      [4, 5], // Mumbai -> Delhi
      [1, 2], // Bengaluru -> Chennai
    ];

    connections.forEach(([iA, iB]) => {
      const pA = latLngToVector3(OPERATING_HUBS[iA].lat, OPERATING_HUBS[iA].lng, globeRadius * 1.01);
      const pB = latLngToVector3(OPERATING_HUBS[iB].lat, OPERATING_HUBS[iB].lng, globeRadius * 1.01);

      // Midpoint pulled outward for arc height
      const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
      const dist = pA.distanceTo(pB);
      mid.normalize().multiplyScalar(globeRadius + dist * 0.35);

      const curve = new THREE.QuadraticBezierCurve3(pA, mid, pB);
      const points = curve.getPoints(50);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.45,
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      globeGroup.add(arcLine);

      // Moving photon light packet
      const photonGeo = new THREE.SphereGeometry(0.035, 8, 8);
      const photonMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const photonMesh = new THREE.Mesh(photonGeo, photonMat);
      globeGroup.add(photonMesh);

      arcCurves.push({
        curve,
        photon: photonMesh,
        progress: Math.random(),
        speed: 0.15 + Math.random() * 0.15,
      });
    });

    // Initial globe orientation to highlight India / Coimbatore hub
    globeGroup.rotation.y = -Math.PI * 0.65;
    globeGroup.rotation.x = 0.25;

    // 7. Interactive Mouse Drag Orbit Controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      globeGroup.rotation.y += deltaX * 0.006;
      globeGroup.rotation.x += deltaY * 0.006;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 8. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (autoRotate && !isDragging) {
        globeGroup.rotation.y += delta * 0.08;
      }

      // Animate flight photons along arcs
      arcCurves.forEach((arc) => {
        arc.progress = (arc.progress + delta * arc.speed) % 1.0;
        const pos = arc.curve.getPoint(arc.progress);
        arc.photon.position.copy(pos);
      });

      // Pulse hub markers
      const time = clock.getElapsedTime();
      hubMarkers.forEach((m, idx) => {
        const pulse = 1.0 + 0.3 * Math.sin(time * 4 + idx);
        m.mesh.scale.set(pulse, pulse, pulse);
        m.light.intensity = 1.0 + 0.5 * Math.sin(time * 3 + idx);
      });

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Handling
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [autoRotate]);

  const handleSelectHub = (hub: OperatingHub) => {
    setSelectedHub(hub);
    if (onSelectHub) onSelectHub(hub);
  };

  return (
    <div className={`relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 shadow-2xl ${className}`}>
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className={`w-full ${heightClass} cursor-grab active:cursor-grabbing`} />

      {/* Top Left Status Badge */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 text-xs shadow-xl">
          <Globe className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '12s' }} />
          <span className="font-bold text-slate-100 uppercase tracking-wider font-mono text-[11px]">
            SKYNAV GLOBAL AIRSPACE GLOBE
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[9px]">
            6 HUBS ACTIVE
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[11px]">
          {(['corridors', 'heatmaps', 'weather'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setOverlayMode(m)}
              className={`px-2.5 py-1 rounded-xl font-bold capitalize transition-all ${
                overlayMode === m ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Top Right Controls (Auto-Rotate Toggle + Legend) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => setAutoRotate((prev) => !prev)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold backdrop-blur-md transition-all ${
            autoRotate
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              : 'bg-slate-900/80 text-slate-400 border-slate-700'
          }`}
          title="Toggle Earth Auto-Rotation"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
          <span>{autoRotate ? 'Orbiting' : 'Paused'}</span>
        </button>
      </div>

      {/* Bottom Hub Drilldown Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 text-xs">
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase shrink-0">Hubs:</span>
          {OPERATING_HUBS.map((hub) => (
            <button
              key={hub.id}
              onClick={() => handleSelectHub(hub)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold font-mono text-xs whitespace-nowrap transition-all ${
                selectedHub.id === hub.id
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${hub.status === 'optimal' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{hub.code}</span>
            </button>
          ))}
        </div>

        {/* Selected Hub Telemetry Chip */}
        <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-slate-300 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <div>
            <span className="text-slate-400 text-[10px] block">AIRSPACE SECTOR</span>
            <span className="font-bold text-cyan-300">{selectedHub.name}</span>
          </div>
          <div className="border-l border-slate-800 pl-3">
            <span className="text-slate-400 text-[10px] block">AIRBORNE DRONES</span>
            <span className="font-bold text-emerald-400">{selectedHub.activeDrones} UAVs</span>
          </div>
          <div className="border-l border-slate-800 pl-3">
            <span className="text-slate-400 text-[10px] block">METEOROLOGY</span>
            <span className="font-bold text-slate-200">{selectedHub.weather}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
