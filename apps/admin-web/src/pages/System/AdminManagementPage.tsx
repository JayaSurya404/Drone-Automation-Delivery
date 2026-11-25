import React, { useState } from 'react';
import { mockStore } from '../../services/mockDataStore';
import { AdminUser, AdminRole } from '../../types/skynav';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { UserCheck, Shield, Key } from 'lucide-react';

export const AdminManagementPage: React.FC = () => {
  const admins = mockStore.getAdmins();

  const columns: Column<AdminUser>[] = [
    { header: 'Admin ID', accessor: 'id', sortable: true },
    {
      header: 'Name',
      accessor: (r) => (
        <div className="flex items-center gap-2.5">
          <img src={r.avatar} alt={r.name} className="h-7 w-7 rounded-full object-cover border border-slate-700" />
          <span className="font-bold text-slate-100">{r.name}</span>
        </div>
      ),
      sortable: true,
    },
    { header: 'Email', accessor: 'email', sortable: true },
    {
      header: 'Role Assignment',
      accessor: (r) => (
        <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-cyan-300 border border-cyan-500/30">
          {r.role.replace('_', ' ')}
        </span>
      ),
      sortable: true,
    },
    { header: 'Last Login', accessor: 'lastLogin', sortable: true },
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
            <UserCheck className="h-5 w-5 text-cyan-400" /> Admin Governance & Role Access Control
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure administrator accounts, role privileges, and fine-grained security permissions
          </p>
        </div>
      </div>

      {/* Permissions Matrix Overview */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md space-y-3">
        <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Key className="h-4 w-4 text-cyan-400" /> Role Permissions Matrix
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          {[
            { role: 'Super Admin', desc: 'Full system control, admin management, geofence edit, emergency overrides.' },
            { role: 'Ops Admin', desc: 'Order assignment, mission control, route overrides, customer support.' },
            { role: 'Fleet Manager', desc: 'Drone registration, battery health diagnostics, maintenance scheduling.' },
            { role: 'Support Admin', desc: 'Customer account directory, helpdesk tickets, delivery status updates.' },
            { role: 'Analyst', desc: 'Read-only access to analytics dashboards, revenue ledgers, and report generation.' },
          ].map((item) => (
            <div key={item.role} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
              <h4 className="font-bold text-cyan-300 text-xs">{item.role}</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <DataTable
        title="Authorized Administrators"
        columns={columns}
        data={admins}
        searchPlaceholder="Search Admin Name, Role, Email..."
        searchField={(a) => `${a.id} ${a.name} ${a.email} ${a.role}`}
      />
    </div>
  );
};
