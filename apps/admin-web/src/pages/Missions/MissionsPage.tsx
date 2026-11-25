import React, { useState, useEffect } from 'react';
import { Mission, Drone } from '../../types/skynav';
import { mockStore } from '../../services/mockDataStore';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Drawer } from '../../components/common/Drawer';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { InteractiveOpsMap } from '../../components/maps/InteractiveOpsMap';
import { DroneVisual } from '../../components/drone/DroneVisual';
import { Send, Bot, Battery, Navigation, Gauge, AlertTriangle, ShieldAlert, CheckCircle2, Wind } from 'lucide-react';

export const MissionsPage: React.FC = () => {
  const [missions, setMissions] = useState(mockStore.getMissions());
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: 'RTH' | 'LAND' | 'PAUSE' | 'CANCEL';
    droneId: string;
  } | null>(null);

  useEffect(() => {
    return mockStore.subscribe(() => {
      setMissions([...mockStore.getMissions()]);
    });
  }, []);

  const columns: Column<Mission>[] = [
    {
      header: 'Mission ID',
      accessor: (row) => (
        <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono hover:underline cursor-pointer">
          {row.id}
        </span>
      ),
      sortable: true,
    },
    { header: 'Order ID', accessor: 'orderId', sortable: true },
    { header: 'Assigned Drone', accessor: 'droneId', sortable: true },
    { header: 'Distance', accessor: (row) => `${row.distanceKm} km`, sortable: true },
    { header: 'Speed', accessor: (row) => `${row.currentSpeedKmH} km/h`, sortable: true },
    { header: 'Altitude', accessor: (row) => `${row.currentAltitudeM} m`, sortable: true },
    {
      header: 'Battery',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 font-bold">
          <Battery className="h-3.5 w-3.5 text-cyan-500" />
          <span>{row.currentBattery}%</span>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.currentStatus} size="sm" />,
      sortable: true,
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedMission(row);
          }}
          className="rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-3 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/30 transition-colors"
        >
          Mission Control
        </button>
      ),
    },
  ];

  const handleCommandTrigger = (droneId: string, action: 'RTH' | 'LAND' | 'PAUSE' | 'CANCEL', title: string, message: string) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      action,
      droneId,
    });
  };

  const handleConfirmAction = () => {
    if (confirmDialog) {
      mockStore.executeEmergencyCommand(confirmDialog.droneId, confirmDialog.action);
    }
  };

  const activeDrone = selectedMission ? mockStore.getDrones().find((d) => d.id === selectedMission.droneId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
            <Send className="w-3.5 h-3.5" /> AIRSPACE CORRIDORS
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Autonomous Flight Missions
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitor autonomous flight missions, route waypoints, and execute live flight control overrides
          </p>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Active & Historical Missions"
        columns={columns}
        data={missions}
        searchPlaceholder="Search Mission ID, Drone ID, Order..."
        searchField={(m) => `${m.id} ${m.orderId} ${m.droneId}`}
        onRowClick={(row) => setSelectedMission(row)}
        filterOptions={[
          { label: 'In Flight', value: 'in_flight', filterFn: (m) => m.currentStatus === 'in_flight' },
          { label: 'Completed', value: 'completed', filterFn: (m) => m.currentStatus === 'completed' },
          { label: 'Emergency', value: 'emergency', filterFn: (m) => m.currentStatus === 'emergency' },
        ]}
      />

      {/* Mission Command Center Side Drawer */}
      {selectedMission && (
        <Drawer
          isOpen={!!selectedMission}
          onClose={() => setSelectedMission(null)}
          title={`Mission Command — #${selectedMission.id}`}
          subtitle={`Order #${selectedMission.orderId} • Drone ${selectedMission.droneId}`}
          width="max-w-4xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs text-slate-700 dark:text-slate-200">
            {/* Left 2 Cols: Flight Route Map */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                Real-Time Airspace Flight Path & Telemetry
              </h4>
              <InteractiveOpsMap
                drones={activeDrone ? [activeDrone] : []}
                geofences={mockStore.getGeofences()}
                orders={mockStore.getOrders().filter((o) => o.id === selectedMission.orderId)}
                heightClass="h-[420px]"
              />
            </div>

            {/* Right Col: Mission Controls & Hardware State */}
            <div className="space-y-4">
              {/* Drone Card */}
              {activeDrone && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100">{activeDrone.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">{activeDrone.model}</p>
                    </div>
                    <StatusBadge status={activeDrone.status} size="sm" />
                  </div>
                  <div className="w-full">
                    <DroneVisual model={activeDrone.model} id={activeDrone.id} size="sm" interactive={false} />
                  </div>
                </div>
              )}

              {/* Waypoint Details */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Pickup Origin:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[130px]">
                    {selectedMission.pickupAddress}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Destination:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[130px]">
                    {selectedMission.destinationAddress}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Distance:</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">{selectedMission.distanceKm} km</span>
                </div>
              </div>

              {/* Flight Overrides */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  Manual Autopilot Overrides
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      handleCommandTrigger(
                        selectedMission.droneId,
                        'RTH',
                        'Command Return-To-Home?',
                        `This will abort Mission ${selectedMission.id} and force Drone ${selectedMission.droneId} to return to base immediately.`
                      )
                    }
                    className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200 hover:border-cyan-500"
                  >
                    Force RTH
                  </button>
                  <button
                    onClick={() =>
                      handleCommandTrigger(
                        selectedMission.droneId,
                        'LAND',
                        'Command Emergency Descent?',
                        `CRITICAL WARNING: This will command Drone ${selectedMission.droneId} to land immediately at its current GPS location!`
                      )
                    }
                    className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                  >
                    Emergency Land
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText="Confirm Flight Override"
          isDangerous={confirmDialog.action === 'LAND'}
          onConfirm={handleConfirmAction}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};
