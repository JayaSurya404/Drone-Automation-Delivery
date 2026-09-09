import React, { useState } from 'react';
import { History, Clock, Activity, ShieldCheck, Download, Search, AlertOctagon, CheckCircle2, ChevronRight } from 'lucide-react';

export interface BlackBoxEvent {
  id: string;
  timeIST: string;
  category: 'TELEMETRY' | 'DECISION' | 'ENVIRONMENT' | 'OBSTACLE' | 'DELIVERY' | 'SAFETY';
  severity: 'nominal' | 'warning' | 'critical';
  title: string;
  telemetrySnapshot: {
    altitudeM: number;
    speedKmH: number;
    batteryPct: number;
    headingDeg: number;
    escTempC: number;
  };
  details: string;
  rawPayloadHex?: string;
}

export const MOCK_BLACK_BOX_LOGS: BlackBoxEvent[] = [
  {
    id: 'BB-001',
    timeIST: '12:03:10.024',
    category: 'SAFETY',
    severity: 'nominal',
    title: 'Mission Initialized & Airspace Clear Locked',
    telemetrySnapshot: { altitudeM: 0, speedKmH: 0, batteryPct: 95, headingDeg: 0, escTempC: 28 },
    details: 'Preflight checksum: 0x8F92A1 verified across all 24 safety sensors. RTK Carrier-Phase locked.',
  },
  {
    id: 'BB-002',
    timeIST: '12:03:38.110',
    category: 'TELEMETRY',
    severity: 'nominal',
    title: 'Takeoff Lift-off Verified at +3.2 m/s',
    telemetrySnapshot: { altitudeM: 20, speedKmH: 14, batteryPct: 92, headingDeg: 0, escTempC: 32 },
    details: 'Vertical motor current: 42.1A total. Vibration FFT: 0.04g. Departure corridor clear.',
  },
  {
    id: 'BB-003',
    timeIST: '12:04:50.412',
    category: 'ENVIRONMENT',
    severity: 'warning',
    title: 'Crosswind Gust 18 km/h NE Detected',
    telemetrySnapshot: { altitudeM: 81, speedKmH: 46, batteryPct: 85, headingDeg: 356, escTempC: 36 },
    details: 'Barometric and inertial drift compensated via 3.2° crab angle vector. Battery prediction updated.',
  },
  {
    id: 'BB-004',
    timeIST: '12:05:15.820',
    category: 'OBSTACLE',
    severity: 'critical',
    title: 'Forward LiDAR Obstacle Encroachment Alert (180m)',
    telemetrySnapshot: { altitudeM: 80, speedKmH: 22, batteryPct: 83, headingDeg: 355, escTempC: 37 },
    details: 'LiDAR returns identify construction crane structure at 180m. Collision risk: 78%. Deceleration initiated.',
  },
  {
    id: 'BB-005',
    timeIST: '12:05:18.240',
    category: 'DECISION',
    severity: 'nominal',
    title: 'Autonomous Reroute Vector Generated & Executed',
    telemetrySnapshot: { altitudeM: 80, speedKmH: 28, batteryPct: 82, headingDeg: 10, escTempC: 37 },
    details: 'Simulated AI Insight generates West bypass (+120m offset). Decision latency: 38ms.',
  },
  {
    id: 'BB-006',
    timeIST: '12:06:45.010',
    category: 'DELIVERY',
    severity: 'nominal',
    title: 'Optical Precision Landing Pad Locked',
    telemetrySnapshot: { altitudeM: 8.0, speedKmH: 4, batteryPct: 75, headingDeg: 0, escTempC: 35 },
    details: 'Downward camera acquires green QR fiducial. Horizontal error: 0.03m. Surface confirmed level.',
  },
  {
    id: 'BB-007',
    timeIST: '12:07:08.550',
    category: 'DELIVERY',
    severity: 'nominal',
    title: 'Package ORD-10482 Safely Handed Over',
    telemetrySnapshot: { altitudeM: 2.0, speedKmH: 0, batteryPct: 74, headingDeg: 0, escTempC: 34 },
    details: 'Winch released medical package at 2.0m height. Zero drop shock. Customer receipt confirmed.',
  },
  {
    id: 'BB-008',
    timeIST: '12:08:15.900',
    category: 'SAFETY',
    severity: 'nominal',
    title: 'Base Touchdown on Hub Pad 1 & Fast-Charge Engaged',
    telemetrySnapshot: { altitudeM: 0, speedKmH: 0, batteryPct: 66, headingDeg: 0, escTempC: 30 },
    details: 'Touchdown nominal. 85 kW magnetic dock active. Final score compiled: 96/100.',
  },
];

