import React, { useState, useEffect } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { AuditLog } from '../../types/skynav';
import { DataTable, Column } from '../../components/common/DataTable';
import { History, Shield, Clock } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState(mockStore.getAuditLogs());

  useEffect(() => {
    return mockStore.subscribe(() => {
      setLogs([...mockStore.getAuditLogs()]);
    });
  }, []);

  const columns: Column<AuditLog>[] = [
    { header: 'Log ID', accessor: 'id', sortable: true },
    {
      header: 'Timestamp',
      accessor: (r) => <span className="font-mono text-slate-400 text-[11px]">{r.timestamp}</span>,
      sortable: true,
    },
    {
      header: 'Administrator',
      accessor: (r) => (
        <div>
          <p className="font-bold text-slate-100">{r.adminName}</p>
          <p className="text-[10px] text-cyan-400 font-semibold">{r.adminRole}</p>
        </div>
      ),
      sortable: true,
    },
    { header: 'Action Event', accessor: 'action', sortable: true },
    { header: 'Target Entity', accessor: (r) => `${r.entity} (#${r.entityId})`, sortable: true },
    {
      header: 'Severity',
      accessor: (r) => (
        <span
          className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
            r.severity === 'Critical'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : r.severity === 'Warning'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          {r.severity}
        </span>
      ),
      sortable: true,
    },
    { header: 'Action Details', accessor: 'details', sortable: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="h-5 w-5 text-cyan-400" /> System Audit Trail & Compliance Logs
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable audit record of administrative flight commands, drone assignments, and security policy edits
          </p>
        </div>
      </div>

      <DataTable
        title="Administrative Operations Audit Trail"
        columns={columns}
        data={logs}
        searchPlaceholder="Search Admin Name, Action, Entity..."
        searchField={(l) => `${l.id} ${l.adminName} ${l.action} ${l.entity} ${l.details}`}
      />
    </div>
  );
};
