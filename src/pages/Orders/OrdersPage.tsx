import React, { useState, useEffect } from 'react';
import { Order } from '../../types/skynav';
import { mockStore } from '../../services/mockDataStore';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Drawer } from '../../components/common/Drawer';
import { DroneAssignmentModal } from '../../components/operations/DroneAssignmentModal';
import { ShoppingBag, Bot, Clock, CheckCircle2, MapPin, User, Store, Scale, ArrowRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState(mockStore.getOrders());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);

  useEffect(() => {
    return mockStore.subscribe(() => {
      setOrders([...mockStore.getOrders()]);
    });
  }, []);

  const columns: Column<Order>[] = [
    {
      header: 'Order ID',
      accessor: (row) => (
        <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono hover:underline cursor-pointer">
          {row.id}
        </span>
      ),
      sortable: true,
    },
    { header: 'Customer', accessor: 'customerName', sortable: true },
    { header: 'Merchant', accessor: 'merchantName', sortable: true },
    { header: 'Package Item', accessor: 'packageName', sortable: true },
    {
      header: 'Payload',
      accessor: (row) => `${row.packageWeightKg} kg`,
      sortable: true,
    },
    {
      header: 'Assigned Drone',
      accessor: (row) =>
        row.droneId ? (
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{row.droneId}</span>
        ) : (
          <span className="text-slate-400 italic">Unassigned</span>
        ),
      sortable: true,
    },
    {
      header: 'Settlement',
      accessor: (row) => (
        <span className={`font-semibold ${row.paymentStatus === 'successful' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
          ₹{row.paymentAmount} ({row.paymentStatus})
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} size="sm" />,
      sortable: true,
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          {row.status === 'pending' || row.status === 'drone_assigned' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAssigningOrder(row);
              }}
              className="rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-3 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/30 transition-colors"
            >
              Assign Drone
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedOrder(row);
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              View Order
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest">
            <ShoppingBag className="w-3.5 h-3.5" /> LOGISTICS DISPATCH
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Delivery Orders Lifecycle
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage customer orders, package validations, and autonomous drone assignments
          </p>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Commercial Delivery Orders"
        columns={columns}
        data={orders}
        searchPlaceholder="Search Order ID, Customer, Package, Merchant..."
        searchField={(o) => `${o.id} ${o.customerName} ${o.packageName} ${o.merchantName}`}
        onRowClick={(row) => setSelectedOrder(row)}
        filterOptions={[
          { label: 'Pending Assignment', value: 'pending', filterFn: (o) => o.status === 'pending' || o.status === 'drone_assigned' },
          { label: 'In Transit', value: 'in_transit', filterFn: (o) => o.status === 'in_transit' },
          { label: 'Delivered', value: 'delivered', filterFn: (o) => o.status === 'delivered' },
          { label: 'Failed / Cancelled', value: 'failed', filterFn: (o) => o.status === 'failed' || o.status === 'cancelled' },
        ]}
      />

      {/* Order Detail Side Drawer */}
      {selectedOrder && (
        <Drawer
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Order Details — #${selectedOrder.id}`}
          subtitle={`Created at ${selectedOrder.createdAt}`}
        >
          <div className="space-y-6 text-xs text-slate-700 dark:text-slate-200">
            {/* Status & Quick Action */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
              <div>
                <span className="text-slate-400 font-mono text-[10px] block">CURRENT STATUS</span>
                <div className="mt-1">
                  <StatusBadge status={selectedOrder.status} size="lg" />
                </div>
              </div>
              {selectedOrder.status === 'pending' && (
                <button
                  onClick={() => {
                    const orderToAssign = selectedOrder;
                    setSelectedOrder(null);
                    setAssigningOrder(orderToAssign);
                  }}
                  className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500"
                >
                  Assign Autonomous Drone →
                </button>
              )}
            </div>

            {/* Entity Navigation Links (Section 38) */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Logistics Relationship Link</span>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="px-2.5 py-1 bg-white dark:bg-slate-950 rounded-lg border border-slate-300 dark:border-slate-700 text-cyan-600 dark:text-cyan-400">
                  {selectedOrder.id}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="px-2.5 py-1 bg-white dark:bg-slate-950 rounded-lg border border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400">
                  {selectedOrder.missionId || 'Standby Mission'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="px-2.5 py-1 bg-white dark:bg-slate-950 rounded-lg border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400">
                  Drone: {selectedOrder.droneId || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Package & Customer Details */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono block">PACKAGE ITEM</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedOrder.packageName}</span>
                <span className="text-[11px] text-cyan-600 dark:text-cyan-400 block mt-0.5">Weight: {selectedOrder.packageWeightKg} kg</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono block">MERCHANT PICKUP</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedOrder.merchantName}</span>
                <p className="text-[11px] text-slate-500">{selectedOrder.pickupAddress}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono block">CUSTOMER DROPOFF</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedOrder.customerName}</span>
                <p className="text-[11px] text-slate-500">{selectedOrder.destinationAddress}</p>
                <p className="text-[11px] text-slate-500 font-mono">Email: {selectedOrder.customerEmail}</p>
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* Drone Assignment Modal with Recommendation */}
      <DroneAssignmentModal
        isOpen={!!assigningOrder}
        onClose={() => setAssigningOrder(null)}
        order={assigningOrder}
      />
    </div>
  );
};
