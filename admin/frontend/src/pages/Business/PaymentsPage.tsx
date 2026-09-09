import React from 'react';
import { mockStore } from '../../services/mockDataStore';
import { PaymentTransaction } from '../../types/skynav';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CreditCard, DollarSign, ArrowUpRight } from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const payments = mockStore.getPayments();

  const totalRevenue = payments
    .filter((p) => p.status === 'Successful')
    .reduce((acc, p) => acc + p.amount, 0);

  const columns: Column<PaymentTransaction>[] = [
    { header: 'Transaction ID', accessor: 'id', sortable: true },
    { header: 'Order ID', accessor: (r) => <span className="font-bold text-cyan-300 font-mono">{r.orderId}</span>, sortable: true },
    { header: 'Customer', accessor: 'customerName', sortable: true },
    {
      header: 'Amount',
      accessor: (r) => <span className="font-bold text-slate-100">${r.amount.toFixed(2)}</span>,
      sortable: true,
    },
    { header: 'Method', accessor: 'paymentMethod', sortable: true },
    { header: 'Timestamp', accessor: 'timestamp', sortable: true },
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
            <CreditCard className="h-5 w-5 text-cyan-400" /> Payments & Financial Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit customer delivery transactions, payout settlements, and refund requests
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-right">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Settled Volume</span>
          <span className="text-lg font-black text-emerald-400">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <DataTable
        title="Payment Transactions Audit"
        columns={columns}
        data={payments}
        searchPlaceholder="Search Transaction ID, Customer, Order..."
        searchField={(p) => `${p.id} ${p.orderId} ${p.customerName}`}
      />
    </div>
  );
};
