import React, { useState, useEffect, useRef } from 'react';
import {
  AUTONOMOUS_DELIVERY_STORY,
  HOW_SKYNAV_WORKS_STORY,
  MULTI_DRONE_FLEET,
  StoryScene,
} from '../../components/simulation/simulationStories';
import { SimulationCanvas3D } from '../../components/simulation/SimulationCanvas3D';
import { SimulatedDroneCameraHUD } from '../../components/simulation/SimulatedDroneCameraHUD';
import { SimulationStoryTimeline } from '../../components/simulation/SimulationStoryTimeline';
import { SimulationTelemetryCharts } from '../../components/simulation/SimulationTelemetryCharts';
import { SimulationScoreModal } from '../../components/simulation/SimulationScoreModal';
import { InteractiveOpsMap } from '../../components/maps/InteractiveOpsMap';
import { useOperationsModals } from '../../context/OperationsModalContext';
import { mockStore } from '../../services/mockDataStore';
import { Drone, Mission } from '../../types/skynav';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Radio,
  Bot,
  Zap,
  ShieldCheck,
  Compass,
  Gauge,
  Wind,
  Sun,
  Moon,
  CloudRain,
  Eye,
  Crosshair,
  Layers,
  MapPin,
  AlertTriangle,
  Award,
  BookOpen,
  Info,
  Maximize2,
  RefreshCw,
  Flame,
  CheckCircle2,
  Cpu,
} from 'lucide-react';

