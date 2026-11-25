import React from 'react';
import { Drone } from '../../types/skynav';
import { StatusBadge } from '../common/StatusBadge';
import { X, Battery, Wifi, Gauge, Compass, Thermometer, ShieldAlert, ArrowUpRight } from 'lucide-react';

interface TelemetryFloatingCardProps {
  drone: Drone;
  onClose: () => void;
  onEmergencyAction: (droneId: string, cmd: 'RTH' | 'LAND' | 'PAUSE' | 'CANCEL') => void;
}

export const TelemetryFloatingCard: React.FC<TelemetryFloatingCardProps> = ({
  drone,
  onClose,
  onEmergencyAction,
}) => {
  return (
    <div className="absolute right-4 top-4 z-20 w-80 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl text-slate-100 space-y-4 animate-slide-left">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-100">{drone.id}</h3>
            <StatusBadge status={drone.status} size="sm" />
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{drone.name} • {drone.model}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Telemetry Metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1"><Battery className="h-3.5 w-3.5 text-cyan-400" /> Battery</span>
            <span className="font-bold text-slate-200">{drone.battery}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all ${
                drone.battery > 50 ? 'bg-emerald-400' : drone.battery > 20 ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'
              }`}
              style={{ width: `${drone.battery}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1"><Wifi className="h-3.5 w-3.5 text-cyan-400" /> Signal</span>
            <span className="font-bold text-slate-200">{drone.signalStrength}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-cyan-400" style={{ width: `${drone.signalStrength}%` }} />
          </div>
        </div>
      </div>

      {/* Flight Dynamics Data */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2 text-xs">
        <h4 className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Flight Dynamics</h4>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-900 p-2 border border-slate-800">
            <p className="text-[10px] text-slate-400">Speed</p>
            <p className="font-bold text-cyan-300">{drone.location.speed || 0} km/h</p>
          </div>
          <div className="rounded-lg bg-slate-900 p-2 border border-slate-800">
            <p className="text-[10px] text-slate-400">Altitude</p>
            <p className="font-bold text-cyan-300">{drone.location.altitude || 0} m</p>
          </div>
          <div className="rounded-lg bg-slate-900 p-2 border border-slate-800">
            <p className="text-[10px] text-slate-400">Heading</p>
            <p className="font-bold text-cyan-300">{drone.location.heading || 0}°</p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-300">
          {/* Active Package Payload Product Preview */}
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 my-1">
            <img
              src="https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=150&q=80"
              alt="Medical Emergency Kit"
              className="w-10 h-10 rounded-md object-cover border border-cyan-500/30"
            />
            <div className="flex-1 truncate">
              <p className="text-[10px] text-cyan-400 font-mono uppercase font-bold">PACKAGE PAYLOAD</p>
              <p className="font-bold text-slate-100 truncate">Medical Emergency Kit #MED-409</p>
              <p className="text-[10px] text-slate-400 truncate">Customer: Rahul Verma (Bengaluru)</p>
            </div>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">GPS Coords:</span>
            <span className="font-mono">{drone.location.lat.toFixed(4)}, {drone.location.lng.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Distance Travelled:</span>
            <span>{drone.distanceTravelledKm} km</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Current Mission:</span>
            <span className="font-semibold text-cyan-300">{drone.currentMissionId || 'None'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Payload Weight:</span>
            <span>{drone.currentPayloadWeight} / {drone.payloadCapacity} kg</span>
          </div>
        </div>
      </div>

      {/* Operational Commands */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <h4 className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Emergency Actions</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onEmergencyAction(drone.id, 'RTH')}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 py-1.5 px-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
          >
            Return To Home
          </button>
          <button
            onClick={() => onEmergencyAction(drone.id, 'LAND')}
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 py-1.5 px-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
          >
            Forced Landing
          </button>
        </div>
      </div>
    </div>
  );
};
