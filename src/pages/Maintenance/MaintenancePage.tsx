import React, { useState, useEffect } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { MaintenanceRecord } from '../../types/skynav';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { Wrench, Plus, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';

export const MaintenancePage: React.FC = () => {
  const [records, setRecords] = useState(mockStore.getMaintenance());
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  useEffect(() => {
    return mockStore.subscribe(() => {
      setRecords([...mockStore.getMaintenance()]);
    });
  }, []);

  const columns: Column<MaintenanceRecord>[] = [
    { header: 'Repair ID', accessor: 'id', sortable: true },
    { header: 'Drone ID', accessor: (r) => <span className="font-bold text-cyan-300 font-mono">{r.droneId}</span>, sortable: true },
    { header: 'Issue Description', accessor: 'issue', sortable: true },
    {
      header: 'Priority',
      accessor: (r) => (
        <span
          className={`font-bold px-2 py-0.5 rounded text-[10px] ${
            r.priority === 'Critical'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              : r.priority === 'High'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          {r.priority}
        </span>
      ),
      sortable: true,
    },
    { header: 'Reported Date', accessor: 'reportedDate', sortable: true },
    { header: 'Technician', accessor: (r) => r.technician || 'Unassigned', sortable: true },
    {
      header: 'Status',
      accessor: (r) => <StatusBadge status={r.status} size="sm" />,
      sortable: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-cyan-400" /> Maintenance Command Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage scheduled service, motor replacements, sensor recalibrations, and technician dispatch
          </p>
        </div>

        <button
          onClick={() => setIsScheduleModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500"
        >
          <Plus className="h-4 w-4" /> Schedule Maintenance
        </button>
      </div>

      {/* Main Table */}
      <DataTable
        title="Maintenance Service Records"
        columns={columns}
        data={records}
        searchPlaceholder="Search Maintenance ID, Drone ID, Issue..."
        searchField={(r) => `${r.id} ${r.droneId} ${r.issue} ${r.technician}`}
      />

      {/* Schedule Maintenance Modal */}
      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title="Schedule Drone Service">
        <div className="space-y-4 text-xs text-slate-200">
          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Target Drone ID</label>
            <select className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none">
              {mockStore.getDrones().map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} - {d.name} ({d.model})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Issue / Maintenance Type</label>
            <input
              type="text"
              placeholder="e.g. Rotor #2 Motor ESC Sensor Recalibration"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Priority Level</label>
              <select className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Assigned Technician</label>
              <input
                type="text"
                placeholder="e.g. Marcus Vance"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setIsScheduleModalOpen(false)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                mockStore.addAuditLog('Admin', 'Fleet Manager', 'SCHEDULE_MAINTENANCE', 'Drone', 'D-018', 'Info', 'Scheduled routine maintenance service');
                setIsScheduleModalOpen(false);
              }}
              className="rounded-lg bg-cyan-600 px-4 py-2 font-bold text-white hover:bg-cyan-500 shadow-lg shadow-cyan-600/30"
            >
              Confirm Schedule
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
