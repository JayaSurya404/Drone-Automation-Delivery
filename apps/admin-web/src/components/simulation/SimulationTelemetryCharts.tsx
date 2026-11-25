import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

interface TelemetryPoint {
  time: string;
  altitude: number;
  speed: number;
  battery: number;
  temp: number;
}

interface SimulationTelemetryChartsProps {
  telemetryHistory: TelemetryPoint[];
  currentAltitude: number;
  currentSpeed: number;
  currentBattery: number;
  currentTemp: number;
}

export const SimulationTelemetryCharts: React.FC<SimulationTelemetryChartsProps> = ({
  telemetryHistory,
  currentAltitude,
  currentSpeed,
  currentBattery,
  currentTemp,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Altitude & Speed Profile Chart */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Altitude & Velocity Flight Profile
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Dynamic 4D trajectory compliance telemetry
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1 font-bold text-cyan-600 dark:text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-500" /> Alt: {currentAltitude}m
              </span>
              <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Spd: {currentSpeed}km/h
              </span>
            </div>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="spdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={9} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc',
                  }}
                />
                <Area type="monotone" dataKey="altitude" stroke="#06b6d4" strokeWidth={2} fill="url(#altGrad)" name="Altitude (m)" />
                <Area type="monotone" dataKey="speed" stroke="#3b82f6" strokeWidth={2} fill="url(#spdGrad)" name="Speed (km/h)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Battery State of Charge & Thermal Curve */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Battery Discharge Curve & ESC Thermal
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Gradual non-linear discharge based on payload & wind
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> SoC: {currentBattery}%
              </span>
              <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> ESC: {currentTemp}°C
              </span>
            </div>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetryHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={9} tickLine={false} domain={[50, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#f8fafc',
                  }}
                />
                <Line type="monotone" dataKey="battery" stroke="#10b981" strokeWidth={2.5} dot={false} name="Battery (%)" />
                <Line type="monotone" dataKey="temp" stroke="#f59e0b" strokeWidth={2} dot={false} name="ESC Temp (°C)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
