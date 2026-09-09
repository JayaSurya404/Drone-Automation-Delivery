import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Layers, Activity, Wrench, Thermometer, ShieldCheck, Zap, AlertTriangle, Radio, RotateCcw, Eye } from 'lucide-react';

export interface DroneComponentInspection {
  id: string;
  name: string;
  category: 'airframe' | 'power' | 'propulsion' | 'avionics' | 'sensor' | 'payload';
  healthScore: number;
  temperatureC: number;
  vibrationG: number;
  failureProbability: number; // percentage
  status: 'optimal' | 'warning' | 'critical';
  maintenanceWindowHours: number;
  description: string;
  specs: { label: string; value: string }[];
}

export const DRONE_COMPONENTS_DATA: DroneComponentInspection[] = [
  {
    id: 'fuselage',
    name: 'Aerodynamic Monocoque Fuselage',
    category: 'airframe',
    healthScore: 98,
    temperatureC: 28,
    vibrationG: 0.04,
    failureProbability: 0.4,
    status: 'optimal',
    maintenanceWindowHours: 420,
    description: 'T700 Toray Carbon Fiber composite aerodynamic shell with IP55 water and dust seal rating.',
    specs: [
      { label: 'Material', value: 'Carbon Fiber / Kevlar Weave' },
      { label: 'Tensile Strength', value: '4900 MPa' },
      { label: 'IP Rating', value: 'IP55 Weatherproof' },
    ],
  },
  {
    id: 'battery',
    name: 'Smart LiPo 6S Quick-Release Pack',
    category: 'power',
    healthScore: 88,
    temperatureC: 34,
    vibrationG: 0.02,
    failureProbability: 2.1,
    status: 'optimal',
    maintenanceWindowHours: 85,
    description: '22.2V 16,000mAh High-Density Solid-State pouch cells with integrated smart BMS balancer.',
    specs: [
      { label: 'Nominal Voltage', value: '22.2V (3.7V/Cell)' },
      { label: 'Capacity', value: '16,000 mAh' },
      { label: 'Internal Resistance', value: '1.8 mΩ avg' },
      { label: 'Cycles', value: '142 / 1000' },
    ],
  },
  {
    id: 'motors',
    name: '4x High-Torque BLDC Motors & ESCs',
    category: 'propulsion',
    healthScore: 93,
    temperatureC: 44,
    vibrationG: 0.08,
    failureProbability: 1.8,
    status: 'optimal',
    maintenanceWindowHours: 64,
    description: 'Custom stator brushless motors with FOC (Field Oriented Control) 60A sinusoidal ESC drivers.',
    specs: [
      { label: 'Max Thrust', value: '14.8 kg Total (4x 3.7kg)' },
      { label: 'Operating RPM', value: '6,240 RPM Cruise' },
      { label: 'ESC Protocol', value: 'DShot1200 Bidirectional' },
    ],
  },
  {
    id: 'propellers',
    name: 'Folding Carbon Aerofoil Propellers',
    category: 'propulsion',
    healthScore: 96,
    temperatureC: 24,
    vibrationG: 0.06,
    failureProbability: 0.8,
    status: 'optimal',
    maintenanceWindowHours: 190,
    description: 'Ultra-low acoustic noise 18-inch carbon fiber folding blades with leading-edge serration.',
    specs: [
      { label: 'Diameter / Pitch', value: '18 x 6.2 inch' },
      { label: 'Blade Balance', value: 'Dynamic <0.02g-mm' },
      { label: 'Noise Reduction', value: '-6.4 dB Acoustic Profile' },
    ],
  },
  {
    id: 'rtk_gps',
    name: 'Dual RTK GNSS Antenna & Compass',
    category: 'avionics',
    healthScore: 99,
    temperatureC: 29,
    vibrationG: 0.03,
    failureProbability: 0.2,
    status: 'optimal',
    maintenanceWindowHours: 500,
    description: 'Multi-band L1/L2/E5 RTK positioning module with centimeter-precision carrier-phase kinematic fix.',
    specs: [
      { label: 'Constellations', value: 'GPS, Galileo, BeiDou, GLONASS' },
      { label: 'Position Accuracy', value: '1.2 cm Horizontal / 1.8 cm Vertical' },
      { label: 'Satellites Locked', value: '28 Satellites' },
    ],
  },
  {
    id: 'lidar_sensors',
    name: '360° Optical LiDAR & Collision Sensor Array',
    category: 'sensor',
    healthScore: 97,
    temperatureC: 32,
    vibrationG: 0.04,
    failureProbability: 0.7,
    status: 'optimal',
    maintenanceWindowHours: 210,
    description: 'Forward pulsed solid-state LiDAR scanner with 45m ranging envelope and redundant sonar ground sensors.',
    specs: [
      { label: 'Range', value: '45 meters (905nm pulsed)' },
      { label: 'Field of View', value: '120° H x 60° V' },
      { label: 'Scan Rate', value: '20 Hz Point Cloud' },
    ],
  },
  {
    id: 'gimbal_camera',
    name: '4K Ultra-HD Optical AI Landing Camera',
    category: 'sensor',
    healthScore: 95,
    temperatureC: 31,
    vibrationG: 0.05,
    failureProbability: 1.1,
    status: 'optimal',
    maintenanceWindowHours: 320,
    description: '3-Axis brushless gyro-stabilized gimbal with downward computer-vision landing zone classifier.',
    specs: [
      { label: 'Sensor', value: 'Sony 1/2.3" CMOS 4K 60fps' },
      { label: 'Gimbal Stabilization', value: '3-Axis Brushless ±0.01°' },
      { label: 'Optical Flow', value: 'Active 200 fps Terrain Tracking' },
    ],
  },
  {
    id: 'avionics_core',
    name: 'Triple-Redundant Autopilot Flight Controller',
    category: 'avionics',
    healthScore: 99,
    temperatureC: 36,
    vibrationG: 0.02,
    failureProbability: 0.1,
    status: 'optimal',
    maintenanceWindowHours: 600,
    description: 'Dual Cortex-M7 processors running lockstep deterministic real-time OS with internal vibration damping.',
    specs: [
      { label: 'Architecture', value: 'Triple IMU + Dual Barometer' },
      { label: 'Processor', value: 'STM32H753 @ 480 MHz' },
      { label: 'Latency', value: '< 2.5 ms Loop Time' },
    ],
  },
  {
    id: 'cargo_bay',
    name: 'Automated Medical / Package Locker & Winch',
    category: 'payload',
    healthScore: 94,
    temperatureC: 22,
    vibrationG: 0.03,
    failureProbability: 1.4,
    status: 'optimal',
    maintenanceWindowHours: 140,
    description: 'Active climate-controlled cargo locker with emergency auto-cut tether winch and electronic locking jaws.',
    specs: [
      { label: 'Payload Capacity', value: '5.0 kg Max Load' },
      { label: 'Tether Drop Height', value: '2.5 - 5.0 meters' },
      { label: 'Climate Control', value: '2°C to 8°C Active Cooling' },
    ],
  },
  {
    id: 'landing_gear',
    name: 'Carbon Landing Skids & Touchdown Dampers',
    category: 'airframe',
    healthScore: 97,
    temperatureC: 25,
    vibrationG: 0.06,
    failureProbability: 0.6,
    status: 'optimal',
    maintenanceWindowHours: 300,
    description: 'High-energy absorption carbon fiber twin skids with integrated capacitive ground proximity sensors.',
    specs: [
      { label: 'Impact Absorption', value: '3.2 m/s Vertical Drop' },
      { label: 'Ground Sensors', value: 'Dual Contact Microswitches' },
    ],
  },
];

