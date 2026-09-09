import React, { useState, useEffect } from 'react';
import { Drone } from '../../types/skynav';
import { mockStore } from '../../services/mockDataStore';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Drawer } from '../../components/common/Drawer';
import { Modal } from '../../components/common/Modal';
import { DroneVisual, DRONE_MODEL_ASSETS } from '../../components/drone/DroneVisual';
import {
  Bot,
  Battery,
  LayoutGrid,
  List,
  Plus,
  Wrench,
  Shield,
  Activity,
  History,
  Radio,
  Gauge,
  Wind,
  Compass,
  Zap,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Layers,
  FileText,
  AlertTriangle,
} from 'lucide-react';

export const FleetPage: React.FC = () => {
  const [drones, setDrones] = useState(mockStore.getDrones());
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterModel, setFilterModel] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'performance' | 'missions' | 'maintenance' | 'incidents'>('overview');

  // New Drone Form state
  const [newDroneName, setNewDroneName] = useState('');
  const [newDroneModel, setNewDroneModel] = useState('SKYNAV X1');
  const [newDroneCapacity, setNewDroneCapacity] = useState('5.0');

  useEffect(() => {
    return mockStore.subscribe(() => {
      setDrones([...mockStore.getDrones()]);
    });
  }, []);

  const filteredDrones = drones.filter((d) => {
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
    const matchesModel = filterModel === 'all' || d.model === filterModel;
    return matchesStatus && matchesModel;
  });

  const handleAddDroneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mockStore.addDrone({
      name: newDroneName || `SkyNav Fleet Unit ${drones.length + 1}`,
      model: newDroneModel,
      payloadCapacity: parseFloat(newDroneCapacity) || 5.0,
    });
    setIsAddModalOpen(false);
    setNewDroneName('');
  };

  const inFlightCount = drones.filter((d) => d.status === 'in_flight').length;
  const availableCount = drones.filter((d) => d.status === 'available').length;
  const chargingCount = drones.filter((d) => d.status === 'charging').length;
  const maintenanceCount = drones.filter((d) => d.status === 'maintenance').length;
  const offlineCount = drones.filter((d) => d.status === 'offline' || d.status === 'emergency').length;

  const columns: Column<Drone>[] = [
    {
      header: 'Drone ID',
      accessor: (row) => (
        <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono hover:underline cursor-pointer">
          {row.id}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Model & Name',
      accessor: (row) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{row.model}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{row.serialNumber}</p>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Battery',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 font-bold">
          <Battery className={`h-4 w-4 ${row.battery > 50 ? 'text-emerald-500' : row.battery > 20 ? 'text-amber-500' : 'text-rose-500 animate-pulse'}`} />
          <span>{row.battery}%</span>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Health Grade',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{row.batteryHealth}%</span>
          <span className="text-[10px] text-slate-400">ESC</span>
        </div>
      ),
      sortable: true,
    },
    { header: 'Payload Limit', accessor: (row) => `${row.payloadCapacity} kg`, sortable: true },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} size="sm" />,
      sortable: true,
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedDrone(row);
          }}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shadow-sm"
        >
          View Equipment
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
            <Bot className="w-3.5 h-3.5" /> FLEET OPERATIONS
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Commercial Drone Fleet Command
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Autonomous fleet inventory, realistic 3D telemetry, maintenance health, and hardware registration
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Grid vs Table View Switcher */}
          <div className="flex items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-xl p-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Grid Equipment View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`rounded-xl p-2 transition-colors ${
                viewMode === 'table'
                  ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Table Inventory View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500 transition-all"
          >
            <Plus className="h-4 w-4" /> Register New Drone
          </button>
        </div>
      </div>

      {/* 2. Fleet Summary Banner (Section 22): 40 Total Drones + Distribution Chart */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              FLEET OPERATIONAL SUMMARY ({drones.length} TOTAL DRONES)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              DGCA Certified Autonomous Delivery Fleet • Active in Coimbatore Hub
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            97.5% Fleet Readiness Index
          </span>
        </div>

        {/* Visual Fleet-Distribution Bar */}
        <div className="space-y-2">
          <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 shadow-inner">
            <div style={{ width: `${(inFlightCount / drones.length) * 100}%` }} className="bg-cyan-500 transition-all duration-500" title={`${inFlightCount} In Flight`} />
            <div style={{ width: `${(availableCount / drones.length) * 100}%` }} className="bg-emerald-500 transition-all duration-500" title={`${availableCount} Available`} />
            <div style={{ width: `${(chargingCount / drones.length) * 100}%` }} className="bg-amber-500 transition-all duration-500" title={`${chargingCount} Charging`} />
            <div style={{ width: `${(maintenanceCount / drones.length) * 100}%` }} className="bg-slate-400 transition-all duration-500" title={`${maintenanceCount} Maintenance`} />
            <div style={{ width: `${(offlineCount / drones.length) * 100}%` }} className="bg-rose-500 transition-all duration-500" title={`${offlineCount} Offline / Alert`} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-xs">
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-500 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100">{inFlightCount} In Flight</span>
                <span className="text-[10px] text-slate-400 block">Airborne missions</span>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100">{availableCount} Available</span>
                <span className="text-[10px] text-slate-400 block">Hub ready</span>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100">{chargingCount} Charging</span>
                <span className="text-[10px] text-slate-400 block">Fast-charge bays</span>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100">{maintenanceCount} Service</span>
                <span className="text-[10px] text-slate-400 block">Scheduled check</span>
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100">{offlineCount} Offline / EMG</span>
                <span className="text-[10px] text-slate-400 block">Critical safety</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Status Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {['all', 'in_flight', 'available', 'charging', 'maintenance', 'emergency', 'offline'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`rounded-2xl px-3 py-1.5 font-bold capitalize whitespace-nowrap transition-all ${
                filterStatus === st
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Model Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold text-[11px]">Model:</span>
          <select
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500 shadow-sm"
          >
            <option value="all">All Models (5 Models)</option>
            {Object.keys(DRONE_MODEL_ASSETS).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Equipment Grid vs Table View (Section 21) */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredDrones.map((drone) => (
            <div
              key={drone.id}
              onClick={() => setSelectedDrone(drone)}
              className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl hover:border-cyan-500/50 hover:shadow-cyan-500/10 transition-all cursor-pointer space-y-3.5 group"
            >
              {/* Card Header: Drone ID + Status */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono font-black text-sm text-slate-900 dark:text-slate-100 group-hover:text-cyan-500 transition-colors">
                    {drone.id}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">{drone.model}</p>
                </div>
                <StatusBadge status={drone.status} size="sm" />
              </div>

              {/* Realistic Commercial Drone Image Render */}
              <div className="w-full">
                <DroneVisual
                  model={drone.model}
                  id={drone.id}
                  size="sm"
                  interactive={true}
                />
              </div>

              {/* Specs & Telemetry Grid */}
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-mono">BATTERY:</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 font-mono">
                    <Battery className="h-3.5 w-3.5" /> {drone.battery}%
                  </span>
                </div>

                {/* Battery Bar */}
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${
                      drone.battery > 50
                        ? 'bg-emerald-500'
                        : drone.battery > 20
                        ? 'bg-amber-500'
                        : 'bg-rose-500 animate-pulse'
                    }`}
                    style={{ width: `${drone.battery}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span>Health: </span>
                    <b className="text-slate-800 dark:text-slate-200">{drone.batteryHealth}%</b>
                  </div>
                  <div>
                    <span>Payload: </span>
                    <b className="text-slate-800 dark:text-slate-200">{drone.payloadCapacity} kg</b>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 text-[10px] text-slate-400 font-mono">
                  <span>Mission: <b className="text-cyan-600 dark:text-cyan-400">{drone.currentMissionId || 'None'}</b></span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold group-hover:underline">View Equipment →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          title="Commercial Drone Inventory"
          columns={columns}
          data={filteredDrones}
          searchPlaceholder="Search Drone ID, Serial, Model..."
          searchField={(d) => `${d.id} ${d.name} ${d.serialNumber} ${d.model}`}
          onRowClick={(row) => setSelectedDrone(row)}
        />
      )}

      {/* 5. Comprehensive Drone Equipment Profile Drawer (Section 23) */}
      {selectedDrone && (
        <Drawer
          isOpen={!!selectedDrone}
          onClose={() => setSelectedDrone(null)}
          title={`Drone Profile — ${selectedDrone.id}`}
          subtitle={`${selectedDrone.model} • Registration: ${selectedDrone.registration}`}
        >
          <div className="space-y-6 text-xs text-slate-700 dark:text-slate-200">
            {/* Large Realistic Drone Visual */}
            <div className="w-full">
              <DroneVisual
                model={selectedDrone.model}
                id={selectedDrone.id}
                status={selectedDrone.status}
                battery={selectedDrone.battery}
                health={selectedDrone.batteryHealth}
                payload={selectedDrone.payloadCapacity}
                size="lg"
                showSpecs={true}
                interactive={true}
              />
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto custom-scrollbar">
              {[
                { id: 'overview', label: 'Overview', icon: Layers },
                { id: 'telemetry', label: 'Live Telemetry', icon: Gauge },
                { id: 'performance', label: 'Performance', icon: Activity },
                { id: 'missions', label: 'Mission History', icon: History },
                { id: 'maintenance', label: 'Maintenance', icon: Wrench },
                { id: 'incidents', label: 'Incidents', icon: AlertOctagon },
              ].map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono block">MODEL TYPE</span>
                    <span className="font-black text-slate-900 dark:text-slate-100">{selectedDrone.model}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono block">SERIAL NUMBER</span>
                    <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{selectedDrone.serialNumber}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono block">DGCA REGISTRATION</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{selectedDrone.registration}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono block">CURRENT MISSION</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedDrone.currentMissionId || 'Standby at Hub'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase text-[11px]">
                    Hardware Specifications
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Aviation-grade carbon composite frame equipped with dual redundant flight controllers, real-time RTK GPS positioning, forward optical LiDAR obstacle detection, and hot-swappable modular cargo bay.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Live Telemetry */}
            {activeTab === 'telemetry' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-mono block">ALTITUDE</span>
                    <span className="text-lg font-black text-cyan-600 dark:text-cyan-400">
                      {selectedDrone.location.altitude || 75} m
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-mono block">GROUND SPEED</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {selectedDrone.location.speed || 34} km/h
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 font-mono block">HEADING</span>
                    <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                      {selectedDrone.location.heading || 45}°
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono block">GPS COORDINATES</span>
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                      {selectedDrone.location.lat.toFixed(6)}° N, {selectedDrone.location.lng.toFixed(6)}° E
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono block">RADIO SIGNAL LINK</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedDrone.signalStrength}% (5G Mesh)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Performance */}
            {activeTab === 'performance' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono block">LIFETIME FLIGHT DISTANCE</span>
                    <span className="text-base font-black text-slate-900 dark:text-slate-100">
                      {selectedDrone.distanceTravelledKm} km
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono block">BATTERY CHARGE CYCLES</span>
                    <span className="text-base font-black text-slate-900 dark:text-slate-100">
                      {selectedDrone.batteryCycles} Cycles
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Mission History */}
            {activeTab === 'missions' && (
              <div className="space-y-2">
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-cyan-600 dark:text-cyan-400 font-mono">MS-10284</span>
                    <span className="text-emerald-500">Delivered</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Peelamedu Tech Park → RS Puram (8.4 km in 14.2 min)</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-cyan-600 dark:text-cyan-400 font-mono">MS-10260</span>
                    <span className="text-emerald-500">Delivered</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Gandhipuram Hub → Saravanampatti (6.1 km in 11.8 min)</p>
                </div>
              </div>
            )}

            {/* Tab 5: Maintenance */}
            {activeTab === 'maintenance' && (
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-900 dark:text-slate-100">Routine Motor & ESC Inspection</span>
                    <span className="text-emerald-500">Passed</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Last Service: {selectedDrone.lastServiceDate} • Technician: Suresh Kumar</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-900 dark:text-slate-100">Next Scheduled Maintenance</span>
                    <span className="text-cyan-500">{selectedDrone.nextServiceDate}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">LiDAR lens recalibration and rotor balance test.</p>
                </div>
              </div>
            )}

            {/* Tab 6: Incidents */}
            {activeTab === 'incidents' && (
              <div className="space-y-2">
                {selectedDrone.id === 'D-024' ? (
                  <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-1">
                    <div className="flex justify-between font-bold text-amber-700 dark:text-amber-300">
                      <span>⚠ Route Drift (320m)</span>
                      <span>Resolved</span>
                    </div>
                    <p className="text-[10px] text-amber-800 dark:text-amber-200">Temporary GPS wind shear drift corrected via autopilot.</p>
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-400 bg-slate-100 dark:bg-slate-900 rounded-2xl">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                    <p className="font-bold text-slate-800 dark:text-slate-200">Zero Incident Record</p>
                    <p className="text-[10px]">No safety breaches or hardware failures recorded.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* 6. Register New Drone Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register Autonomous Drone to Fleet"
      >
        <form onSubmit={handleAddDroneSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Drone Name / Call Sign</label>
            <input
              type="text"
              value={newDroneName}
              onChange={(e) => setNewDroneName(e.target.value)}
              placeholder={`SkyNav Fleet Unit ${drones.length + 1}`}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Commercial Drone Model</label>
            <select
              value={newDroneModel}
              onChange={(e) => setNewDroneModel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 text-slate-900 dark:text-slate-100 font-bold"
            >
              {Object.keys(DRONE_MODEL_ASSETS).map((m) => (
                <option key={m} value={m}>
                  {m} — {DRONE_MODEL_ASSETS[m].type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Payload Capacity (kg)</label>
            <input
              type="number"
              step="0.5"
              value={newDroneCapacity}
              onChange={(e) => setNewDroneCapacity(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 text-slate-900 dark:text-slate-100 font-bold"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20"
            >
              Confirm Registration
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