export const SimulationCenter: React.FC = () => {
  const { openDigitalTwin } = useOperationsModals();

  // Active Authoritative Live Mission Drone State
  const [activeLiveDrone, setActiveLiveDrone] = useState<Drone | null>(null);
  const [activeLiveMission, setActiveLiveMission] = useState<Mission | null>(null);

  useEffect(() => {
    const handleStoreUpdate = () => {
      const allDrones = mockStore.getDrones();
      const allMissions = mockStore.getMissions();
      const active = allDrones.find(
        (d) => d.status === 'in_flight' || d.status === 'returning' || d.status === 'charging' || (d.status as any) === 'touchdown'
      ) || allDrones.find((d) => d.id === 'D-001') || allDrones[0] || null;
      setActiveLiveDrone(active ? { ...active, location: { ...active.location } } : null);
      if (active) {
        const mis = allMissions.find((m) => m.droneId === active.id || m.id === active.currentMissionId) || null;
        setActiveLiveMission(mis ? { ...mis } : null);
      } else {
        setActiveLiveMission(null);
      }
    };

    handleStoreUpdate();
    return mockStore.subscribe(handleStoreUpdate);
  }, []);

  // Scenario & Playback State
  const [scenarioType, setScenarioType] = useState<string>('story');
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1); // 0.5, 1, 2, 4
  const [sceneProgress, setSceneProgress] = useState<number>(0);

  // Camera & View Mode
  const [cameraMode, setCameraMode] = useState<
    'operations' | 'follow' | 'fpv' | 'top' | 'customer' | 'obstacle' | 'hub'
  >('operations');
  const [viewLayout, setViewLayout] = useState<'3d' | 'map' | 'split'>('3d');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__skynavSetCameraMode = (mode: string) => {
        setCameraMode(mode as any);
      };
    }
  }, []);

  // Environment Settings
  const [environmentSettings, setEnvironmentSettings] = useState({
    weather: 'clear' as 'clear' | 'cloudy' | 'rain' | 'wind' | 'storm',
    timeOfDay: 'day' as 'day' | 'sunset' | 'night',
    visibility: 'high' as 'high' | 'medium' | 'low',
  });

  // Obstacle & Reroute Flags
  const [isObstacleInjected, setIsObstacleInjected] = useState<boolean>(false);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState<boolean>(false);

  // Live Telemetry History for Charts
  const [telemetryHistory, setTelemetryHistory] = useState<
    { time: string; altitude: number; speed: number; battery: number; temp: number }[]
  >([
    { time: '12:03:00', altitude: 0, speed: 0, battery: 94, temp: 28 },
    { time: '12:03:30', altitude: 20, speed: 14, battery: 93, temp: 32 },
    { time: '12:04:00', altitude: 80, speed: 48, battery: 88, temp: 36 },
  ]);

  // Live Event Feed List
  const [eventFeed, setEventFeed] = useState<string[]>([
    '12:03:14 — Order ORD-10482 received from KMCH Care Center.',
    '12:03:16 — Mission MIS-20491 created with high-priority airspace reservation.',
    '12:03:18 — Asset D-024 assigned to Mission MIS-20491.',
  ]);

  const currentScene = AUTONOMOUS_DELIVERY_STORY[currentSceneIndex] || AUTONOMOUS_DELIVERY_STORY[0];
  const isRerouted = currentScene.isRerouted || isObstacleInjected;

  // Active Story Timer / Playback Loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = 100;
    const step = (intervalMs / 1000 / currentScene.duration) * simSpeed;

    const timer = setInterval(() => {
      setSceneProgress((prev) => {
        const next = prev + step;
        if (next >= 1.0) {
          // Advance to next scene
          if (currentSceneIndex < AUTONOMOUS_DELIVERY_STORY.length - 1) {
            setCurrentSceneIndex((idx) => {
              const newIdx = idx + 1;
              const nextSc = AUTONOMOUS_DELIVERY_STORY[newIdx];

              // Update Event Feed
              setEventFeed((feeds) => [nextSc.eventLog, ...feeds.slice(0, 14)]);

              // Update Telemetry Chart
              const nowStr = new Date().toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour12: false,
                minute: '2-digit',
                second: '2-digit',
              });
              setTelemetryHistory((hist) => [
                ...hist.slice(-15),
                {
                  time: nowStr,
                  altitude: nextSc.altitude,
                  speed: nextSc.speed,
                  battery: nextSc.battery,
                  temp: nextSc.temperature,
                },
              ]);

              return newIdx;
            });
            return 0;
          } else {
            // Reached End of Story
            setIsPlaying(false);
            setIsScoreModalOpen(true);
            return 1.0;
          }
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, currentSceneIndex, simSpeed, currentScene.duration]);

  // Restart / Replay Helper
  const handleRestart = () => {
    setCurrentSceneIndex(0);
    setSceneProgress(0);
    setIsPlaying(true);
    setIsObstacleInjected(false);
    setEventFeed([AUTONOMOUS_DELIVERY_STORY[0].eventLog]);
  };

  // Run Full Autonomous Demonstration Mode
  const handleRunFullDemo = () => {
    setScenarioType('story');
    handleRestart();
    setSimSpeed(1);
    setCameraMode('follow');
  };

  // Run Educational Walkthrough
  const handleRunHowItWorks = () => {
    setScenarioType('how_it_works');
    handleRestart();
    setSimSpeed(1);
    setCameraMode('operations');
  };

  // Manual Jump to Scene
  const handleJumpToScene = (index: number) => {
    setCurrentSceneIndex(index);
    setSceneProgress(0);
    const targetSc = AUTONOMOUS_DELIVERY_STORY[index];
    setEventFeed((feeds) => [targetSc.eventLog, ...feeds.slice(0, 14)]);
  };

  // Inject Obstacle On-the-fly
  const handleInjectObstacle = () => {
    setIsObstacleInjected(true);
    handleJumpToScene(7); // Jump to Scene 08 (Obstacle Detected)
    setCameraMode('obstacle');
  };

  // Production mock data for Hybrid Map View
  const drones = mockStore.getDrones();
  const missions = mockStore.getMissions();
  const orders = mockStore.getOrders();
  const geofences = mockStore.getGeofences();

  return (
    <div className="space-y-5 pb-8">
      {/* =========================================================================
          1. SIMULATION ENVIRONMENT HEADER BANNER (Visually Impossible to Confuse with Prod)
         ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/15 via-cyan-500/15 to-blue-500/15 border-2 border-amber-500/40 dark:border-amber-500/30 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 rounded-full bg-amber-500 animate-ping" />
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono font-black text-xs uppercase tracking-widest border border-amber-500/40">
                ● SIMULATION MODE — ISOLATED DIGITAL TWIN ENVIRONMENT
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              SkyNav Autonomous Drone Story Simulation Center
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl">
              End-to-end 3D physics digital twin: Order Ingestion ➔ Autonomous Takeoff ➔ Flight Corridor ➔ LiDAR Collision Avoidance ➔ Precision Drop ➔ Return to Base.
            </p>
          </div>

          {/* Quick Action Hero Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleRunFullDemo}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 transition-all"
              title="Run complete polished story for presentations & jury review"
            >
              <Sparkles className="w-4 h-4" />
              <span>▶ RUN FULL DEMONSTRATION</span>
            </button>

            <button
              onClick={handleRunHowItWorks}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-xs"
            >
              <BookOpen className="w-4 h-4 text-cyan-500" />
              <span>HOW SKYNAV WORKS</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. SCENARIO SELECTOR & QUICK STORY NAVIGATION STRIP
         ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Scenario Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 text-xs">
          <span className="font-mono text-slate-400 font-bold text-[11px] uppercase mr-1 flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-cyan-500" /> Scenario:
          </span>
          {[
            { id: 'story', label: '1. Urban Medical Delivery (15 Scenes)', badge: 'Default' },
            { id: 'how_it_works', label: '2. Educational Guided Walkthrough', badge: 'Learn' },
            { id: 'multi_drone', label: '3. Multi-Drone City Fleet (5 UAVs)', badge: 'Fleet' },
            { id: 'battery', label: '4. Critical Battery & RTH Divert', badge: 'Incident' },
            { id: 'gps', label: '5. RTK GPS Loss & Optical Flow', badge: 'Incident' },
          ].map((sc) => (
            <button
              key={sc.id}
              onClick={() => {
                setScenarioType(sc.id);
                handleRestart();
              }}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                scenarioType === sc.id
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Inject Obstacle Trigger */}
        <button
          onClick={handleInjectObstacle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold text-xs hover:bg-amber-500/25 transition-all shrink-0"
          title="Simulate dynamic collision obstacle appearing in flight corridor"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>Inject Dynamic Obstacle</span>
        </button>
      </div>

      {/* =========================================================================
          3. STORY PROGRESS TIMELINE STEPPER
         ========================================================================= */}
      <SimulationStoryTimeline
        scenes={AUTONOMOUS_DELIVERY_STORY}
        currentSceneIndex={currentSceneIndex}
        onSelectScene={handleJumpToScene}
        progressInScene={sceneProgress}
      />

      {/* =========================================================================
          4. MAIN SIMULATION VIEWPORT (3D Canvas / FPV Camera / Leaflet Hybrid Map)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left 3 Cols: Dominant 3D Simulation Viewport */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative w-full h-[540px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl bg-slate-950">
            {/* View Layout Controller */}
            {viewLayout === '3d' && (
              <div className="relative w-full h-full">
                <SimulationCanvas3D
                  activeScene={currentScene}
                  scenarioType={scenarioType}
                  cameraMode={cameraMode}
                  environmentSettings={environmentSettings}
                  isObstacleInjected={isObstacleInjected}
                  isRerouted={isRerouted}
                  onDroneClick={(dId) => openDigitalTwin(dId)}
                  playbackProgress={sceneProgress}
                  isPlaying={isPlaying}
                  liveDrone={activeLiveDrone}
                  liveMission={activeLiveMission}
                />

                {/* Drone Cockpit FPV HUD Overlay (when cameraMode is FPV) */}
                {cameraMode === 'fpv' && (
                  <SimulatedDroneCameraHUD
                    scene={currentScene}
                    isObstacleAlert={isObstacleInjected || currentScene.isObstaclePresent}
                  />
                )}
              </div>
            )}

            {viewLayout === 'map' && (
              <div className="w-full h-full">
                <InteractiveOpsMap
                  drones={drones}
                  missions={missions}
                  orders={orders}
                  geofences={geofences}
                  selectedDroneId={activeLiveDrone?.id || 'D-024'}
                  heightClass="h-full"
                />
              </div>
            )}

            {viewLayout === 'split' && (
              <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full">
                <div className="relative h-full border-r border-slate-800">
                  <SimulationCanvas3D
                    activeScene={currentScene}
                    scenarioType={scenarioType}
                    cameraMode={cameraMode}
                    environmentSettings={environmentSettings}
                    isObstacleInjected={isObstacleInjected}
                    isRerouted={isRerouted}
                    onDroneClick={(dId) => openDigitalTwin(dId)}
                    playbackProgress={sceneProgress}
                    isPlaying={isPlaying}
                    liveDrone={activeLiveDrone}
                    liveMission={activeLiveMission}
                  />
                </div>
                <div className="h-full">
                  <InteractiveOpsMap
                    drones={drones}
                    missions={missions}
                    orders={orders}
                    geofences={geofences}
                    selectedDroneId={activeLiveDrone?.id || 'D-024'}
                    heightClass="h-full"
                  />
                </div>
              </div>
            )}

            {/* Bottom-Left Camera Mode Switcher Pill */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-2xl text-xs">
              {[
                { id: 'operations', label: 'External View', icon: Eye },
                { id: 'follow', label: 'Follow Drone', icon: Bot },
                { id: 'fpv', label: 'Drone POV', icon: Crosshair },
                { id: 'top', label: 'Top View', icon: Compass },
              ].map((cam) => {
                const Icon = cam.icon;
                const isCurrent = cameraMode === cam.id;
                return (
                  <button
                    key={cam.id}
                    data-camera-mode={cam.id}
                    onClick={() => setCameraMode(cam.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                      isCurrent
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cam.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Top-Right Layout Mode Switcher (3D / 2D Map / Split) */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1 p-1 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs">
              {[
                { id: '3d', label: '3D View' },
                { id: 'map', label: '2D Map' },
                { id: 'split', label: 'Hybrid Split' },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setViewLayout(v.id as any)}
                  className={`px-3 py-1.2 rounded-xl font-bold text-[11px] transition-all ${
                    viewLayout === v.id
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* =========================================================================
              5. STORY PLAYBACK CONTROLLER & SPEED BAR
             ========================================================================= */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pause Story' : 'Play Story'}</span>
              </button>

              <button
                onClick={() => handleJumpToScene(Math.max(0, currentSceneIndex - 1))}
                disabled={currentSceneIndex === 0}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40"
                title="Previous Scene"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleJumpToScene(Math.min(AUTONOMOUS_DELIVERY_STORY.length - 1, currentSceneIndex + 1))}
                disabled={currentSceneIndex === AUTONOMOUS_DELIVERY_STORY.length - 1}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40"
                title="Next Scene"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleRestart}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                title="Restart Simulation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Current Scene Badge & Title */}
            <div className="text-center sm:text-left">
              <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold uppercase tracking-wider block">
                {currentScene.sceneNumber} • {currentScene.badge}
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {currentScene.title}
              </h3>
            </div>

            {/* Speed Multiplier Controls */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-[10px] text-slate-400 font-mono px-2">Speed:</span>
              {[0.5, 1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimSpeed(spd)}
                  className={`px-2.5 py-1 rounded-xl font-bold font-mono text-xs transition-all ${
                    simSpeed === spd
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* =========================================================================
              6. AUTONOMOUS DECISION CARD & SCENE EXPLANATION
             ========================================================================= */}
          {currentScene.decisionAlert && (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-950 text-white border-2 border-cyan-500/40 shadow-xl flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 shrink-0">
                <Cpu className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[10px] uppercase">
                    ● SKYNAV AUTONOMOUS DECISION ENGINE
                  </span>
                  <span className="font-mono text-slate-400 text-[10px]">Latency: 42ms</span>
                </div>
                <h4 className="text-sm font-black text-cyan-400">{currentScene.decisionAlert.title}</h4>
                <p className="text-xs text-slate-200 leading-relaxed font-mono">
                  {currentScene.decisionAlert.details} — {currentScene.decisionAlert.reason}
                </p>
              </div>
            </div>
          )}

          {/* Plain English Story Narration Card */}
          <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Autonomous Flight Story Narrative:
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              {currentScene.explanation}
            </p>
          </div>
        </div>

        {/* Right 1 Col: Live Telemetry Gauges, Mission Event Feed & Environment Controls */}
        <div className="space-y-4">
          {/* Live Telemetry Panel */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-black text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-500" /> LIVE TELEMETRY
              </h3>
              <button
                onClick={() => openDigitalTwin('D-024')}
                className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold hover:underline"
              >
                Inspect Twin ➔
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] block">ALTITUDE</span>
                <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {activeLiveDrone ? `${activeLiveDrone.location.altitude || 0} m` : `${currentScene.altitude} m`}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] block">AIRSPEED</span>
                <span className="font-black text-sm text-cyan-600 dark:text-cyan-400">
                  {activeLiveDrone ? `${activeLiveDrone.location.speed || 0} km/h` : `${currentScene.speed} km/h`}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] block">BATTERY (SoC)</span>
                <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {activeLiveDrone ? `${activeLiveDrone.battery}%` : `${currentScene.battery}%`}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] block">MISSION STATE</span>
                <span className="font-black text-sm text-amber-600 dark:text-amber-400 uppercase">
                  {activeLiveDrone ? activeLiveDrone.status : `${currentScene.temperature}°C`}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] block">DISTANCE REM</span>
                <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                  {activeLiveDrone ? `${activeLiveDrone.remainingDistanceKm ?? 0} km` : `${currentScene.distanceTraveledKm} km`}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] block">HEADING</span>
                <span className="font-black text-sm text-blue-600 dark:text-blue-400">
                  {activeLiveDrone ? `${activeLiveDrone.location.heading || 0}°` : `${currentScene.etaMinutes} min`}
                </span>
              </div>
            </div>

            {/* Battery Progress Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Power Source: Autonomous LiPo</span>
                <span className="font-bold text-emerald-500">
                  {activeLiveDrone ? `${activeLiveDrone.battery}%` : '4.18V/cell'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${activeLiveDrone ? activeLiveDrone.battery : currentScene.battery}%` }}
                />
              </div>
            </div>
          </div>

          {/* Live Mission Event Feed */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-black text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-500 animate-pulse" /> MISSION EVENT LOG
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Live IST</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {eventFeed.map((msg, i) => (
                <div
                  key={i}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-[11px] font-mono text-slate-600 dark:text-slate-300 leading-snug"
                >
                  {msg}
                </div>
              ))}
            </div>
          </div>

          {/* Environment & Weather Presets */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-black text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Wind className="w-4 h-4 text-cyan-500" /> ENVIRONMENT CONTROLS
            </h3>

            {/* Time of Day */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase">Time of Day:</span>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                {[
                  { id: 'day', label: 'Day', icon: Sun },
                  { id: 'sunset', label: 'Sunset', icon: Flame },
                  { id: 'night', label: 'Night', icon: Moon },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setEnvironmentSettings((prev) => ({ ...prev, timeOfDay: t.id as any }))}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-xl transition-all ${
                        environmentSettings.timeOfDay === t.id
                          ? 'bg-cyan-500 text-slate-950 font-black'
                          : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weather Preset */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase">Weather:</span>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                {[
                  { id: 'clear', label: 'Clear' },
                  { id: 'rain', label: 'Rain' },
                  { id: 'storm', label: 'Wind/Storm' },
                ].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setEnvironmentSettings((prev) => ({ ...prev, weather: w.id as any }))}
                    className={`py-1.5 rounded-xl transition-all text-center ${
                      environmentSettings.weather === w.id
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          7. REAL-TIME TELEMETRY CHARTS DRAWER
         ========================================================================= */}
      <SimulationTelemetryCharts
        telemetryHistory={telemetryHistory}
        currentAltitude={currentScene.altitude}
        currentSpeed={currentScene.speed}
        currentBattery={currentScene.battery}
        currentTemp={currentScene.temperature}
      />

      {/* =========================================================================
          8. POST-SIMULATION PERFORMANCE SCORE & AUDIT MODAL
         ========================================================================= */}
      {isScoreModalOpen && (
        <SimulationScoreModal
          isOpen={isScoreModalOpen}
          onClose={() => setIsScoreModalOpen(false)}
          onReplay={handleRestart}
          scenarioTitle={currentScene.title}
          droneId="D-024"
        />
      )}
    </div>
  );
};
