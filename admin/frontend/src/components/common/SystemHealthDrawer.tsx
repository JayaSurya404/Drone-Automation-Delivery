import React from 'react';
import { useSystemHealth } from '../../context/SystemHealthContext';
import { Drawer } from './Drawer';
import { Activity, CheckCircle2, ShieldAlert, Cpu, Server, Wifi } from 'lucide-react';

export const SystemHealthDrawer: React.FC = () => {
  const { overallStatus, services, isHealthDrawerOpen, closeHealthDrawer } = useSystemHealth();

  return (
    <Drawer
      isOpen={isHealthDrawerOpen}
      onClose={closeHealthDrawer}
      title="System Architecture Health Diagnostics"
      subtitle="Real-time operational status of all platform microservices & drone telemetry mesh"
    >
      <div className="space-y-6">
        {/* Overall Status Banner */}
        <div className={`rounded-xl border p-4 flex items-center justify-between ${
          overallStatus === 'OPERATIONAL'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : overallStatus === 'DEGRADED'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider">Overall Platform Health</h3>
              <p className="text-xs opacity-90">{overallStatus === 'OPERATIONAL' ? 'All subsystems operational. Nominal latencies across all nodes.' : 'Platform performance is experiencing degraded service levels.'}</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-extrabold tracking-wide uppercase border border-current">
            {overallStatus}
          </span>
        </div>

        {/* Subsystem Matrix */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Microservice Grid</h4>

          <div className="space-y-2">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-800 p-2 text-cyan-400">
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">{svc.name}</h5>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Wifi className="h-3 w-3 text-slate-500" /> {svc.latencyMs} ms
                      </span>
                      <span>•</span>
                      <span>Uptime: {svc.uptimePct}%</span>
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {svc.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry Hub Info */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2 text-xs text-slate-300">
          <h4 className="font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" /> Node Mesh Telemetry Protocol
          </h4>
          <p className="text-slate-400 leading-relaxed">
            Drones communicate using encrypted MAVLink over 5G/LTE mesh with failover satellite uplink. Heartbeat telemetry ticks every 3000ms.
          </p>
        </div>
      </div>
    </Drawer>
  );
};
