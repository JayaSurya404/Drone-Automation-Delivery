import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Sliders, Wind, Battery, Bot, Zap, TrendingUp, AlertTriangle, CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';

interface WhatIfAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatIfAnalysisModal: React.FC<WhatIfAnalysisModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Configurable Parameters
  const [params, setParams] = useState({
    windSpeedKmH: 14,
    batteryReservePct: 90,
    droneCount: 15,
    payloadWeightKg: 2.8,
    cruiseSpeedKmH: 48,
    gpsQuality: 98,
    weatherCondition: 'Clear' as 'Clear' | 'Rain' | 'Windy' | 'Storm',
  });

  if (!isOpen) return null;

  // Compute Current Baseline vs What-If Scenario Matrix
  const baseline = {
    etaMin: 14.2,
    batteryDrainPct: 24,
    riskScorePct: 4.2,
    fleetUtilizationPct: 78,
    successProbPct: 99.1,
    routeDistKm: 7.0,
  };

  // Dynamic calculation based on user adjustments
  const windFactor = params.windSpeedKmH / 14;
  const payloadFactor = params.payloadWeightKg / 2.8;
  const speedFactor = params.cruiseSpeedKmH / 48;
  const weatherPenalty = params.weatherCondition === 'Storm' ? 1.4 : params.weatherCondition === 'Rain' ? 1.2 : 1.0;

  const whatIf = {
    etaMin: +(baseline.etaMin / speedFactor * (1 + (windFactor - 1) * 0.15) * weatherPenalty).toFixed(1),
    batteryDrainPct: +(baseline.batteryDrainPct * payloadFactor * (1 + (windFactor - 1) * 0.25) * weatherPenalty).toFixed(1),
    riskScorePct: +(baseline.riskScorePct * windFactor * weatherPenalty * (100 / params.gpsQuality)).toFixed(1),
    fleetUtilizationPct: Math.min(100, +(baseline.fleetUtilizationPct * (params.droneCount / 15)).toFixed(1)),
    successProbPct: Math.max(50, +(100 - (baseline.riskScorePct * windFactor * weatherPenalty)).toFixed(1)),
    routeDistKm: +(baseline.routeDistKm * (params.weatherCondition === 'Storm' ? 1.15 : 1.0)).toFixed(1),
  };

  const resetDefaults = () => {
    setParams({
      windSpeedKmH: 14,
      batteryReservePct: 90,
      droneCount: 15,
      payloadWeightKg: 2.8,
      cruiseSpeedKmH: 48,
      gpsQuality: 98,
      weatherCondition: 'Clear',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="What-If Scenario Simulation & Predictive Impact Matrix"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5 text-xs text-slate-700 dark:text-slate-200">
        {/* Banner */}
        <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-500 shrink-0" />
            <span>
              Adjust environmental, payload, and fleet variables to predict operational risk & corridor performance deltas.
            </span>
          </div>
          <button
            onClick={resetDefaults}
            className="flex items-center gap-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          {/* Wind Speed */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono font-bold">
              <span>Wind Speed:</span>
              <span className="text-cyan-500">{params.windSpeedKmH} km/h</span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              value={params.windSpeedKmH}
              onChange={(e) => setParams((p) => ({ ...p, windSpeedKmH: parseInt(e.target.value) }))}
              className="w-full accent-cyan-500"
            />
          </div>

          {/* Payload Weight */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono font-bold">
              <span>Payload Load:</span>
              <span className="text-cyan-500">{params.payloadWeightKg} kg</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={6.0}
              step={0.1}
              value={params.payloadWeightKg}
              onChange={(e) => setParams((p) => ({ ...p, payloadWeightKg: parseFloat(e.target.value) }))}
              className="w-full accent-cyan-500"
            />
          </div>

          {/* Cruise Speed */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono font-bold">
              <span>Airspeed Target:</span>
              <span className="text-cyan-500">{params.cruiseSpeedKmH} km/h</span>
            </div>
            <input
              type="range"
              min={20}
              max={80}
              value={params.cruiseSpeedKmH}
              onChange={(e) => setParams((p) => ({ ...p, cruiseSpeedKmH: parseInt(e.target.value) }))}
              className="w-full accent-cyan-500"
            />
          </div>

          {/* Drones in Airspace */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono font-bold">
              <span>Simulated Drones:</span>
              <span className="text-cyan-500">{params.droneCount} Units</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={params.droneCount}
              onChange={(e) => setParams((p) => ({ ...p, droneCount: parseInt(e.target.value) }))}
              className="w-full accent-cyan-500"
            />
          </div>

          {/* GPS Satellite Quality */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono font-bold">
              <span>RTK GPS Quality:</span>
              <span className="text-cyan-500">{params.gpsQuality}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              value={params.gpsQuality}
              onChange={(e) => setParams((p) => ({ ...p, gpsQuality: parseInt(e.target.value) }))}
              className="w-full accent-cyan-500"
            />
          </div>

          {/* Weather Condition */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono font-bold">
              <span>Weather State:</span>
              <span className="text-cyan-500">{params.weatherCondition}</span>
            </div>
            <select
              value={params.weatherCondition}
              onChange={(e) => setParams((p) => ({ ...p, weatherCondition: e.target.value as any }))}
              className="w-full p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
            >
              <option value="Clear">Clear Skies (VFR)</option>
              <option value="Windy">High Wind Gusts</option>
              <option value="Rain">Precipitation / Rain</option>
              <option value="Storm">Thunderstorm Warning</option>
            </select>
          </div>
        </div>

        {/* Comparison Matrix: Current Baseline vs What-If */}
        <div className="space-y-2">
          <h4 className="font-black text-xs uppercase tracking-wider font-mono text-slate-900 dark:text-slate-100">
            PREDICTIVE IMPACT COMPARISON MATRIX
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-xs">
            {/* 1. ETA */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block font-bold">AVG FLIGHT ETA</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 line-through text-[11px]">{baseline.etaMin}m</span>
                <ArrowRight className="w-3 h-3 text-cyan-500" />
                <span className="font-black text-sm text-cyan-600 dark:text-cyan-400">{whatIf.etaMin}m</span>
              </div>
              <span className={`text-[9px] font-bold block ${whatIf.etaMin > baseline.etaMin ? 'text-amber-500' : 'text-emerald-500'}`}>
                {whatIf.etaMin > baseline.etaMin ? `+${(whatIf.etaMin - baseline.etaMin).toFixed(1)}m Delay` : 'Faster'}
              </span>
            </div>

            {/* 2. Battery Drain */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block font-bold">BATTERY DRAIN</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 line-through text-[11px]">{baseline.batteryDrainPct}%</span>
                <ArrowRight className="w-3 h-3 text-cyan-500" />
                <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">{whatIf.batteryDrainPct}%</span>
              </div>
              <span className={`text-[9px] font-bold block ${whatIf.batteryDrainPct > baseline.batteryDrainPct ? 'text-rose-500' : 'text-emerald-500'}`}>
                {whatIf.batteryDrainPct > baseline.batteryDrainPct ? `+${(whatIf.batteryDrainPct - baseline.batteryDrainPct).toFixed(1)}% Drain` : 'Efficient'}
              </span>
            </div>

            {/* 3. Risk Score */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block font-bold">AIRSPACE RISK</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 line-through text-[11px]">{baseline.riskScorePct}%</span>
                <ArrowRight className="w-3 h-3 text-cyan-500" />
                <span className="font-black text-sm text-rose-500">{whatIf.riskScorePct}%</span>
              </div>
              <span className={`text-[9px] font-bold block ${whatIf.riskScorePct > 10 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {whatIf.riskScorePct > 10 ? 'Elevated Hazard' : 'Acceptable'}
              </span>
            </div>

            {/* 4. Fleet Utilization */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block font-bold">FLEET CAPACITY</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 line-through text-[11px]">{baseline.fleetUtilizationPct}%</span>
                <ArrowRight className="w-3 h-3 text-cyan-500" />
                <span className="font-black text-sm text-blue-500">{whatIf.fleetUtilizationPct}%</span>
              </div>
              <span className="text-[9px] font-bold text-slate-400 block">Hub Load Factor</span>
            </div>

            {/* 5. Success Probability */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block font-bold">SUCCESS SLA</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 line-through text-[11px]">{baseline.successProbPct}%</span>
                <ArrowRight className="w-3 h-3 text-cyan-500" />
                <span className="font-black text-sm text-emerald-500">{whatIf.successProbPct}%</span>
              </div>
              <span className="text-[9px] font-bold text-emerald-500 block">Predicted Delivery SLA</span>
            </div>

            {/* 6. Route Distance */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block font-bold">FLIGHT DISTANCE</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 line-through text-[11px]">{baseline.routeDistKm}km</span>
                <ArrowRight className="w-3 h-3 text-cyan-500" />
                <span className="font-black text-sm text-slate-900 dark:text-slate-100">{whatIf.routeDistKm}km</span>
              </div>
              <span className="text-[9px] font-bold text-slate-400 block">Corridor Length</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-mono text-slate-400">Deterministic Mathematical Physics Model Active</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs"
          >
            Apply Scenario to Simulator
          </button>
        </div>
      </div>
    </Modal>
  );
};
