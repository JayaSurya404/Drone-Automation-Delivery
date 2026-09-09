import React, { useState } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { Route as RouteIcon, AlertTriangle, CheckCircle2, Navigation } from 'lucide-react';
import { InteractiveOpsMap } from '../../components/maps/InteractiveOpsMap';

export const RoutesPage: React.FC = () => {
  const drones = mockStore.getDrones();
  const orders = mockStore.getOrders();
  const geofences = mockStore.getGeofences();

  const [hasDeviation, setHasDeviation] = useState(true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <RouteIcon className="h-5 w-5 text-cyan-400" /> Route Planning & Deviation Alerts
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor planned waypoints vs actual flight tracks and enforce automated route correction commands
          </p>
        </div>
      </div>

      {/* ROUTE DEVIATION BANNER (Section 25) */}
      {hasDeviation && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">⚠ ROUTE DEVIATION DETECTED</h3>
              <p className="text-xs">
                Drone D-001 drifted 140 meters off planned San Francisco Air Corridor flight path due to wind gust updraft.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                mockStore.addNotification('Commanded Drone D-001 to return to planned route', 'info');
                setHasDeviation(false);
              }}
              className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-500 shadow-lg shadow-amber-600/30"
            >
              [Return To Planned Route]
            </button>
          </div>
        </div>
      )}

      {/* Interactive Map view */}
      <InteractiveOpsMap drones={drones} geofences={geofences} orders={orders} heightClass="h-[520px]" />
    </div>
  );
};
