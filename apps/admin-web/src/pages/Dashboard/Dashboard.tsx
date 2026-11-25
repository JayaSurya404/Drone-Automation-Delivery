import React, { useState, useEffect, useRef } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { KpiCard } from '../../components/common/KpiCard';
import { InteractiveOpsMap } from '../../components/maps/InteractiveOpsMap';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Drone3DHero } from '../../components/drone/Drone3DHero';
import { DroneVisual } from '../../components/drone/DroneVisual';
import {
  ShoppingBag,
  Send,
  Bot,
  PlaneTakeoff,
  BatteryCharging,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Radio,
  AlertOctagon,
  ArrowRight,
  Wrench,
  AlertTriangle,
  BatteryWarning,
  CloudSun,
  Wind,
  Droplets,
  ShieldCheck,
  TrendingUp,
  Percent,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOperationsModals } from '../../context/OperationsModalContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openDigitalTwin, openMissionReplay, openSimulation } = useOperationsModals();
  const [drones, setDrones] = useState(mockStore.getDrones());
  const [orders, setOrders] = useState(mockStore.getOrders());
  const [missions, setMissions] = useState(mockStore.getMissions());
  const [emergencies, setEmergencies] = useState(mockStore.getEmergencies());
  const [geofences, setGeofences] = useState(mockStore.getGeofences());
  const [currentTime, setCurrentTime] = useState(new Date());

  const carouselRef = useRef<HTMLDivElement>(null);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return mockStore.subscribe(() => {
      setDrones([...mockStore.getDrones()]);
      setOrders([...mockStore.getOrders()]);
      setMissions([...mockStore.getMissions()]);
      setEmergencies([...mockStore.getEmergencies()]);
      setGeofences([...mockStore.getGeofences()]);
    });
  }, []);

  // Compute 13 smart KPI metrics
  const totalDeliveries = orders.length;
  const activeDeliveries = orders.filter((o) => o.status === 'in_transit').length;
  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'drone_assigned').length;
  const completedDeliveries = orders.filter((o) => o.status === 'delivered').length;
  const activeMissionsCount = missions.filter((m) => m.currentStatus === 'in_flight').length;
  const dronesInFlight = drones.filter((d) => d.status === 'in_flight').length;
  const availableDrones = drones.filter((d) => d.status === 'available').length;
  const dronesCharging = drones.filter((d) => d.status === 'charging').length;
  const maintenanceCount = drones.filter((d) => d.status === 'maintenance').length;
  const avgFleetHealth = Math.round(drones.reduce((acc, d) => acc + d.batteryHealth, 0) / drones.length);
  const successRate = ((completedDeliveries / (completedDeliveries + orders.filter((o) => o.status === 'failed').length || 1)) * 100).toFixed(1);
  const totalRevenue = orders.reduce((acc, o) => acc + (o.paymentStatus === 'successful' ? o.paymentAmount : 0), 0);

  const kpis = [
    { title: 'Total Orders', value: totalDeliveries, change: '+14.2%', isPositive: true, icon: ShoppingBag, subtitle: 'Lifetime orders' },
    { title: 'Active Deliveries', value: activeDeliveries, change: `${activeDeliveries} in transit`, isPositive: true, icon: Send, subtitle: 'Airborne parcels' },
    { title: 'Pending Orders', value: pendingOrders, change: 'Auto-dispatching', isPositive: true, icon: Clock, subtitle: 'Queued requests' },
    { title: 'Completed Deliveries', value: completedDeliveries, change: `${successRate}% SLA`, isPositive: true, icon: CheckCircle2, subtitle: 'Confirmed dropoffs' },
    { title: 'Active Missions', value: activeMissionsCount, change: '100% Live GPS', isPositive: true, icon: Radio, subtitle: 'Airspace corridors' },
    { title: 'Drones In Flight', value: dronesInFlight, change: '34 km/h avg', isPositive: true, icon: PlaneTakeoff, subtitle: 'Operational fleet' },
    { title: 'Available Drones', value: availableDrones, change: `${availableDrones}/40 Ready`, isPositive: true, icon: Bot, subtitle: 'Base readiness' },
    { title: 'Drones Charging', value: dronesCharging, change: 'Fast-Charge Hub', isPositive: true, icon: BatteryCharging, subtitle: 'Rapid charging' },
    { title: 'Maintenance Units', value: maintenanceCount, change: '3 Scheduled', isPositive: false, icon: Wrench, subtitle: 'Hangars active' },
    { title: 'Fleet Health Index', value: `${avgFleetHealth}%`, change: 'Nominal ESC', isPositive: true, icon: Activity, subtitle: 'Battery & ESC Grade' },
    { title: 'Success Rate', value: `${successRate}%`, change: '+0.8% MoM', isPositive: true, icon: Percent, subtitle: 'First-attempt drop' },
    { title: 'Avg Delivery Time', value: '14.2 min', change: '-2.1 min', isPositive: true, icon: TrendingUp, subtitle: 'Point-to-point' },
    { title: 'Total Revenue', value: `₹${(totalRevenue * 82).toLocaleString('en-IN')}`, change: '+18.4%', isPositive: true, icon: DollarSign, subtitle: 'Settled payments' },
  ];

  // Auto-scroll carousel every 4 seconds unless hovered
  useEffect(() => {
    if (isCarouselHovered) return;
    const interval = setInterval(() => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
        const maxScroll = scrollWidth - clientWidth;
        const nextScroll = scrollLeft + 280 >= maxScroll ? 0 : scrollLeft + 280;
        carouselRef.current.scrollTo({ left: nextScroll, behavior: 'smooth' });
        setCarouselIndex(Math.floor(nextScroll / 280));
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [isCarouselHovered]);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Mock hourly telemetry trend data
  const hourlyTelemetry = [
    { time: '06:00', flights: 4, speed: 32 },
    { time: '08:00', flights: 11, speed: 38 },
    { time: '10:00', flights: 17, speed: 42 },
    { time: '12:00', flights: 15, speed: 39 },
    { time: '14:00', flights: 18, speed: 44 },
    { time: '16:00', flights: 16, speed: 36 },
    { time: '18:00', flights: 12, speed: 34 },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Command Bar: Title + Subtitle + Live IST Time + System Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> SKYNAV COMMAND CENTER • {user?.role.replace(/_/g, ' ').toUpperCase() || 'OPERATIONS'}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Good Morning, {user?.name || 'Administrator'} 👋
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Autonomous delivery operations overview • Coimbatore Airspace Hub
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs shadow-sm whitespace-nowrap font-mono shrink-0">
            <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
            </span>
            <span className="px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold text-[9px]">
              IST
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 shadow-sm whitespace-nowrap shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="text-[10px] tracking-wider uppercase">ALL SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </div>

      {/* 2. Hero Operations Panel (Section 17): Live stats + Interactive 3D Commercial Drone */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 p-6 md:p-8 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="space-y-4 max-w-xl z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-xs font-bold font-mono text-cyan-700 dark:text-cyan-300">
            <PlaneTakeoff className="w-3.5 h-3.5 text-cyan-500" />
            <span>COMMERCIAL AUTONOMOUS AIRSPACE ACTIVE</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
            17 Drones Airborne. <br />
            <span className="text-cyan-600 dark:text-cyan-400">8 Deliveries in Progress.</span>
          </h2>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Autonomous fleet operating across Peelamedu Tech Park, RS Puram, and Gandhipuram. All active routes maintain 98.4% corridor precision under DGCA safety limits.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              onClick={() => navigate('/operations')}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all"
            >
              <Radio className="w-4 h-4" /> Live Airspace
            </button>
            <button
              onClick={() => openDigitalTwin('D-024')}
              className="px-3.5 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold rounded-2xl text-xs flex items-center gap-1.5 border border-cyan-500/30 transition-all shadow-sm"
            >
              <Bot className="w-4 h-4 text-cyan-500" /> Digital Twin (D-024)
            </button>
            <button
              onClick={() => openSimulation('deviation')}
              className="px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold rounded-2xl text-xs flex items-center gap-1.5 border border-amber-500/30 transition-all shadow-sm"
            >
              <Zap className="w-4 h-4 text-amber-500" /> Scenario Engine
            </button>
            <button
              onClick={() => navigate('/emergency')}
              className="px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold rounded-2xl text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 transition-all shadow-sm"
            >
              <AlertOctagon className="w-4 h-4 text-rose-500" /> Emergency
            </button>
          </div>
        </div>

        {/* Photorealistic 3D Commercial Drone Visualizer */}
        <div className="relative z-10 shrink-0 w-full max-w-sm lg:max-w-md">
          <Drone3DHero
            id="D-024"
            model="SKYNAV X1"
            status="IN FLIGHT"
            battery={78}
            altitude={82}
            speed={34}
          />
        </div>
      </div>

      {/* 3. Smart KPI Carousel (Section 18): 13 Metrics + Carousel controls */}
      <div
        onMouseEnter={() => setIsCarouselHovered(true)}
        onMouseLeave={() => setIsCarouselHovered(false)}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Logistics Performance & Airspace KPIs
            </h2>
            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">({kpis.length} Live Metrics)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollCarousel('left')}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm"
              title="Previous KPIs"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollCarousel('right')}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm"
              title="Next KPIs"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-none custom-scrollbar snap-x"
        >
          {kpis.map((kpi) => (
            <div key={kpi.title} className="min-w-[240px] shrink-0 snap-start">
              <KpiCard {...kpi} />
            </div>
          ))}
        </div>
      </div>

      {/* 4. "REQUIRES ATTENTION" AI-Style Action Panel (Section 19) */}
      <div className="rounded-3xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 backdrop-blur-xl shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 animate-bounce" />
            <h3 className="text-sm font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              REQUIRES ATTENTION — AIRSPACE INTELLIGENCE
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40">
            4 Operational Alerts Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Critical Battery Alert */}
          <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-rose-500/40 p-3.5 space-y-2 shadow-md">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 font-mono font-bold text-[10px]">
                🚨 CRITICAL BATTERY
              </span>
              <span className="font-bold text-rose-500">18%</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">D-018 (SKYNAV X2)</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Battery below safe reserve. Mission MS-10281 in transit.</p>
            </div>
            <button
              onClick={() => navigate('/emergency')}
              className="w-full py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-[10px] transition-colors"
            >
              Recall Base (RTH) →
            </button>
          </div>

          {/* Route Deviation Alert */}
          <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-amber-500/40 p-3.5 space-y-2 shadow-md">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono font-bold text-[10px]">
                ⚠ ROUTE DEVIATION
              </span>
              <span className="font-bold text-amber-500">320m Off</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">D-024 (SKYNAV X1)</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Drifted south of corridor on Mission MS-10284.</p>
            </div>
            <button
              onClick={() => navigate('/operations')}
              className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-[10px] transition-colors"
            >
              Re-align Corridor →
            </button>
          </div>

          {/* Maintenance Overdue Alert */}
          <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 p-3.5 space-y-2 shadow-md">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-[10px]">
                🔧 MAINTENANCE DUE
              </span>
              <span className="font-bold text-slate-400">254 hrs</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">D-031 (SKYNAV Cargo)</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">ESC calibration & motor #3 vibration check overdue.</p>
            </div>
            <button
              onClick={() => navigate('/maintenance')}
              className="w-full py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-[10px] transition-colors"
            >
              Schedule Service →
            </button>
          </div>

          {/* Delayed Order Alert */}
          <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 p-3.5 space-y-2 shadow-md">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-400 font-mono font-bold text-[10px]">
                📦 DISPATCH QUEUED
              </span>
              <span className="font-bold text-cyan-500">+4 min</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">ORD-10284 (Rahul Kumar)</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Medical Cardiology Kit waiting for pickup clearance.</p>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="w-full py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-[10px] transition-colors"
            >
              View Order →
            </button>
          </div>
        </div>
      </div>

      {/* 5. Live Operations Dashboard: Real Map on Left + Active Missions on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 Cols): Real Geospatial Map with Satellite/Road/Hybrid layers */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-wide flex items-center gap-2">
              <Radio className="h-4 w-4 text-cyan-500 animate-pulse" /> LIVE DRONE OPERATIONS MAP
            </h2>
            <button
              onClick={() => navigate('/operations')}
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              Expand Full Operations Console <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <InteractiveOpsMap
            drones={drones}
            geofences={geofences}
            orders={orders}
            missions={missions}
            onEmergencyAction={(id, cmd) => mockStore.executeEmergencyCommand(id, cmd)}
            heightClass="h-[520px]"
          />
        </div>

        {/* Right (1 Col): Active Missions List + Airspace Weather Telemetry */}
        <div className="space-y-4">
          {/* Active Missions Preview Card */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Active Flight Missions ({missions.filter((m) => m.currentStatus === 'in_flight').length})
              </h3>
              <button
                onClick={() => navigate('/missions')}
                className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                View All Missions →
              </button>
            </div>

            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
              {missions.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 space-y-2 hover:border-cyan-500/50 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-black text-cyan-600 dark:text-cyan-400">{m.id}</span>
                    <StatusBadge status={m.currentStatus} size="sm" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <button
                      onClick={() => openDigitalTwin(m.droneId)}
                      className="text-cyan-600 dark:text-cyan-400 font-bold hover:underline"
                    >
                      Drone: {m.droneId} ↗
                    </button>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">ETA: {Math.floor((m.etaSeconds || 300) / 60)}m</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800 text-[10px]">
                    <span className="text-slate-500 truncate max-w-[140px]">{m.destinationAddress}</span>
                    <button
                      onClick={() => openMissionReplay(m.id)}
                      className="px-2 py-0.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-700 dark:text-cyan-300 font-bold text-[10px] transition-colors"
                    >
                      ▶ Replay Track
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Environment & Airspace Weather Section (Section 34) */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <CloudSun className="w-4 h-4 text-amber-500" /> AIRSPACE WEATHER TELEMETRY
              </h3>
              <span className="text-[9px] font-mono text-slate-400">Coimbatore Hub</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">TEMPERATURE</span>
                <span className="text-base font-black text-slate-900 dark:text-slate-100">24°C</span>
                <span className="text-[10px] text-emerald-500 font-semibold block">Optimal Cell Temp</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">WIND VELOCITY</span>
                <span className="text-base font-black text-cyan-600 dark:text-cyan-400">11 km/h</span>
                <span className="text-[10px] text-slate-400 block">Direction: 045° NE</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">VISIBILITY</span>
                <span className="text-base font-black text-slate-900 dark:text-slate-100">8.2 km</span>
                <span className="text-[10px] text-emerald-500 font-semibold block">VFR Clear Flight</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">PRECIPITATION</span>
                <span className="text-base font-black text-slate-900 dark:text-slate-100">Low (2%)</span>
                <span className="text-[10px] text-slate-400 block">Dry Corridors</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Fleet Distribution & Delivery Performance Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Airspace Delivery Volume Area Chart */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Airspace Mission Velocity & Traffic Trend
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Hourly airborne flights and transit speed (km/h) across corridors
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold font-mono">
              Peak: 14:00 (18 Drones)
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyTelemetry}>
                <defs>
                  <linearGradient id="colorFlights" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#06b6d4',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Area type="monotone" dataKey="flights" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFlights)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet Status Distribution Breakdown */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Fleet Distribution & Readiness (40 Units)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Current operational readiness breakdown
              </p>
            </div>
            <button
              onClick={() => navigate('/fleet')}
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Fleet Inventory →
            </button>
          </div>

          {/* Visual Distribution Progress Bar */}
          <div className="space-y-2">
            <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
              <div style={{ width: '42.5%' }} className="bg-cyan-500" title="17 In Flight" />
              <div style={{ width: '30%' }} className="bg-emerald-500" title="12 Available" />
              <div style={{ width: '15%' }} className="bg-amber-500" title="6 Charging" />
              <div style={{ width: '7.5%' }} className="bg-slate-400" title="3 Maintenance" />
              <div style={{ width: '5%' }} className="bg-rose-500" title="2 Offline" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                <span className="text-slate-600 dark:text-slate-300">17 In Flight</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-300">12 Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-600 dark:text-slate-300">6 Charging</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span className="text-slate-600 dark:text-slate-300">3 Service</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600 dark:text-slate-300">2 Offline</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-mono">BATTERY HEALTH AVERAGE</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{avgFleetHealth}%</span>
              <span className="text-[10px] text-slate-500 block">Grade A ESC Cells</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-mono">SAFETY COMPLIANCE</span>
              <span className="text-lg font-black text-cyan-600 dark:text-cyan-400">98.4%</span>
              <span className="text-[10px] text-slate-500 block">0 Geofence Breaches</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
