import React, { useState, useEffect } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { Battery, Zap, AlertTriangle, ShieldCheck, Thermometer } from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';

export const BatteryHealthPage: React.FC = () => {
  const [drones, setDrones] = useState(mockStore.getDrones());

  useEffect(() => {
    return mockStore.subscribe(() => {
      setDrones([...mockStore.getDrones()]);
    });
  }, []);

  const healthyDrones = drones.filter((d) => d.batteryHealth >= 90);
  const warningDrones = drones.filter((d) => d.batteryHealth >= 70 && d.batteryHealth < 90);
  const criticalDrones = drones.filter((d) => d.batteryHealth < 70 || d.battery <= 15);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Battery className="h-5 w-5 text-cyan-400" /> Battery & Fleet Health Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor lithium-polymer cell degradation, thermal limits, battery cycle counts, and charging grid status
          </p>
        </div>
      </div>

      {/* DASHBOARD VISUALIZATION (Section 19) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="font-bold text-xs uppercase tracking-wider">Healthy Cells (&gt;90%)</span>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{healthyDrones.length} Drones</p>
          <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
            <div className="h-full bg-emerald-400" style={{ width: `${(healthyDrones.length / drones.length) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center justify-between text-amber-300">
            <span className="font-bold text-xs uppercase tracking-wider">Warning Level (70%-89%)</span>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{warningDrones.length} Drones</p>
          <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
            <div className="h-full bg-amber-400" style={{ width: `${(warningDrones.length / drones.length) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
          <div className="flex items-center justify-between text-rose-300">
            <span className="font-bold text-xs uppercase tracking-wider">Critical Action Required</span>
            <Zap className="h-5 w-5" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{criticalDrones.length} Drones</p>
          <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
            <div className="h-full bg-rose-500" style={{ width: `${(criticalDrones.length / drones.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Grid of Battery Health Cards */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md space-y-4">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider border-b border-slate-800 pb-2">
          Fleet Battery Telemetry Matrix
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {drones.map((drone) => (
            <div
              key={drone.id}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100">{drone.id}</span>
                <StatusBadge status={drone.status} size="sm" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Charge:</span>
                  <span className="font-bold text-cyan-300">{drone.battery}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${
                      drone.battery > 50 ? 'bg-emerald-400' : drone.battery > 20 ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'
                    }`}
                    style={{ width: `${drone.battery}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <span>Health: {drone.batteryHealth}%</span>
                <span>Temp: {drone.temperature}°C</span>
                <span>Cycles: {drone.batteryCycles}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
