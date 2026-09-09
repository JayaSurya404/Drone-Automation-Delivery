import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PlusCircle, Sliders, MapPin, Wind, Battery, Bot, Sparkles, CheckCircle2 } from 'lucide-react';

interface CustomScenarioBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateScenario: (config: any) => void;
}

export const CustomScenarioBuilderModal: React.FC<CustomScenarioBuilderModalProps> = ({
  isOpen,
  onClose,
  onGenerateScenario,
}) => {
  const [formData, setFormData] = useState({
    name: 'Custom Autonomous Corridor Run',
    startHub: 'Coimbatore Hub Pad 1',
    destination: 'RS Puram Healthcare Center',
    droneCount: 5,
    payloadKg: 3.5,
    batterySoC: 92,
    weather: 'Clear',
    windKmh: 12,
    visibility: 'High (10km)',
    gpsFix: 'RTK Fixed (1.2cm)',
    network: '5G Mesh (-62dBm)',
    altitudeM: 80,
    speedKmh: 48,
    minBatteryThreshold: 20,
    noFlyBufferM: 150,
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateScenario(formData);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Custom 3D Autonomous Scenario Generator"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
        <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 flex items-center gap-2 font-mono">
          <Sparkles className="w-4 h-4 text-cyan-500 shrink-0" />
          <span>Configure multi-variable atmospheric and trajectory constraints to generate an instant 3D scenario.</span>
        </div>

        {/* 2-Column Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Scenario Name */}
          <div className="space-y-1">
            <label className="font-bold block text-slate-900 dark:text-slate-100">Scenario Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            />
          </div>

          {/* Destination */}
          <div className="space-y-1">
            <label className="font-bold block text-slate-900 dark:text-slate-100">Destination Pad:</label>
            <input
              type="text"
              value={formData.destination}
              onChange={(e) => setFormData((f) => ({ ...f, destination: e.target.value }))}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            />
          </div>

          {/* Drone Count */}
          <div className="space-y-1">
            <label className="font-bold block text-slate-900 dark:text-slate-100">Simulated Drones (1 - 50):</label>
            <input
              type="number"
              min={1}
              max={50}
              value={formData.droneCount}
              onChange={(e) => setFormData((f) => ({ ...f, droneCount: parseInt(e.target.value) || 1 }))}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono"
            />
          </div>

          {/* Payload Weight */}
          <div className="space-y-1">
            <label className="font-bold block text-slate-900 dark:text-slate-100">Payload Weight (kg):</label>
            <input
              type="number"
              step="0.1"
              min={0.5}
              max={6.0}
              value={formData.payloadKg}
              onChange={(e) => setFormData((f) => ({ ...f, payloadKg: parseFloat(e.target.value) || 1.0 }))}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono"
            />
          </div>

          {/* Weather */}
          <div className="space-y-1">
            <label className="font-bold block text-slate-900 dark:text-slate-100">Weather Condition:</label>
            <select
              value={formData.weather}
              onChange={(e) => setFormData((f) => ({ ...f, weather: e.target.value }))}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            >
              <option value="Clear">Clear Skies</option>
              <option value="Cloudy">Overcast / Cloud Deck</option>
              <option value="Rain">Monsoon Rain Downburst</option>
              <option value="Storm">Thunderstorm & Lightning</option>
              <option value="Windy">High Wind Shear (45 km/h)</option>
            </select>
          </div>

          {/* Wind Speed */}
          <div className="space-y-1">
            <label className="font-bold block text-slate-900 dark:text-slate-100">Crosswind Velocity (km/h):</label>
            <input
              type="number"
              min={0}
              max={60}
              value={formData.windKmh}
              onChange={(e) => setFormData((f) => ({ ...f, windKmh: parseInt(e.target.value) || 0 }))}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono"
            />
          </div>

          {/* Corridor Altitude */}
          <div className="space-y-1">
            <label className="font-bold block text-slate-900 dark:text-slate-100">Corridor Altitude (m AGL):</label>
            <select
              value={formData.altitudeM}
              onChange={(e) => setFormData((f) => ({ ...f, altitudeM: parseInt(e.target.value) }))}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono"
            >
              <option value={80}>80 meters (Standard Transit)</option>
              <option value={100}>100 meters (Express Corridors)</option>
              <option value={120}>120 meters (High-Speed Priority)</option>
            </select>
          </div>

          {/* Target Speed */}
          <div className="space-y-1">
            <label className="font-bold block text-slate-900 dark:text-slate-100">Target Airspeed (km/h):</label>
            <input
              type="number"
              min={20}
              max={80}
              value={formData.speedKmh}
              onChange={(e) => setFormData((f) => ({ ...f, speedKmh: parseInt(e.target.value) || 45 }))}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
          >
            <Sparkles className="w-4 h-4" /> Generate 3D Scenario
          </button>
        </div>
      </form>
    </Modal>
  );
};
