import React, { useState, useEffect } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { EmergencyAlert } from '../../types/skynav';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { DroneVisual } from '../../components/drone/DroneVisual';
import { AlertOctagon, Battery, Wifi, ShieldAlert, Radio, Flame, CheckCircle2, Navigation, Pause } from 'lucide-react';

export const EmergencyPage: React.FC = () => {
  const [emergencies, setEmergencies] = useState(mockStore.getEmergencies());
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: 'RTH' | 'LAND' | 'PAUSE' | 'CANCEL';
    droneId: string;
  } | null>(null);

  useEffect(() => {
    return mockStore.subscribe(() => {
      setEmergencies([...mockStore.getEmergencies()]);
    });
  }, []);

  const handleTriggerAction = (droneId: string, action: 'RTH' | 'LAND' | 'PAUSE' | 'CANCEL', title: string, message: string) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      action,
      droneId,
    });
  };

  const handleConfirm = () => {
    if (confirmDialog) {
      mockStore.executeEmergencyCommand(confirmDialog.droneId, confirmDialog.action);
    }
  };

  const activeEmergencies = emergencies.filter((e) => e.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header Banner - High contrast emergency alert header */}
      <div className="rounded-3xl border border-rose-500/50 bg-gradient-to-r from-rose-950 via-slate-950 to-slate-950 p-6 md:p-8 shadow-2xl space-y-3">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-rose-500 p-3 text-white shadow-xl shadow-rose-500/50 animate-pulse">
            <AlertOctagon className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-rose-400 uppercase tracking-widest font-mono">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" /> CRITICAL FAILOVER OVERRIDE
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-rose-100 uppercase tracking-wider">
              EMERGENCY AIRSPACE COMMAND CENTER
            </h1>
            <p className="text-xs text-rose-300">
              High-priority flight emergency dispatch console • Instant hardware failover, safe hovering, and RTH execution
            </p>
          </div>
        </div>
      </div>

      {/* Active Emergency Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-500 animate-pulse" /> Active Airspace Emergencies ({activeEmergencies.length})
          </h2>
          <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
            {activeEmergencies.length > 0 ? 'Requires Immediate Operator Decision' : 'All Clear'}
          </span>
        </div>

        {activeEmergencies.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2 shadow-xl">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">No Active Emergencies</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">All autonomous drone flights are proceeding nominally within safety limits.</p>
          </div>
        ) : (
          activeEmergencies.map((emg) => {
            const drone = mockStore.getDrones().find((d) => d.id === emg.droneId);
            return (
              <div
                key={emg.id}
                className="rounded-3xl border border-rose-500/40 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-rose-500/20 pb-3 gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-rose-500 px-3 py-1 text-xs font-black text-white uppercase shadow-md shadow-rose-500/40">
                      🚨 {emg.priority}
                    </span>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                        Drone {emg.droneId} — {emg.issueType}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                        Mission: {emg.missionId || 'MS-10284'} • Timestamp: {emg.timestamp}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="flex items-center gap-1 text-rose-500">
                      <Battery className="h-4 w-4" /> Battery: {emg.batteryLevel}%
                    </span>
                    <span className="flex items-center gap-1 text-amber-500">
                      <Wifi className="h-4 w-4" /> Signal: {emg.signalStatus}
                    </span>
                  </div>
                </div>

                {/* Drone Visual & Location Context */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="w-full">
                    <DroneVisual
                      model={drone?.model || 'SKYNAV X1'}
                      id={emg.droneId}
                      status="emergency"
                      battery={emg.batteryLevel}
                      size="sm"
                      interactive={false}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs text-rose-900 dark:text-rose-200">
                      <span className="font-black uppercase text-[10px] tracking-wider text-rose-600 dark:text-rose-400 block mb-1">
                        Autopilot Safety System Recommendation:
                      </span>
                      {emg.recommendedAction}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-mono block">GPS LOCK</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">Available (RTK Fix)</span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-mono block">COORDINATES</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {drone?.location ? `${drone.location.lat.toFixed(4)}° N, ${drone.location.lng.toFixed(4)}° E` : '11.0280° N, 76.9680° E'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 36 Actions: Return To Home, Emergency Land, Pause Mission, Escalate */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() =>
                      handleTriggerAction(
                        emg.droneId,
                        'PAUSE',
                        `Pause Mission & Hover for ${emg.droneId}?`,
                        'Commands drone to halt velocity and perform stationary safe hover in place.'
                      )
                    }
                    className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-cyan-500 shadow-sm transition-colors"
                  >
                    [Pause / Safe Hover]
                  </button>

                  <button
                    onClick={() =>
                      handleTriggerAction(
                        emg.droneId,
                        'RTH',
                        `Confirm Return To Home (RTH) for ${emg.droneId}?`,
                        'Commands drone autopilot to reverse vector immediately and return to Coimbatore Ops Base.'
                      )
                    }
                    className="rounded-2xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/25 transition-colors"
                  >
                    [Return To Home]
                  </button>

                  <button
                    onClick={() =>
                      handleTriggerAction(
                        emg.droneId,
                        'LAND',
                        `CONFIRM EMERGENCY FORCED LANDING FOR ${emg.droneId}?`,
                        'CRITICAL WARNING: The drone will execute an immediate descending touchdown on the closest clear terrain.'
                      )
                    }
                    className="rounded-2xl bg-rose-600 hover:bg-rose-500 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-600/30 animate-pulse transition-colors"
                  >
                    [Emergency Land]
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Dialog with clear warnings */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText="Confirm Emergency Command"
          isDangerous={confirmDialog.action === 'LAND'}
          onConfirm={handleConfirm}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};