interface MissionBlackBoxProps {
  logs?: BlackBoxEvent[];
  className?: string;
}

export const MissionBlackBox: React.FC<MissionBlackBoxProps> = ({
  logs = MOCK_BLACK_BOX_LOGS,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedEvent, setSelectedEvent] = useState<BlackBoxEvent>(logs[3]);

  const filteredLogs = logs.filter((log) => {
    const matchesCat = selectedCategory === 'ALL' || log.category === selectedCategory;
    const matchesSearch =
      log.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.timeIST.includes(searchTerm);
    return matchesCat && matchesSearch;
  });

  return (
    <div className={`rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-xs font-mono space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-100 uppercase tracking-wide">
              MISSION BLACK BOX & AUTOPSY RECORDER
            </h3>
            <p className="text-[10px] text-slate-400">
              Deterministic millisecond-level telemetry snapshots & autonomous decision logs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search event logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        {['ALL', 'DECISION', 'OBSTACLE', 'ENVIRONMENT', 'DELIVERY', 'SAFETY', 'TELEMETRY'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
              selectedCategory === cat ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Split: Event Timeline Table + Telemetry Snapshot Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Event List */}
        <div className="lg:col-span-2 space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
          {filteredLogs.map((log) => {
            const isSelected = selectedEvent?.id === log.id;
            return (
              <div
                key={log.id}
                onClick={() => setSelectedEvent(log)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/70 text-slate-100 shadow-md'
                    : 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-400 text-[10px]">{log.timeIST}</span>
                    <span className={`px-2 py-0.2 rounded-md text-[9px] font-bold uppercase ${log.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' : log.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {log.category}
                    </span>
                  </div>
                  <p className="font-bold text-slate-200 text-xs">{log.title}</p>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{log.details}</p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'translate-x-1 text-cyan-400' : 'text-slate-600'}`} />
              </div>
            );
          })}
        </div>

        {/* Right 1 Col: Snapshot Telemetry Card */}
        {selectedEvent && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-cyan-400 font-bold">{selectedEvent.id}</span>
                <span className="text-[10px] text-slate-400">{selectedEvent.timeIST}</span>
              </div>
              <h4 className="font-bold text-slate-100 text-xs">{selectedEvent.title}</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{selectedEvent.details}</p>

              {/* Telemetry Snapshot Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2 text-[10px]">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block">ALTITUDE</span>
                  <span className="font-bold text-emerald-400 text-xs">{selectedEvent.telemetrySnapshot.altitudeM} m AGL</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block">AIRSPEED</span>
                  <span className="font-bold text-cyan-400 text-xs">{selectedEvent.telemetrySnapshot.speedKmH} km/h</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block">BATTERY (SoC)</span>
                  <span className="font-bold text-emerald-400 text-xs">{selectedEvent.telemetrySnapshot.batteryPct}%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block">ESC TEMP</span>
                  <span className="font-bold text-amber-400 text-xs">{selectedEvent.telemetrySnapshot.escTempC}°C</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500">
              Cryptographic Hash: <span className="font-bold text-slate-400">SHA256: 8a9f...4c1d</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
