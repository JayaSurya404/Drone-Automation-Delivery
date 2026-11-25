import React, { useState } from 'react';
import { Drone } from '../../types/skynav';
import { mockStore } from '../../services/mockDataStore';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/StatusBadge';
import { DroneExplodedView3D } from '../3d/DroneExplodedView3D';
import {
  Activity,
  Bot,
  Battery,
  Zap,
  Gauge,
  Compass,
  Radio,
  Wifi,
  Thermometer,
  ShieldCheck,
  Scale,
  RefreshCw,
  Cpu,
  Layers,
  ArrowUpRight,
  PlaneTakeoff,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface DigitalTwinModalProps {
  isOpen: boolean;
  onClose: () => void;
  droneId?: string;
}

export const DigitalTwinModal: React.FC<DigitalTwinModalProps> = ({
  isOpen,
  onClose,
  droneId = 'D-001',
}) => {
  const [selectedId, setSelectedId] = useState(droneId);
  const drones = mockStore.getDrones();
  const drone = drones.find((d) => d.id === selectedId) || drones[0];
  const [activeTab, setActiveTab] = useState<'exploded' | 'propulsion' | 'battery' | 'avionics' | 'payload'>('exploded');

  if (!isOpen || !drone) return null;

  // Real-time simulated motor telemetry
  const motors = [
    { id: 1, name: 'Motor 1 (Front Left)', rpm: 6240, temp: 42, vibration: '0.08g', voltage: 24.1, status: 'Nominal' },
    { id: 2, name: 'Motor 2 (Front Right)', rpm: 6210, temp: 41, vibration: '0.07g', voltage: 24.1, status: 'Nominal' },
    { id: 3, name: 'Motor 3 (Rear Left)', rpm: 6280, temp: 44, vibration: '0.09g', voltage: 24.0, status: 'Nominal' },
    { id: 4, name: 'Motor 4 (Rear Right)', rpm: 6250, temp: 43, vibration: '0.08g', voltage: 24.1, status: 'Nominal' },
  ];

  // Battery cell telemetry
  const cells = [
    { cell: 'Cell 1', voltage: 4.18, ir: '1.8 mΩ' },
    { cell: 'Cell 2', voltage: 4.17, ir: '1.9 mΩ' },
    { cell: 'Cell 3', voltage: 4.19, ir: '1.8 mΩ' },
    { cell: 'Cell 4', voltage: 4.18, ir: '1.8 mΩ' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Digital Twin Telemetry Diagnostic — ${drone.id} (${drone.name})`}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-5 text-xs text-slate-700 dark:text-slate-200">
        {/* Drone Selector & Top Live Telemetry Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-mono font-black text-sm">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-cyan-400">{drone.id}</span>
                <span className="font-bold text-slate-200">{drone.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px]">
                  ● DIGITAL TWIN SYNCED
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Model: {drone.model} • S/N: {drone.serialNumber} • Payload: {drone.payloadCapacity} kg
              </p>
            </div>
          </div>

          {/* Switch Drone Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-mono">Select Asset:</span>
            <select
              value={drone.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {drones.slice(0, 15).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} — {d.name} ({d.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 5 Core Engineering Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto custom-scrollbar">
          {[
            { id: 'exploded', label: '3D Exploded Deep Inspection', icon: Layers },
            { id: 'propulsion', label: 'Propulsion & ESC Motors', icon: Gauge },
            { id: 'battery', label: 'Battery Cell Telemetry', icon: Battery },
            { id: 'avionics', label: 'RTK Avionics & Sensors', icon: Radio },
            { id: 'payload', label: 'Payload & Cargo Winch', icon: Scale },
          ].map((t) => {
            const Icon = t.icon;
            const isCurrent = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl font-bold transition-all text-xs whitespace-nowrap ${
                  isCurrent
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 0: 3D Exploded Inspection */}
        {activeTab === 'exploded' && (
          <DroneExplodedView3D droneId={drone.id} droneModel={drone.model} />
        )}

        {/* Tab 1: Propulsion & Motors */}
        {activeTab === 'propulsion' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {motors.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      {m.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                      {m.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px]">SPEED</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{m.rpm} RPM</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">TEMP</span>
                      <span className="font-bold text-cyan-600 dark:text-cyan-400">{m.temp}°C</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">VIBE</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{m.vibration}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ESC VOLT</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{m.voltage}V</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Artificial Horizon / Gyroscope Attitude */}
            <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-950 text-white border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
                  <Compass className="w-4 h-4" /> Inertial Navigation Attitude & Orientation
                </h4>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  Pitch: -2.4° (Forward cruise) • Roll: +0.6° (Wing-level) • Yaw: 248° WSW Heading
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="p-2 rounded-xl bg-slate-800 border border-slate-700">Alt: {drone.location.altitude || 120}m AGL</span>
                <span className="p-2 rounded-xl bg-slate-800 border border-slate-700">Speed: {drone.location.speed || 42} km/h</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Battery Cell Diagnostics */}
        {activeTab === 'battery' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {cells.map((c) => (
                <div
                  key={c.cell}
                  className="p-3.5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center space-y-1"
                >
                  <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">{c.cell}</span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{c.voltage}V</p>
                  <span className="text-[10px] text-slate-400 font-mono block">IR: {c.ir}</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100">Overall Pack Capacity & Cycles</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {drone.battery}% ({drone.batteryHealth}% Health Score)
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    drone.battery < 20 ? 'bg-rose-500' : drone.battery < 40 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${drone.battery}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <div>Total Lifetime Cycles: <span className="font-bold text-slate-900 dark:text-slate-100">{drone.batteryCycles} / 1000</span></div>
                <div>Estimated Flight Range: <span className="font-bold text-cyan-600 dark:text-cyan-400">14.2 km</span></div>
                <div>Average Drain Rate: <span className="font-bold text-slate-900 dark:text-slate-100">4.8% / km</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Avionics & Sensors */}
        {activeTab === 'avionics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-500" /> RTK Dual GPS GNSS Positioning
              </h5>
              <div className="space-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <div className="flex justify-between"><span>Satellites Locked:</span><span className="font-bold text-emerald-600 dark:text-emerald-400">28 Satellites (Galileo + GPS)</span></div>
                <div className="flex justify-between"><span>RTK Fix State:</span><span className="font-bold text-emerald-600 dark:text-emerald-400">Carrier-Phase Fix (1.2 cm)</span></div>
                <div className="flex justify-between"><span>HDOP Precision:</span><span className="font-bold text-slate-900 dark:text-slate-100">0.58 (Excellent)</span></div>
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-500" /> 5G Telemetry & Command Link
              </h5>
              <div className="space-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <div className="flex justify-between"><span>Signal RSSI:</span><span className="font-bold text-emerald-600 dark:text-emerald-400">-62 dBm (Strong)</span></div>
                <div className="flex justify-between"><span>Airspace Latency:</span><span className="font-bold text-emerald-600 dark:text-emerald-400">14 ms (Ultra Low)</span></div>
                <div className="flex justify-between"><span>Failover RF 868MHz:</span><span className="font-bold text-slate-900 dark:text-slate-100">Standby (Armed)</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Payload & Winch */}
        {activeTab === 'payload' && (
          <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Scale className="w-4 h-4 text-cyan-500" /> Automated Cargo Delivery Tether & Locker
              </h5>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                LOCKED & SECURED
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl">
                <span className="text-slate-400 text-[10px] block">CURRENT LOAD</span>
                <span className="font-black text-sm text-slate-900 dark:text-slate-100">2.15 kg</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl">
                <span className="text-slate-400 text-[10px] block">PAYLOAD BAY TEMP</span>
                <span className="font-black text-sm text-cyan-600 dark:text-cyan-400">22.4°C</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl">
                <span className="text-slate-400 text-[10px] block">WINCH DROP HEIGHT</span>
                <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">2.5 m (Auto-Release)</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[10px] text-slate-400 font-mono">Telemetry Refreshes Every 1000ms</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black"
          >
            Close Digital Twin
          </button>
        </div>
      </div>
    </Modal>
  );
};
