import React, { useState, useEffect } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { GeofenceZone, GeofenceType } from '../../types/skynav';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { InteractiveOpsMap } from '../../components/maps/InteractiveOpsMap';
import { Shield, Plus, AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

export const GeofencingPage: React.FC = () => {
  const [geofences, setGeofences] = useState(mockStore.getGeofences());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [zoneName, setZoneName] = useState('');
  const [zoneType, setZoneType] = useState<GeofenceType>('nofly');

  useEffect(() => {
    return mockStore.subscribe(() => {
      setGeofences([...mockStore.getGeofences()]);
    });
  }, []);

  const handleAddZone = (e: React.FormEvent) => {
    e.preventDefault();
    mockStore.addGeofence({
      name: zoneName || 'New Air Corridor',
      type: zoneType,
      coordinates: [
        [11.035, 76.955],
        [11.035, 76.985],
        [11.015, 76.985],
        [11.015, 76.955],
      ],
      boundsRadiusMeters: 2000,
      active: true,
      maxAltitudeMeters: 100,
      description: 'Custom administrative airspace polygon boundary.',
    });
    setIsAddModalOpen(false);
    setZoneName('');
  };

  const columns: Column<GeofenceZone>[] = [
    { header: 'Zone ID', accessor: 'id', sortable: true },
    { header: 'Zone Name', accessor: (r) => <span className="font-bold text-slate-900 dark:text-slate-100">{r.name}</span>, sortable: true },
    {
      header: 'Category Type',
      accessor: (r) => (
        <span
          className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
            r.type === 'delivery'
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : r.type === 'nofly'
              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
          }`}
        >
          {r.type}
        </span>
      ),
      sortable: true,
    },
    { header: 'Altitude Ceiling', accessor: (r) => `${r.maxAltitudeMeters || 120} m`, sortable: true },
    { header: 'Corridor Radius', accessor: (r) => `${r.boundsRadiusMeters || 2000} m`, sortable: true },
    {
      header: 'Status',
      accessor: (r) => <StatusBadge status={r.active ? 'active' : 'inactive'} size="sm" />,
      sortable: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
            <Shield className="w-3.5 h-3.5" /> AIRSPACE SAFETY
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            DGCA Geofencing & Airspace Manager
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage approved delivery zones, airport restricted no-fly corridors, and caution areas
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500 transition-all"
        >
          <Plus className="h-4 w-4" /> Define New Geofence Zone
        </button>
      </div>

      {/* Real Geospatial Map with Geofence Polygons */}
      <InteractiveOpsMap drones={mockStore.getDrones()} geofences={geofences} heightClass="h-[480px]" />

      {/* Table */}
      <DataTable
        title="Active Airspace Zones & Corridors"
        columns={columns}
        data={geofences}
        searchPlaceholder="Search Zone Name, Category..."
        searchField={(g) => `${g.id} ${g.name} ${g.type}`}
      />

      {/* Create Geofence Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Define New Geofence Airspace Zone">
        <form onSubmit={handleAddZone} className="space-y-4 text-xs text-slate-700 dark:text-slate-200">
          <div className="space-y-1">
            <label className="font-bold text-slate-900 dark:text-slate-100">Zone Name</label>
            <input
              type="text"
              required
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="e.g. Coimbatore Airport CJB Approach Buffer"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none shadow-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-900 dark:text-slate-100">Zone Classification</label>
            <select
              value={zoneType}
              onChange={(e) => setZoneType(e.target.value as GeofenceType)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-cyan-500 focus:outline-none shadow-sm"
            >
              <option value="delivery">Delivery Zone (Approved Autonomous Flight)</option>
              <option value="nofly">No-Fly Zone (Strict DGCA Airspace Ban)</option>
              <option value="caution">Caution Zone (Speed / Altitude Restrictions)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 font-bold text-white shadow-lg shadow-cyan-500/20"
            >
              Save Airspace Boundary
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
