import React, { useState } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { Package, Scale, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

export const PackagesPage: React.FC = () => {
  const orders = mockStore.getOrders();
  const drones = mockStore.getDrones();

  const [testWeight, setTestWeight] = useState<number>(6.5);
  const [selectedDroneId, setSelectedDroneId] = useState<string>(drones[0].id);

  const selectedDrone = drones.find((d) => d.id === selectedDroneId) || drones[0];
  const isCompatible = testWeight <= selectedDrone.payloadCapacity;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="h-5 w-5 text-cyan-400" /> Package Inventory & Payload Validation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Validate package payload weight vs drone maximum physical lift capacity before mission creation
          </p>
        </div>
      </div>

      {/* PAYLOAD VALIDATOR TOOL (Section 24) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md space-y-4">
        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Scale className="h-4 w-4 text-cyan-400" /> Package vs Drone Payload Compatibility Validator
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-200">
          <div className="space-y-3">
            <div>
              <label className="font-semibold text-slate-300">Package Payload Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={testWeight}
                onChange={(e) => setTestWeight(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300">Candidate Drone Unit</label>
              <select
                value={selectedDroneId}
                onChange={(e) => setSelectedDroneId(e.target.value)}
                className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-bold"
              >
                {drones.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} - {d.name} ({d.model} • Max Capacity: {d.payloadCapacity} kg)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Validation Result Box */}
          <div className="flex flex-col justify-center">
            {isCompatible ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-2 text-emerald-300">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" /> ✅ SAFE ASSIGNMENT APPROVED
                </div>
                <p className="text-xs">
                  Package weight ({testWeight} kg) is within Drone {selectedDrone.id} maximum payload capacity ({selectedDrone.payloadCapacity} kg).
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5 space-y-2 text-rose-300 animate-pulse">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <ShieldAlert className="h-5 w-5 text-rose-400" /> ⚠️ INCOMPATIBLE DRONE PAYLOAD OVERLOAD
                </div>
                <p className="text-xs">
                  Package weight ({testWeight} kg) EXCEEDS Drone {selectedDrone.id} maximum payload capacity ({selectedDrone.payloadCapacity} kg)! Assignment blocked for flight safety.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
