import React, { useState, useMemo } from 'react';
import { Customer } from '../../types/skynav';
import { mockStore } from '../../services/mockDataStore';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Drawer } from '../../components/common/Drawer';
import { Avatar } from '../../components/common/Avatar';
import { downloadCSV } from '../../utils/exportUtils';
import {
  Users,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  CheckCircle2,
  Download,
  Filter,
  Search,
  ArrowUpDown,
  UserCheck,
  UserX,
  UserPlus,
  Percent,
  DollarSign,
  TrendingUp,
  History,
  Shield,
  HelpCircle,
  CreditCard,
  Send,
  Calendar,
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState(mockStore.getCustomers());
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'orders' | 'deliveries' | 'payments' | 'activity' | 'support'
  >('overview');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'suspended' | 'new' | 'high_value'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'orders' | 'spending'>('newest');

  // Customer statistics calculations
  const totalCustomers = customers.length;
  const activeCount = customers.filter((c) => c.status === 'Active').length;
  const suspendedCount = customers.filter((c) => c.status === 'Suspended').length;
  const newThisMonth = 8;
  const activeRate = ((activeCount / totalCustomers) * 100).toFixed(0);

  // Dynamic CSV Export
  const handleExportCSV = () => {
    const headers = ['Customer ID', 'Name', 'Email', 'Phone', 'Status', 'Total Orders', 'Successful Deliveries', 'Joined Date', 'Default Address'];
    const rows = customers.map((c) => [
      c.id,
      c.name,
      c.email,
      c.phone,
      c.status,
      c.totalOrders,
      c.successfulDeliveries,
      c.joinedDate,
      c.defaultAddress,
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSV(`skynav-customers-${dateStr}`, headers, rows);
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filterType === 'active') return c.status === 'Active';
      if (filterType === 'suspended') return c.status === 'Suspended';
      if (filterType === 'new') return c.totalOrders <= 10;
      if (filterType === 'high_value') return c.totalOrders >= 25;
      return true;
    });
  }, [customers, filterType]);

  const columns: Column<Customer>[] = [
    {
      header: 'Customer Details',
      accessor: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.name} src={r.avatar} size="md" status={r.status === 'Active' ? 'online' : 'suspended'} />
          <div>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block hover:text-cyan-600 dark:hover:text-cyan-400">
              {r.name}
            </span>
            <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">{r.id}</span>
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Contact Info',
      accessor: (r) => (
        <div className="space-y-0.5 text-xs">
          <p className="text-slate-700 dark:text-slate-300 font-medium">{r.email}</p>
          <p className="text-[11px] text-slate-400 font-mono">{r.phone}</p>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Delivery Volume',
      accessor: (r) => (
        <div className="text-xs">
          <span className="font-bold text-slate-900 dark:text-slate-100">{r.totalOrders} Orders</span>
          <p className="text-[10px] text-slate-400">({r.successfulDeliveries} confirmed drops)</p>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Success SLA',
      accessor: (r) => {
        const rate = ((r.successfulDeliveries / (r.totalOrders || 1)) * 100).toFixed(1);
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-12 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${rate}%` }} />
            </div>
            <span className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400">{rate}%</span>
          </div>
        );
      },
      sortable: true,
    },
    {
      header: 'Status',
      accessor: (r) => <StatusBadge status={r.status} size="sm" />,
      sortable: true,
    },
    {
      header: 'Joined Date',
      accessor: (r) => <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">{r.joinedDate}</span>,
      sortable: true,
    },
    {
      header: 'Actions',
      accessor: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCustomer(r);
          }}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 shadow-sm transition-colors"
        >
          View Account
        </button>
      ),
    },
  ];

  const customerOrders = selectedCustomer
    ? mockStore.getOrders().filter((o) => o.customerId === selectedCustomer.id)
    : [];

  const totalSpent = customerOrders.reduce((sum, o) => sum + (o.paymentStatus === 'successful' ? o.paymentAmount : 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
            <Users className="w-3.5 h-3.5" /> USER REGISTRY
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Registered Customers Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage registered SKYNAV customers, order history, default delivery dropoff coordinates, and account status
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all"
        >
          <Download className="w-4 h-4 text-cyan-500" /> Export Customer CSV
        </button>
      </div>

      {/* 2. Top Summary Metrics Cards (Section 14) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase font-bold">TOTAL CUSTOMERS</span>
            <Users className="w-4 h-4 text-cyan-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalCustomers}</p>
          <span className="text-[10px] text-slate-400 font-mono">100% verified KYC</span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-500">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">ACTIVE ACCOUNTS</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{activeCount}</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Normal Standing</span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">SUSPENDED</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{suspendedCount}</p>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono">Restricted Access</span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-blue-500">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">NEW THIS MONTH</span>
            <UserPlus className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{newThisMonth}</p>
          <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">+16% MoM Growth</span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-cyan-500">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">ACTIVE RATE</span>
            <Percent className="w-4 h-4 text-cyan-500" />
          </div>
          <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{activeRate}%</p>
          <span className="text-[10px] text-slate-400 font-mono">High Retention</span>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-bold text-[11px] mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Customers' },
            { id: 'active', label: 'Active (46)' },
            { id: 'suspended', label: 'Suspended (2)' },
            { id: 'new', label: 'New Cohort' },
            { id: 'high_value', label: 'High Value' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                filterType === tab.id
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Main Customer Table */}
      <DataTable
        title="Registered Customer Accounts Directory"
        columns={columns}
        data={filteredCustomers}
        searchPlaceholder="Search Customer Name, ID, Email, Phone..."
        searchField={(c) => `${c.id} ${c.name} ${c.email} ${c.phone}`}
        onRowClick={(row) => setSelectedCustomer(row)}
      />

      {/* 5. Comprehensive Customer Profile Drawer (Section 16: 6 Tabs) */}
      {selectedCustomer && (
        <Drawer
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={`Customer Profile — ${selectedCustomer.name}`}
          subtitle={`Account ID: ${selectedCustomer.id} • Registered: ${selectedCustomer.joinedDate}`}
          width="max-w-2xl"
        >
          <div className="space-y-6 text-xs text-slate-700 dark:text-slate-200">
            {/* Customer Hero Card */}
            <div className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <Avatar name={selectedCustomer.name} src={selectedCustomer.avatar} size="xl" status={selectedCustomer.status === 'Active' ? 'online' : 'suspended'} />
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{selectedCustomer.name}</h3>
                  <p className="text-slate-500 dark:text-slate-400">{selectedCustomer.email}</p>
                  <p className="text-slate-500 dark:text-slate-400 font-mono mt-0.5">{selectedCustomer.phone}</p>
                </div>
              </div>
              <StatusBadge status={selectedCustomer.status} size="lg" />
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono block">TOTAL ORDERS</span>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100">{selectedCustomer.totalOrders}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono block">DELIVERED</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {selectedCustomer.successfulDeliveries}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono block">SUCCESS SLA</span>
                <span className="text-sm font-black text-cyan-600 dark:text-cyan-400">
                  {((selectedCustomer.successfulDeliveries / (selectedCustomer.totalOrders || 1)) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono block">TOTAL SPENT</span>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100">₹{totalSpent || 2450}</span>
              </div>
            </div>

            {/* 6 Tabs */}
            <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-2 font-bold text-slate-400 overflow-x-auto custom-scrollbar pb-1">
              {[
                { id: 'overview', label: 'Overview & Address' },
                { id: 'orders', label: `Orders (${customerOrders.length})` },
                { id: 'deliveries', label: 'Live Drops' },
                { id: 'payments', label: 'Payments' },
                { id: 'activity', label: 'Activity Log' },
                { id: 'support', label: 'Support' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`px-3 py-2 text-xs rounded-xl whitespace-nowrap transition-all ${
                    activeTab === t.id
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-black'
                      : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2">
                  <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-500" /> Default Delivery Location
                  </h5>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{selectedCustomer.defaultAddress}</p>
                  <p className="text-slate-400 font-mono text-[11px]">
                    GPS Coordinates: {selectedCustomer.defaultCoords.lat.toFixed(6)}° N,{' '}
                    {selectedCustomer.defaultCoords.lng.toFixed(6)}° E
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2">
                  <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-cyan-500" /> Account Security & Verification
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">KYC Status:</span>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">Verified (Aadhaar / Digilocker)</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Registered:</span>
                      <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{selectedCustomer.joinedDate}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                {customerOrders.length === 0 ? (
                  <p className="text-slate-400 text-center py-6">No historical orders found for this customer.</p>
                ) : (
                  customerOrders.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{o.id}</span>
                        <StatusBadge status={o.status} size="sm" />
                      </div>
                      <p className="text-slate-900 dark:text-slate-100 font-semibold">{o.packageName}</p>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Merchant: {o.merchantName}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{o.paymentAmount}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'deliveries' && (
              <div className="space-y-2">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>All active delivery orders for this customer are running with nominal autonomous corridor telemetry.</span>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">UPI / Razorpay Instant</span>
                    <p className="text-[10px] text-slate-400">Primary settlement method</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                    Auto-Verified
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-2 text-[11px] font-mono">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span>Customer verified delivery PIN</span>
                  <span className="text-slate-400">Today, 09:20 IST</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span>Updated dropoff delivery coordinates</span>
                  <span className="text-slate-400">Yesterday, 14:10 IST</span>
                </div>
              </div>
            )}

            {activeTab === 'support' && (
              <div className="space-y-2">
                <p className="text-slate-400 text-center py-4">No open support tickets for this customer account.</p>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
};
