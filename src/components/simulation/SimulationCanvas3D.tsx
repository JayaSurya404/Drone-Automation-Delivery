import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DroneModel3D, DroneAnimationState } from './DroneModel3D';
import { Environment3D, EnvironmentSettings } from './Environment3D';
import { StoryScene, MultiDroneSimState, MULTI_DRONE_FLEET } from './simulationStories';

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
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Three.js instances stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const droneModelRef = useRef<DroneModel3D | null>(null);
  const multiDronesRef = useRef<DroneModel3D[]>([]);
  const environmentRef = useRef<Environment3D | null>(null);

  // Mouse orbit interaction state for operations view
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitAnglesRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 45,
  });

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

    // Mouse Orbit Listeners for 3D Operations View
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - prevMousePosRef.current.x;
      const deltaY = e.clientY - prevMousePosRef.current.y;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      orbitAnglesRef.current.theta -= deltaX * 0.008;
      orbitAnglesRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2.1, orbitAnglesRef.current.phi - deltaY * 0.008));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitAnglesRef.current.radius = Math.max(10, Math.min(100, orbitAnglesRef.current.radius + e.deltaY * 0.05));
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domEl.addEventListener('wheel', handleWheel, { passive: false });

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

  // Update Drone & Camera on Scene and Progress Updates
  useEffect(() => {
    const drone = droneModelRef.current;
    const camera = cameraRef.current;
    const env = environmentRef.current;
    if (!drone || !camera || !env) return;

    // 1. Calculate Target Position based on Scene and Reroute
    const basePos = activeScene.dronePos.clone();
    const baseRot = activeScene.droneRot.clone();

    // Adjust for Reroute West deviation
    if (isRerouted && (activeScene.id === 8 || activeScene.id === 9 || activeScene.id === 10)) {
      basePos.x = -7.5;
    }

    // Determine Propeller RPM based on flight state
    let targetRpm = 0;
    if (activeScene.flightPhase === 'preflight') targetRpm = 1200;
    else if (activeScene.flightPhase === 'takeoff' || activeScene.flightPhase === 'climb') targetRpm = 6800;
    else if (activeScene.flightPhase === 'cruise' || activeScene.flightPhase === 'return') targetRpm = 7600;
    else if (activeScene.flightPhase === 'hover') targetRpm = 6000;
    else if (activeScene.flightPhase === 'descent') targetRpm = 4500;
    else if (activeScene.flightPhase === 'delivered') targetRpm = 5200;
    else if (activeScene.flightPhase === 'completed') targetRpm = 0;

    const droneState: DroneAnimationState = {
      position: basePos,
      rotation: baseRot,
      rotorSpeed: targetRpm,
      flightPhase: activeScene.flightPhase,
      status: activeScene.status,
      payloadAttached: activeScene.payloadAttached,
      obstacleScanning: activeScene.obstacleScanning || isObstacleInjected,
    };

    drone.update(0.016, droneState);
    drone.setHighlightStatus(activeScene.status);

    // Record Traversed Path Point
    if (activeScene.flightPhase !== 'idle') {
      historyPointsRef.current.push(basePos.clone());
      if (historyPointsRef.current.length > 200) {
        historyPointsRef.current.shift();
      }
      env.updateTraversedPath(basePos, historyPointsRef.current);
    }

    // 2. Camera Positioning Modes
    const targetCameraPos = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();

    if (cameraMode === 'fpv') {
      // Drone Cockpit FPV (Gimbal nose camera)
      targetCameraPos.set(basePos.x, basePos.y + 0.1, basePos.z + 0.6);
      if (activeScene.heading === 180) {
        targetLookAt.set(basePos.x, basePos.y - 0.2, basePos.z - 15);
      } else {
        targetLookAt.set(basePos.x, basePos.y - 0.2, basePos.z + 15);
      }
    } else if (cameraMode === 'follow') {
      // Smooth 3rd-person chase camera trailing drone
      if (activeScene.heading === 180) {
        targetCameraPos.set(basePos.x, basePos.y + 4.5, basePos.z + 10);
        targetLookAt.set(basePos.x, basePos.y + 1, basePos.z - 8);
      } else {
        targetCameraPos.set(basePos.x, basePos.y + 4.5, basePos.z - 10);
        targetLookAt.set(basePos.x, basePos.y + 1, basePos.z + 8);
      }
    } else if (cameraMode === 'top') {
      // Nadir Top-Down View
      targetCameraPos.set(basePos.x, 70, basePos.z + 0.1);
      targetLookAt.set(basePos.x, 0, basePos.z);
    } else if (cameraMode === 'customer') {
      // Customer Destination View
      targetCameraPos.set(12, 10, 48);
      targetLookAt.set(env.customerPadPosition.x, 1, env.customerPadPosition.z);
    } else if (cameraMode === 'obstacle') {
      // Close up on obstacle conflict zone
      targetCameraPos.set(15, 20, 10);
      targetLookAt.set(env.obstaclePosition.x, 14, env.obstaclePosition.z);
    } else if (cameraMode === 'hub') {
      // Logistics Hub View
      targetCameraPos.set(14, 8, -48);
      targetLookAt.set(env.warehousePadPosition.x, 1, env.warehousePadPosition.z);
    } else {
      // Default: 3D Operations Orbital View
      const { theta, phi, radius } = orbitAnglesRef.current;
      targetCameraPos.x = basePos.x + radius * Math.sin(phi) * Math.sin(theta);
      targetCameraPos.y = Math.max(5, basePos.y + radius * Math.cos(phi));
      targetCameraPos.z = basePos.z + radius * Math.sin(phi) * Math.cos(theta);
      targetLookAt.copy(basePos);
    }

    camera.position.lerp(targetCameraPos, 0.2);
    camera.lookAt(targetLookAt);
  }, [activeScene, cameraMode, isRerouted, isObstacleInjected, playbackProgress]);

  return (
    <div className="relative w-full h-full min-h-[440px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl bg-slate-950">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Interactive 3D Watermark & Instructions Overlay */}
      <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest shadow-lg">
          3D WebGL Digital Twin • 60 FPS
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
