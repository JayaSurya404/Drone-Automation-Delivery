import React, { useState, useEffect } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { InteractiveOpsMap } from '../../components/maps/InteractiveOpsMap';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DroneVisual } from '../../components/drone/DroneVisual';
import { Drone } from '../../types/skynav';
import {
  Radio,
  Bot,
  Shield,
  AlertOctagon,
  Battery,
  Navigation,
  Filter,
  Activity,
  Compass,
  Gauge,
  Wind,
  Target,
} from 'lucide-react';

export const LiveOperations: React.FC = () => {
  const [drones, setDrones] = useState(mockStore.getDrones());
  const [orders, setOrders] = useState(mockStore.getOrders());
  const [missions, setMissions] = useState(mockStore.getMissions());
  const [geofences, setGeofences] = useState(mockStore.getGeofences());
  const [selectedDroneId, setSelectedDroneId] = useState<string | undefined>('D-024');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    return mockStore.subscribe(() => {
      setDrones([...mockStore.getDrones()]);
      setOrders([...mockStore.getOrders()]);
      setMissions([...mockStore.getMissions()]);
      setGeofences([...mockStore.getGeofences()]);
    });
  }, []);

  const filteredDrones = drones.filter((d) => {
    if (filterStatus === 'all') return true;
    return d.status === filterStatus;
  });

  const selectedDrone = drones.find((d) => d.id === selectedDroneId) || drones[0];

  return (
    <div className="space-y-6">
      {/* 1. Header & Live Telemetry Strip */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> AIRSPACE CONTROL
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Live Drone Operations Command
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time geospatial tracking, route corridors, telemetry diagnostics, and geofence overlays
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
          <span className="text-slate-400 font-bold text-[11px] mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filter:
          </span>
          {['all', 'in_flight', 'available', 'charging', 'emergency'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`rounded-2xl px-3 py-1.5 font-bold capitalize whitespace-nowrap transition-all ${
                filterStatus === st
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Top Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-cyan-500/10 text-cyan-500">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-mono block">ACTIVE MISSIONS</span>
            <span className="text-base font-black text-slate-900 dark:text-slate-100">
              {missions.filter((m) => m.currentStatus === 'in_flight').length} Airborne
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-500">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-mono block">AIRSPACE COMPLIANCE</span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">98.4% Nominal</span>
          </div>
        </div>

        <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-amber-500/10 text-amber-500">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-mono block">AVG AIR VELOCITY</span>
            <span className="text-base font-black text-slate-900 dark:text-slate-100">34.8 km/h</span>
          </div>
        </div>

        <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertOctagon className="w-5 h-5 animate-ping" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-mono block">SAFETY ALERTS</span>
            <span className="text-base font-black text-rose-600 dark:text-rose-400">1 Active</span>
          </div>
        </div>
      </div>

      {/* 3. Main Operations Grid: Map (3 Cols) + Airborne Fleet Panel (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Geospatial Interactive Map (3 Cols) */}
        <div className="lg:col-span-3">
          <InteractiveOpsMap
            drones={filteredDrones}
            geofences={geofences}
            orders={orders}
            missions={missions}
            selectedDroneId={selectedDroneId}
            onSelectDrone={(d) => setSelectedDroneId(d.id)}
            onEmergencyAction={(id, cmd) => mockStore.executeEmergencyCommand(id, cmd)}
            heightClass="h-[720px]"
          />
        </div>

        {/* Sidebar Airborne Fleet List (1 Col) */}
        <div className="space-y-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl flex flex-col h-[720px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-cyan-500" /> AIRBORNE FLEET ({filteredDrones.length})
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Click to Center</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {filteredDrones.map((drone) => (
              <div
                key={drone.id}
                onClick={() => setSelectedDroneId(drone.id)}
                className={`rounded-2xl border p-3 cursor-pointer transition-all ${
                  selectedDroneId === drone.id
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 shadow-md'
                    : 'border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100">{drone.id}</span>
                  <StatusBadge status={drone.status} size="sm" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  <span>{drone.model}</span>
                  <span className="flex items-center gap-1 font-bold text-cyan-600 dark:text-cyan-400">
                    <Battery className="h-3 w-3" /> {drone.battery}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 border-t border-slate-200 dark:border-slate-800/80 pt-1">
                  <span>Alt: {drone.location.altitude || 70}m</span>
                  <span>Spd: {drone.location.speed || 34}km/h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
