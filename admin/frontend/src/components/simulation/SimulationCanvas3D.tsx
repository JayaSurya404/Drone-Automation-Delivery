import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DroneModel3D, DroneAnimationState } from './DroneModel3D';
import { Environment3D, EnvironmentSettings } from './Environment3D';
import { StoryScene, MultiDroneSimState, MULTI_DRONE_FLEET } from './simulationStories';
import { Drone, Mission } from '../../types/skynav';

interface SimulationCanvas3DProps {
  activeScene: StoryScene;
  scenarioType: string;
  cameraMode: 'operations' | 'follow' | 'fpv' | 'top' | 'customer' | 'obstacle' | 'hub';
  environmentSettings: EnvironmentSettings;
  isObstacleInjected: boolean;
  isRerouted: boolean;
  onDroneClick?: (droneId: string) => void;
  playbackProgress: number; // 0.0 to 1.0 within current scene
  isPlaying: boolean;
  liveDrone?: Drone | null;
  liveMission?: Mission | null;
}

export const SimulationCanvas3D: React.FC<SimulationCanvas3DProps> = ({
  activeScene,
  scenarioType,
  cameraMode,
  environmentSettings,
  isObstacleInjected,
  isRerouted,
  onDroneClick,
  playbackProgress,
  isPlaying,
  liveDrone,
  liveMission,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Three.js instances stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const droneModelRef = useRef<DroneModel3D | null>(null);
  const multiDronesRef = useRef<DroneModel3D[]>([]);
  const environmentRef = useRef<Environment3D | null>(null);

  // Mouse orbit & pan interaction state for operations view
  const isDraggingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitAnglesRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 50,
  });
  // Fixed operational center for user-controlled orbit (does NOT track the drone)
  const orbitCenterRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 4, 0));
  const cameraModeRef = useRef<string>(cameraMode);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  const historyPointsRef = useRef<THREE.Vector3[]>([]);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Initialize Scene, Camera & WebGL Renderer
    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(
      environmentSettings.timeOfDay === 'night' ? 0x020617 :
      environmentSettings.timeOfDay === 'sunset' ? 0x1c1917 : 0x0f172a
    );
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
    camera.position.set(0, 25, 45);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // 2. Initialize 3D Environment
    const env = new Environment3D(scene);
    environmentRef.current = env;

    // 3. Initialize Primary 3D Drone Model (D-024)
    const primaryDrone = new DroneModel3D('D-024', 'cyan');
    primaryDrone.group.position.copy(activeScene.dronePos);
    scene.add(primaryDrone.group);
    droneModelRef.current = primaryDrone;

    // 4. Initialize Multi-Drone auxiliary fleet for multi-drone mode
    const multiDrones: DroneModel3D[] = [];
    const colors: ('emerald' | 'amber' | 'cyan' | 'rose')[] = ['emerald', 'amber', 'rose', 'cyan'];
    MULTI_DRONE_FLEET.slice(1).forEach((d: MultiDroneSimState, idx: number) => {
      const uav = new DroneModel3D(d.id, colors[idx % colors.length]);
      uav.group.position.copy(d.currentPos);
      uav.group.scale.set(1.2, 1.2, 1.2);
      scene.add(uav.group);
      multiDrones.push(uav);
    });
    multiDronesRef.current = multiDrones;

    // Mouse Orbit & Pan Listeners for 3D Operations View
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      isPanningRef.current = e.button === 2 || e.shiftKey;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - prevMousePosRef.current.x;
      const deltaY = e.clientY - prevMousePosRef.current.y;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (isPanningRef.current) {
        // Pan the orbit center across the Kurumbapalayam world
        const panFactor = 0.08 * (orbitAnglesRef.current.radius / 45);
        const theta = orbitAnglesRef.current.theta;
        const forwardX = Math.sin(theta);
        const forwardZ = Math.cos(theta);
        const rightX = Math.cos(theta);
        const rightZ = -Math.sin(theta);

        orbitCenterRef.current.x -= (rightX * deltaX - forwardX * deltaY) * panFactor;
        orbitCenterRef.current.z -= (rightZ * deltaX - forwardZ * deltaY) * panFactor;
      } else {
        orbitAnglesRef.current.theta -= deltaX * 0.008;
        orbitAnglesRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2.1, orbitAnglesRef.current.phi - deltaY * 0.008));
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      isPanningRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitAnglesRef.current.radius = Math.max(10, Math.min(140, orbitAnglesRef.current.radius + e.deltaY * 0.05));
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domEl.addEventListener('wheel', handleWheel, { passive: false });
    domEl.addEventListener('contextmenu', handleContextMenu);

    // Handle Resize
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const newW = mountRef.current.clientWidth;
      const newH = mountRef.current.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // 5. Main Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // Update Environment
      if (environmentRef.current) {
        environmentRef.current.updateEnvironment(delta, environmentSettings, isRerouted);
      }

      // In External / Operations mode: keep camera anchored around user-controlled orbitCenter
      // NEVER chase or track the drone! The drone moves freely across the world!
      if (cameraModeRef.current === 'operations' && cameraRef.current) {
        const { theta, phi, radius } = orbitAnglesRef.current;
        const center = orbitCenterRef.current;
        const cx = center.x + radius * Math.sin(phi) * Math.sin(theta);
        const cy = Math.max(2, center.y + radius * Math.cos(phi));
        const cz = center.z + radius * Math.sin(phi) * Math.cos(theta);
        cameraRef.current.position.set(cx, cy, cz);
        cameraRef.current.lookAt(center);
      }

      // Update Auxiliary Multi-Drones
      if (scenarioType === 'multi_drone') {
        multiDronesRef.current.forEach((uav, index) => {
          uav.group.visible = true;
          const speed = 6000;
          uav.update(delta, {
            position: uav.group.position,
            rotation: uav.group.rotation,
            rotorSpeed: speed,
            flightPhase: 'cruise',
            status: 'normal',
            payloadAttached: true,
            obstacleScanning: true,
          });
        });
      } else {
        multiDronesRef.current.forEach((uav) => {
          uav.group.visible = false;
        });
      }

      // Render Scene
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domEl.removeEventListener('wheel', handleWheel);
      domEl.removeEventListener('contextmenu', handleContextMenu);

      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
      renderer.dispose();
    };
  }, []);

  // Update Environment & Background on Setting Changes
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.background = new THREE.Color(
      environmentSettings.timeOfDay === 'night' ? 0x020617 :
      environmentSettings.timeOfDay === 'sunset' ? 0x27191c : 0x0b132b
    );
  }, [environmentSettings.timeOfDay]);

  // Update Drone & Camera on Scene, Live Telemetry and Progress Updates
  useEffect(() => {
    const drone = droneModelRef.current;
    const camera = cameraRef.current;
    const env = environmentRef.current;
    if (!drone || !camera || !env) return;

    let basePos = activeScene.dronePos.clone();
    let baseRot = activeScene.droneRot.clone();
    let targetRpm = 0;
    let headingDeg = activeScene.heading;
    let flightPhase: DroneAnimationState['flightPhase'] = activeScene.flightPhase;
    let droneHighlightStatus: DroneAnimationState['status'] = activeScene.status;
    let payloadAttached = activeScene.payloadAttached;

    if (liveDrone) {
      const hubLat = 11.1132;
      const hubLng = 77.0277;
      headingDeg = liveDrone.location.heading || 0;
      baseRot = new THREE.Euler(0, -(headingDeg * Math.PI) / 180, 0);

      const isAtHub = Math.abs(liveDrone.location.lat - hubLat) < 0.0008 &&
                      Math.abs(liveDrone.location.lng - hubLng) < 0.0008 &&
                      (liveDrone.location.altitude === 0 || !liveDrone.location.altitude);

      const totalDistM = (liveMission?.distanceKm ? liveMission.distanceKm * 1000 : 4500);
      const scale = 73 / Math.max(1000, totalDistM);

      const latMeters = -(liveDrone.location.lat - hubLat) * 110540;
      const lngMeters = (liveDrone.location.lng - hubLng) * (111320 * Math.cos((hubLat * Math.PI) / 180));

      const calcX = lngMeters * scale;
      const calcZ = -35 + latMeters * scale;
      const altM = liveDrone.location.altitude || 0;
      const groundY = env.getGroundElevationAt(calcX, calcZ);
      const calcY = groundY + (altM > 0 ? Math.max(0.6, (altM / 75) * 16) : 0.2);

      const isTouchdown = liveDrone.status === 'touchdown' ||
        (liveDrone.status === 'in_flight' && altM === 0 && (!liveDrone.remainingDistanceKm || liveDrone.remainingDistanceKm <= 0.05));

      if (isTouchdown) {
        basePos = new THREE.Vector3(env.customerPadPosition.x, env.customerPadPosition.y + 0.15, env.customerPadPosition.z);
        flightPhase = 'delivered';
        droneHighlightStatus = 'delivery';
        targetRpm = 0;
        payloadAttached = true;
      } else if (liveDrone.status === 'charging' || liveDrone.status === 'available' || isAtHub) {
        basePos = new THREE.Vector3(0, env.warehousePadPosition.y + 0.15, -35);
        flightPhase = liveDrone.status === 'charging' ? 'completed' : 'idle';
        droneHighlightStatus = liveDrone.status === 'charging' ? 'warning' : 'normal';
        targetRpm = 0;
        payloadAttached = false;
      } else if (liveDrone.status === 'returning') {
        basePos = new THREE.Vector3(calcX, calcY, calcZ);
        flightPhase = 'return';
        droneHighlightStatus = 'return';
        targetRpm = altM > 20 ? 7600 : 4800;
        payloadAttached = false;
      } else {
        // in_flight
        basePos = new THREE.Vector3(calcX, calcY, calcZ);
        flightPhase = altM < 15 ? 'takeoff' : 'cruise';
        droneHighlightStatus = 'normal';
        targetRpm = altM > 20 ? 7600 : 4800;
        payloadAttached = true;
      }
    } else {
      // Adjust for Reroute West deviation
      if (isRerouted && (activeScene.id === 8 || activeScene.id === 9 || activeScene.id === 10)) {
        basePos.x = -7.5;
      }
      if (activeScene.flightPhase === 'preflight') targetRpm = 1200;
      else if (activeScene.flightPhase === 'takeoff' || activeScene.flightPhase === 'climb') targetRpm = 6800;
      else if (activeScene.flightPhase === 'cruise' || activeScene.flightPhase === 'return') targetRpm = 7600;
      else if (activeScene.flightPhase === 'hover') targetRpm = 6000;
      else if (activeScene.flightPhase === 'descent') targetRpm = 4500;
      else if (activeScene.flightPhase === 'delivered') targetRpm = 5200;
      else if (activeScene.flightPhase === 'completed') targetRpm = 0;
    }

    const droneState: DroneAnimationState = {
      position: basePos,
      rotation: baseRot,
      rotorSpeed: targetRpm,
      flightPhase,
      status: droneHighlightStatus,
      payloadAttached,
      obstacleScanning: activeScene.obstacleScanning || isObstacleInjected,
    };

    drone.update(0.016, droneState);
    drone.setHighlightStatus(droneHighlightStatus);

    if (typeof window !== 'undefined') {
      (window as any).__skynav3DDrone = {
        droneId: liveDrone?.id || 'D-001',
        lat: liveDrone?.location.lat || 11.1132,
        lng: liveDrone?.location.lng || 77.0277,
        alt: liveDrone?.location.altitude || 0,
        speed: liveDrone?.location.speed || 0,
        heading: headingDeg,
        status: liveDrone?.status || 'available',
        scenePos: { x: parseFloat(basePos.x.toFixed(3)), y: parseFloat(basePos.y.toFixed(3)), z: parseFloat(basePos.z.toFixed(3)) },
        flightPhase,
        cameraMode,
        realDemActive: env.isRealDemLoaded,
        terrainMslMeters: env.baseElevationMsl,
        osmBuildingsCount: env.totalOsmBuildings,
        osmRoadsCount: env.totalOsmRoads,
        visualClearance: env.checkBuildingClearance(basePos),
      };
      (window as any).__skynav3DCamera = {
        position: cameraRef.current ? {
          x: parseFloat(cameraRef.current.position.x.toFixed(2)),
          y: parseFloat(cameraRef.current.position.y.toFixed(2)),
          z: parseFloat(cameraRef.current.position.z.toFixed(2)),
        } : null,
        mode: cameraMode,
      };
    }

    // Record Traversed Path Point
    if (flightPhase !== 'idle' && flightPhase !== 'completed') {
      historyPointsRef.current.push(basePos.clone());
      if (historyPointsRef.current.length > 200) {
        historyPointsRef.current.shift();
      }
      env.updateTraversedPath(basePos, historyPointsRef.current);
    }

    // 2. Camera Positioning Modes
    if (cameraMode === 'fpv') {
      // Drone POV: First-person cockpit/nose camera attached to drone because user explicitly selected POV
      const rad = -(headingDeg * Math.PI) / 180;
      const forwardX = Math.sin(rad);
      const forwardZ = -Math.cos(rad);
      const targetCameraPos = new THREE.Vector3(basePos.x + forwardX * 0.45, basePos.y + 0.25, basePos.z + forwardZ * 0.45);
      const targetLookAt = new THREE.Vector3(basePos.x + forwardX * 25, basePos.y - 0.1, basePos.z + forwardZ * 25);
      camera.position.lerp(targetCameraPos, 0.4);
      camera.lookAt(targetLookAt);
    } else if (cameraMode === 'follow') {
      // Smooth 3rd-person chase camera (only when explicitly selected by user)
      const rad = -(headingDeg * Math.PI) / 180;
      const forwardX = Math.sin(rad);
      const forwardZ = -Math.cos(rad);
      const targetCameraPos = new THREE.Vector3(basePos.x - forwardX * 8, basePos.y + 4.5, basePos.z - forwardZ * 8);
      const targetLookAt = new THREE.Vector3(basePos.x + forwardX * 5, basePos.y + 1, basePos.z + forwardZ * 5);
      camera.position.lerp(targetCameraPos, 0.2);
      camera.lookAt(targetLookAt);
    } else if (cameraMode === 'top') {
      // Fixed Nadir Top-Down View of Kurumbapalayam corridor
      const targetCameraPos = new THREE.Vector3(0, 85, 0.1);
      const targetLookAt = new THREE.Vector3(0, 0, 0);
      camera.position.lerp(targetCameraPos, 0.2);
      camera.lookAt(targetLookAt);
    } else if (cameraMode === 'customer') {
      // Fixed Customer Destination View
      const targetCameraPos = new THREE.Vector3(env.customerPadPosition.x + 12, 10, env.customerPadPosition.z + 10);
      const targetLookAt = new THREE.Vector3(env.customerPadPosition.x, 1, env.customerPadPosition.z);
      camera.position.lerp(targetCameraPos, 0.2);
      camera.lookAt(targetLookAt);
    } else if (cameraMode === 'obstacle') {
      // Close up on obstacle conflict zone
      const targetCameraPos = new THREE.Vector3(15, 20, 10);
      const targetLookAt = new THREE.Vector3(env.obstaclePosition.x, 14, env.obstaclePosition.z);
      camera.position.lerp(targetCameraPos, 0.2);
      camera.lookAt(targetLookAt);
    } else if (cameraMode === 'hub') {
      // Logistics Hub View: SkyHub Kurumbapalayam
      const targetCameraPos = new THREE.Vector3(16, 8, -48);
      const targetLookAt = new THREE.Vector3(env.warehousePadPosition.x, 1, env.warehousePadPosition.z);
      camera.position.lerp(targetCameraPos, 0.2);
      camera.lookAt(targetLookAt);
    }
    // When cameraMode === 'operations', camera position and orientation are driven 100% by the user
    // in the 60 FPS animation loop around orbitCenterRef.current. Telemetry updates never touch the camera!
  }, [activeScene, cameraMode, isRerouted, isObstacleInjected, playbackProgress, liveDrone, liveDrone?.location?.lat, liveDrone?.location?.lng, liveDrone?.location?.altitude, liveMission]);

  return (
    <div className="relative w-full h-full min-h-[440px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl bg-slate-950">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Interactive 3D Watermark & Instructions Overlay */}
      <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest shadow-lg">
          3D WebGL Digital Twin • Real DEM (AWS SRTM) • Real OSM Buildings (2,066) • ESRI Satellite
        </span>
        {cameraMode === 'operations' && (
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-lg bg-slate-900/60 backdrop-blur-sm text-[10px] text-slate-400 font-mono">
            🖱 Drag to orbit • Scroll to zoom
          </span>
        )}
      </div>
    </div>
  );
};