interface DroneExplodedView3DProps {
  droneId?: string;
  droneModel?: string;
  onSelectComponent?: (comp: DroneComponentInspection) => void;
  className?: string;
}

export const DroneExplodedView3D: React.FC<DroneExplodedView3DProps> = ({
  droneId = 'D-024',
  droneModel = 'SKYNAV X1',
  onSelectComponent,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isExploded, setIsExploded] = useState<boolean>(true);
  const [selectedCompId, setSelectedCompId] = useState<string>('fuselage');
  const [autoOrbit, setAutoOrbit] = useState<boolean>(true);

  const selectedComponent = DRONE_COMPONENTS_DATA.find((c) => c.id === selectedCompId) || DRONE_COMPONENTS_DATA[0];

  // Map of 3D meshes for exploded displacement
  const partsRef = useRef<{ [key: string]: { mesh: THREE.Object3D; originalPos: THREE.Vector3; explodedPos: THREE.Vector3 } }>({});

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 450;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(2.8, 2.2, 4.2);
    camera.lookAt(0, 0, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.0);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 3.0);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x06b6d4, 1.8);
    fillLight.position.set(-5, 4, -4);
    scene.add(fillLight);

    const floorLight = new THREE.PointLight(0x06b6d4, 1.5, 6);
    floorLight.position.set(0, -1.2, 0);
    scene.add(floorLight);

    // 4. Ground Grid Plate
    const gridHelper = new THREE.GridHelper(6, 24, 0x06b6d4, 0x1e293b);
    gridHelper.position.y = -1.2;
    scene.add(gridHelper);

    // 5. Materials
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.9 });
    const cyanAccentMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.2, metalness: 0.4, emissive: 0x06b6d4, emissiveIntensity: 0.3 });
    const batteryMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, metalness: 0.5, emissive: 0x10b981, emissiveIntensity: 0.2 });
    const payloadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const parts: typeof partsRef.current = {};

    // --- Component A: Fuselage ---
    const fuselageMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 1.0), carbonMat);
    fuselageMesh.castShadow = true;
    rootGroup.add(fuselageMesh);
    parts['fuselage'] = {
      mesh: fuselageMesh,
      originalPos: new THREE.Vector3(0, 0, 0),
      explodedPos: new THREE.Vector3(0, 0, 0),
    };

    // --- Component B: Battery ---
    const batteryMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.45), batteryMat);
    batteryMesh.castShadow = true;
    rootGroup.add(batteryMesh);
    parts['battery'] = {
      mesh: batteryMesh,
      originalPos: new THREE.Vector3(0, 0.08, -0.15),
      explodedPos: new THREE.Vector3(0, 0.85, -0.2),
    };

    // --- Component C: Avionics Core & Hatch ---
    const avionicsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.12, 16), darkMat);
    avionicsMesh.castShadow = true;
    rootGroup.add(avionicsMesh);
    parts['avionics_core'] = {
      mesh: avionicsMesh,
      originalPos: new THREE.Vector3(0, 0.14, 0.15),
      explodedPos: new THREE.Vector3(0, 0.65, 0.3),
    };

    // --- Component D: RTK GPS Antenna Mast ---
    const rtkGroup = new THREE.Group();
    const rtkStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2), darkMat);
    const rtkPuck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16), cyanAccentMat);
    rtkPuck.position.y = 0.12;
    rtkGroup.add(rtkStem);
    rtkGroup.add(rtkPuck);
    rootGroup.add(rtkGroup);
    parts['rtk_gps'] = {
      mesh: rtkGroup,
      originalPos: new THREE.Vector3(-0.25, 0.22, -0.35),
      explodedPos: new THREE.Vector3(-0.55, 1.1, -0.65),
    };

    // --- Component E: LiDAR Scanner ---
    const lidarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 16), cyanAccentMat);
    lidarMesh.rotation.x = Math.PI / 2;
    rootGroup.add(lidarMesh);
    parts['lidar_sensors'] = {
      mesh: lidarMesh,
      originalPos: new THREE.Vector3(0, 0.05, 0.55),
      explodedPos: new THREE.Vector3(0, 0.15, 1.3),
    };

    // --- Component F: Gimbal 4K Camera ---
    const gimbalGroup = new THREE.Group();
    const gBall = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), darkMat);
    const gLens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.08, 16), cyanAccentMat);
    gLens.rotation.x = Math.PI / 2;
    gLens.position.z = 0.05;
    gimbalGroup.add(gBall);
    gimbalGroup.add(gLens);
    rootGroup.add(gimbalGroup);
    parts['gimbal_camera'] = {
      mesh: gimbalGroup,
      originalPos: new THREE.Vector3(0, -0.15, 0.45),
      explodedPos: new THREE.Vector3(0, -0.6, 1.1),
    };

    // --- Component G: Motors & Arms ---
    const motorArmGroup = new THREE.Group();
    const armCoords = [
      { x: 0.8, z: 0.8, angle: Math.PI / 4 },
      { x: -0.8, z: 0.8, angle: -Math.PI / 4 },
      { x: 0.8, z: -0.8, angle: (3 * Math.PI) / 4 },
      { x: -0.8, z: -0.8, angle: -(3 * Math.PI) / 4 },
    ];
    armCoords.forEach((arm) => {
      const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.0), darkMat);
      armMesh.position.set(arm.x * 0.45, 0.02, arm.z * 0.45);
      armMesh.rotation.y = arm.angle;
      armMesh.rotation.z = Math.PI / 2;
      motorArmGroup.add(armMesh);

      const mHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 16), carbonMat);
      mHousing.position.set(arm.x, 0.08, arm.z);
      motorArmGroup.add(mHousing);

      const mRing = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 16), cyanAccentMat);
      mRing.position.set(arm.x, 0.18, arm.z);
      motorArmGroup.add(mRing);
    });
    rootGroup.add(motorArmGroup);
    parts['motors'] = {
      mesh: motorArmGroup,
      originalPos: new THREE.Vector3(0, 0, 0),
      explodedPos: new THREE.Vector3(0, 0.25, 0),
    };

    // --- Component H: Propellers ---
    const propGroup = new THREE.Group();
    armCoords.forEach((arm) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.008, 0.06), darkMat);
      p.position.set(arm.x, 0.22, arm.z);
      propGroup.add(p);
    });
    rootGroup.add(propGroup);
    parts['propellers'] = {
      mesh: propGroup,
      originalPos: new THREE.Vector3(0, 0, 0),
      explodedPos: new THREE.Vector3(0, 0.75, 0),
    };

    // --- Component I: Cargo Bay Locker ---
    const cargoGroup = new THREE.Group();
    const cBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.42), payloadMat);
    cBox.castShadow = true;
    cargoGroup.add(cBox);
    rootGroup.add(cargoGroup);
    parts['cargo_bay'] = {
      mesh: cargoGroup,
      originalPos: new THREE.Vector3(0, -0.22, 0),
      explodedPos: new THREE.Vector3(0, -0.75, 0),
    };

    // --- Component J: Landing Skids ---
    const skidGroup = new THREE.Group();
    [-0.38, 0.38].forEach((xOff) => {
      const runner = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2), darkMat);
      runner.position.set(xOff, -0.32, 0);
      runner.rotation.x = Math.PI / 2;
      skidGroup.add(runner);

      [-0.35, 0.35].forEach((zOff) => {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3), darkMat);
        strut.position.set(xOff, -0.16, zOff);
        strut.rotation.z = xOff > 0 ? -0.2 : 0.2;
        skidGroup.add(strut);
      });
    });
    rootGroup.add(skidGroup);
    parts['landing_gear'] = {
      mesh: skidGroup,
      originalPos: new THREE.Vector3(0, 0, 0),
      explodedPos: new THREE.Vector3(0, -0.5, 0),
    };

    partsRef.current = parts;

    // Mouse Drag Rotation
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
      rootGroup.rotation.y += dx * 0.008;
      rootGroup.rotation.x += dy * 0.008;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => (isDragging = false);

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation Loop (Lerp exploded positions)
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (autoOrbit && !isDragging) {
        rootGroup.rotation.y += delta * 0.25;
      }

      // Smoothly lerp parts between assembled and exploded coordinates
      Object.keys(parts).forEach((key) => {
        const item = parts[key];
        const target = isExploded ? item.explodedPos : item.originalPos;
        item.mesh.position.lerp(target, delta * 5.0);
      });

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 700;
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
  }, [isExploded, autoOrbit]);

  const handleSelectComp = (comp: DroneComponentInspection) => {
    setSelectedCompId(comp.id);
    if (onSelectComponent) onSelectComponent(comp);
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-5 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 p-5 shadow-2xl ${className}`}>
      {/* Left 2 Cols: 3D Exploded Viewport */}
      <div className="lg:col-span-2 relative flex flex-col justify-between">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between z-10 mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-cyan-400">{droneId}</span>
                <span className="font-bold text-slate-100 text-xs">{droneModel}</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[9px] uppercase">
                  DEEP INSPECTION
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Interactive Subsystem & Exploded Structural Diagnostics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExploded((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                isExploded
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isExploded ? 'Exploded View' : 'Assembled'}</span>
            </button>

            <button
              onClick={() => setAutoOrbit((prev) => !prev)}
              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                autoOrbit ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Toggle Orbit Rotation"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${autoOrbit ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
            </button>
          </div>
        </div>

        {/* WebGL Mount */}
        <div ref={mountRef} className="w-full h-80 sm:h-96 rounded-2xl cursor-grab active:cursor-grabbing relative overflow-hidden" />

        {/* Quick Component Pill Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pt-2">
          {DRONE_COMPONENTS_DATA.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectComp(c)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold whitespace-nowrap transition-all ${
                selectedCompId === c.id
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {c.name.split(' ')[0]} ({c.healthScore}%)
            </button>
          ))}
        </div>
      </div>

      {/* Right 1 Col: Component Diagnostics Card */}
      <div className="space-y-3.5 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block font-bold">
                {selectedComponent.category.toUpperCase()} SUBSYSTEM
              </span>
              <h3 className="font-bold text-sm text-slate-100">{selectedComponent.name}</h3>
            </div>
            <div className="text-right font-mono">
              <span className="text-lg font-black text-emerald-400">{selectedComponent.healthScore}%</span>
              <span className="text-[9px] text-slate-400 block">HEALTH</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans">{selectedComponent.description}</p>

          {/* Real-time Telemetry Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">OPERATING TEMP</span>
              <span className="font-black text-cyan-400">{selectedComponent.temperatureC}°C</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">FFT VIBRATION</span>
              <span className="font-black text-slate-200">{selectedComponent.vibrationG} g</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">FAILURE RISK</span>
              <span className="font-black text-emerald-400">{selectedComponent.failureProbability}% (Nominal)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">SERVICE WINDOW</span>
              <span className="font-black text-amber-400">{selectedComponent.maintenanceWindowHours} hrs</span>
            </div>
          </div>

          {/* Technical Specs List */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800 text-[11px] font-mono">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Engineering Specs:</span>
            {selectedComponent.specs.map((spec) => (
              <div key={spec.label} className="flex justify-between text-slate-400">
                <span>{spec.label}:</span>
                <span className="font-bold text-slate-200">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> OEM Certified Airworthy
          </span>
          <span className="text-cyan-400 font-bold">Inspect Next Subsystem →</span>
        </div>
      </div>
    </div>
  );
};
