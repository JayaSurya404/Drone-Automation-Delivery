import React, { useState, useEffect } from 'react';
import { Merchant } from '../../types/skynav';
import { mockStore } from '../../services/mockDataStore';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Drawer } from '../../components/common/Drawer';
import { Store, CheckCircle2, XCircle, ShieldAlert, DollarSign } from 'lucide-react';

export const MerchantsPage: React.FC = () => {
  const [merchants, setMerchants] = useState(mockStore.getMerchants());
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);

  useEffect(() => {
    return mockStore.subscribe(() => {
      setMerchants([...mockStore.getMerchants()]);
    });
  }, []);

  const handleStatusUpdate = (merchantId: string, status: Merchant['status']) => {
    mockStore.updateMerchantStatus(merchantId, status);
  };

  const columns: Column<Merchant>[] = [
    { header: 'Merchant ID', accessor: 'id', sortable: true },
    { header: 'Business Name', accessor: (r) => <span className="font-bold text-slate-100">{r.businessName}</span>, sortable: true },
    { header: 'Owner Name', accessor: 'ownerName', sortable: true },
    { header: 'Category', accessor: 'category', sortable: true },
    { header: 'Orders', accessor: 'totalOrders', sortable: true },
    { header: 'Success Rate', accessor: (r) => `${r.successRate}%`, sortable: true },
    { header: 'Revenue', accessor: (r) => `$${r.revenue.toLocaleString()}`, sortable: true },
    {
      header: 'Status',
      accessor: (r) => <StatusBadge status={r.status} size="sm" />,
      sortable: true,
    },
    {
      header: 'Admin Actions',
      accessor: (r) => (
        <div className="flex items-center gap-1.5">
          {r.status === 'Pending' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusUpdate(r.id, 'Approved');
              }}
              className="rounded bg-emerald-600/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-600/30"
            >
              Approve
            </button>
          )}
          {r.status === 'Approved' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusUpdate(r.id, 'Suspended');
              }}
              className="rounded bg-rose-600/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-300 hover:bg-rose-600/30"
            >
              Suspend
            </button>
          )}
          {r.status === 'Suspended' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusUpdate(r.id, 'Approved');
              }}
              className="rounded bg-cyan-600/20 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-600/30"
            >
              Re-activate
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Store className="h-5 w-5 text-cyan-400" /> Merchant Dispatcher Network
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Approve onboarding merchants, review dispatch fulfillment SLAs, and audit partner revenue
          </p>
        </div>
      </div>

      <DataTable
        title="Merchant Partner Network"
        columns={columns}
        data={merchants}
        searchPlaceholder="Search Merchant Name, Category..."
        searchField={(m) => `${m.id} ${m.businessName} ${m.category} ${m.ownerName}`}
        onRowClick={(row) => setSelectedMerchant(row)}
      />
    </div>
  );
};
