import React, { useState, useEffect } from 'react';
import { Order } from '../../types/skynav';
import { mockStore } from '../../services/mockDataStore';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Drawer } from '../../components/common/Drawer';
import { Modal } from '../../components/common/Modal';
import { DroneAssignmentModal } from '../../components/operations/DroneAssignmentModal';
import {
  ShoppingBag,
  Bot,
  Clock,
  CheckCircle2,
  MapPin,
  User,
  Store,
  Scale,
  ArrowRight,
  ExternalLink,
  PackageCheck,
  Send,
  Plus,
  RefreshCw,
  Box,
  Radio,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState(mockStore.getOrders());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState<boolean>(false);
  const [productSuccess, setProductSuccess] = useState<string | null>(null);

  // New product form
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('Medical & First Aid');
  const [productPrice, setProductPrice] = useState('24.99');
  const [productWeight, setProductWeight] = useState('450');
  const [productDescription, setProductDescription] = useState('High-priority autonomous drone delivery payload.');
  const [productImage, setProductImage] = useState('https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80');

  useEffect(() => {
    return mockStore.subscribe(() => {
      setOrders([...mockStore.getOrders()]);
      if (selectedOrder) {
        const updated = mockStore.getOrders().find((o) => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    });
  }, [selectedOrder]);

  const handleStatusTransition = async (orderId: string, nextStatus: string, desc?: string) => {
    await mockStore.updateOrderStatus(orderId, nextStatus, desc);
  };

  const handleLaunchMission = async (missionId: string) => {
    await mockStore.launchMission(missionId);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingProduct(true);
    setProductSuccess(null);
    try {
      const ok = await mockStore.createProduct({
        name: productName,
        category: productCategory,
        price: parseFloat(productPrice) || 19.99,
        weightGrams: parseInt(productWeight) || 500,
        description: productDescription,
        image: productImage,
        stockCount: 50,
        isAvailable: true,
      });
      if (ok) {
        setProductSuccess(`Product "${productName}" created and synced to Customer Catalog!`);
        setTimeout(() => {
          setIsProductModalOpen(false);
          setProductSuccess(null);
          setProductName('');
        }, 1500);
      }
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const columns: Column<Order>[] = [
    {
      header: 'Order ID',
      accessor: (row) => (
        <span
          onClick={() => setSelectedOrder(row)}
          className="font-bold text-cyan-600 dark:text-cyan-400 font-mono hover:underline cursor-pointer"
        >
          {row.id}
        </span>
      ),
      sortable: true,
    },
    { header: 'Customer', accessor: 'customerName', sortable: true },
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
          <span className="font-mono font-bold text-cyan-500">{row.droneId}</span>
        ) : (
          <span className="text-slate-400 italic">Unassigned</span>
        ),
      sortable: true,
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} size="sm" />,
      sortable: true,
    },
    {
      header: 'Workflow Action',
      accessor: (row) => {
        const s = row.status?.toLowerCase() || '';
        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* Step 1: Pending Dispatch -> Accept */}
            {(s === 'pending_dispatch' || s === 'pending') && (
              <button
                onClick={() => handleStatusTransition(row.id, 'accepted', 'Order accepted at SkyHub Central')}
                className="rounded-lg bg-blue-500/20 border border-blue-500/40 px-2.5 py-1 text-xs font-bold text-blue-400 hover:bg-blue-500/30 transition-colors"
              >
                Accept Order
              </button>
            )}

            {/* Step 2: Accepted -> Packing */}
            {s === 'accepted' && (
              <button
                onClick={() => handleStatusTransition(row.id, 'packing', 'Packaging payload into aerodynamic cargo pod')}
                className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-xs font-bold text-amber-400 hover:bg-amber-500/30 transition-colors"
              >
                Start Packing
              </button>
            )}

            {/* Step 3: Packing -> Packed */}
            {s === 'packing' && (
              <button
                onClick={() => handleStatusTransition(row.id, 'packed', 'Payload pod sealed and weight verified')}
                className="rounded-lg bg-purple-500/20 border border-purple-500/40 px-2.5 py-1 text-xs font-bold text-purple-400 hover:bg-purple-500/30 transition-colors"
              >
                Mark Packed
              </button>
            )}

            {/* Step 4: Packed -> Ready for Dispatch */}
            {s === 'packed' && (
              <button
                onClick={() => handleStatusTransition(row.id, 'ready_for_dispatch', 'Cargo positioned on launchpad bay')}
                className="rounded-lg bg-teal-500/20 border border-teal-500/40 px-2.5 py-1 text-xs font-bold text-teal-400 hover:bg-teal-500/30 transition-colors"
              >
                Ready Dispatch
              </button>
            )}

            {/* Step 5: Ready for Dispatch -> Assign Drone */}
            {(s === 'ready_for_dispatch' || (!row.droneId && (s === 'pending' || s === 'pending_dispatch'))) && (
              <button
                onClick={() => setAssigningOrder(row)}
                className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
              >
                <Bot className="w-3 h-3" /> Assign Drone
              </button>
            )}

            {/* Step 6: Drone Assigned -> Launch Mission */}
            {s === 'drone_assigned' && row.missionId && (
              <button
                onClick={() => handleLaunchMission(row.missionId!)}
                className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
              >
                <Send className="w-3 h-3" /> Launch Mission
              </button>
            )}

            {/* Step 7: In Flight / Arriving -> Live Telemetry */}
            {(s === 'in_flight' || s === 'arriving' || s === 'in_transit') && (
              <button
                onClick={() => navigate('/operations')}
                className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
              >
                <Radio className="w-3 h-3 animate-pulse text-cyan-400" /> Live Ops
              </button>
            )}

            {/* View Details Drawer */}
            <button
              onClick={() => setSelectedOrder(row)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Details
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
            <ShoppingBag className="w-3.5 h-3.5" /> LOGISTICS DISPATCH & ORDER WORKFLOW
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Commercial Orders Lifecycle
          </h1>
          <p className="text-xs text-slate-400">
            Authoritative order processing: Accept → Pack → Ready → Assign Drone → Launch Mission
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => mockStore.fetchOperationalData()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => setIsProductModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500"
          >
            <Plus className="w-3.5 h-3.5" /> Create & Sync Product
          </button>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Active Operational Orders"
        columns={columns}
        data={orders}
        searchPlaceholder="Search Order ID, Customer, Package, Merchant..."
        searchField={(o) => `${o.id} ${o.customerName} ${o.packageName} ${o.merchantName}`}
        onRowClick={(row) => setSelectedOrder(row)}
        filterOptions={[
          {
            label: 'Action Required',
            value: 'action_required',
            filterFn: (o) =>
              ['pending', 'pending_dispatch', 'accepted', 'packing', 'packed', 'ready_for_dispatch', 'drone_assigned'].includes(
                o.status?.toLowerCase() || ''
              ),
          },
          {
            label: 'In Flight',
            value: 'in_flight',
            filterFn: (o) => ['in_flight', 'in_transit', 'arriving'].includes(o.status?.toLowerCase() || ''),
          },
          {
            label: 'Delivered',
            value: 'delivered',
            filterFn: (o) => o.status?.toLowerCase() === 'delivered',
          },
        ]}
      />

      {/* Order Detail Side Drawer */}
      {selectedOrder && (
        <Drawer
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Order Details — #${selectedOrder.id}`}
          subtitle={`Created: ${selectedOrder.createdAt}`}
        >
          <div className="space-y-6 text-xs text-slate-200">
            {/* Current Status Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400 font-mono text-[10px] block">OPERATIONAL STATUS</span>
                  <div className="mt-1">
                    <StatusBadge status={selectedOrder.status} size="lg" />
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-mono text-[10px] block">CUSTOMER CORRELATION ID</span>
                  <span className="font-mono font-bold text-cyan-400 text-xs">{selectedOrder.customerId}</span>
                </div>
              </div>

              {/* Step-by-Step Operator Action Stepper */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[10px] text-slate-400 font-mono uppercase block">Logistics Progression Steps</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleStatusTransition(selectedOrder.id, 'accepted')}
                    disabled={selectedOrder.status !== 'pending_dispatch' && selectedOrder.status !== 'pending'}
                    className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-2 text-left hover:bg-blue-500/20 disabled:opacity-40"
                  >
                    <span className="font-bold text-blue-400 block">1. Accept Order</span>
                    <span className="text-[10px] text-slate-400">Confirm SkyHub intake</span>
                  </button>

                  <button
                    onClick={() => handleStatusTransition(selectedOrder.id, 'packing')}
                    disabled={selectedOrder.status !== 'accepted'}
                    className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2 text-left hover:bg-amber-500/20 disabled:opacity-40"
                  >
                    <span className="font-bold text-amber-400 block">2. Start Packing</span>
                    <span className="text-[10px] text-slate-400">Pod sealing initiated</span>
                  </button>

                  <button
                    onClick={() => handleStatusTransition(selectedOrder.id, 'packed')}
                    disabled={selectedOrder.status !== 'packing'}
                    className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-2 text-left hover:bg-purple-500/20 disabled:opacity-40"
                  >
                    <span className="font-bold text-purple-400 block">3. Mark Packed</span>
                    <span className="text-[10px] text-slate-400">Weight & pod verified</span>
                  </button>

                  <button
                    onClick={() => handleStatusTransition(selectedOrder.id, 'ready_for_dispatch')}
                    disabled={selectedOrder.status !== 'packed'}
                    className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-2 text-left hover:bg-teal-500/20 disabled:opacity-40"
                  >
                    <span className="font-bold text-teal-400 block">4. Ready Dispatch</span>
                    <span className="text-[10px] text-slate-400">Move to launchpad</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      const ord = selectedOrder;
                      setSelectedOrder(null);
                      setAssigningOrder(ord);
                    }}
                    disabled={!!selectedOrder.droneId}
                    className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-2 text-left hover:bg-cyan-500/20 disabled:opacity-40 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-cyan-400 block">5. Assign Drone</span>
                      <span className="text-[10px] text-slate-400">{selectedOrder.droneId ? `Assigned: ${selectedOrder.droneId}` : 'Select best match'}</span>
                    </div>
                    <Bot className="w-4 h-4 text-cyan-400" />
                  </button>

                  <button
                    onClick={() => selectedOrder.missionId && handleLaunchMission(selectedOrder.missionId)}
                    disabled={!selectedOrder.missionId || selectedOrder.status === 'in_flight' || selectedOrder.status === 'delivered'}
                    className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2 text-left hover:bg-emerald-500/20 disabled:opacity-40 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-emerald-400 block">6. Launch Mission</span>
                      <span className="text-[10px] text-slate-400">Start flight telemetry</span>
                    </div>
                    <Send className="w-4 h-4 text-emerald-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Entity Correlation Chain */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Cross-System Correlation Chain</span>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-700 text-cyan-400">
                  Cust: {selectedOrder.customerId}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-700 text-purple-400">
                  Order: {selectedOrder.id}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-700 text-emerald-400">
                  Mission: {selectedOrder.missionId || 'Pending'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-700 text-blue-400">
                  Drone: {selectedOrder.droneId || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Package & Destination Details */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono block">PACKAGE PAYLOAD</span>
                <span className="text-sm font-bold text-slate-100">{selectedOrder.packageName}</span>
                <span className="text-[11px] text-cyan-400 block mt-0.5">Payload Weight: {selectedOrder.packageWeightKg} kg</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-mono block">CUSTOMER DESTINATION</span>
                <span className="font-bold text-slate-100">{selectedOrder.customerName}</span>
                <p className="text-[11px] text-slate-400">{selectedOrder.destinationAddress}</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Coordinates: {selectedOrder.destinationCoords?.lat?.toFixed(5)}, {selectedOrder.destinationCoords?.lng?.toFixed(5)}
                </p>
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
        onAssigned={() => mockStore.fetchOperationalData()}
      />

      {/* Product Creation & Synchronization Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Publish Product (Admin → Customer Catalog Sync)"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateProduct} className="space-y-3 text-xs text-slate-200">
          <p className="text-slate-400 text-[11px]">
            Admin is authoritative for products. Creating or updating here automatically synchronizes to Customer Backend and SQLite.
          </p>

          {productSuccess && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-400 font-semibold">
              ✓ {productSuccess}
            </div>
          )}

          <div>
            <label className="font-bold text-slate-300 block mb-1">Product Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Aero Emergency Trauma Kit Pro"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-300 block mb-1">Category</label>
              <select
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option>Medical & First Aid</option>
                <option>Tech & Electronics</option>
                <option>Gourmet & Dining</option>
                <option>Emergency Supplies</option>
                <option>Laboratory Samples</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-300 block mb-1">Price ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-300 block mb-1">Payload Weight (grams)</label>
              <input
                type="number"
                required
                value={productWeight}
                onChange={(e) => setProductWeight(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-slate-300 block mb-1">Stock Count</label>
              <input
                type="number"
                defaultValue="50"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-300 block mb-1">Description</label>
            <textarea
              rows={2}
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-300 block mb-1">Image URL</label>
            <input
              type="url"
              value={productImage}
              onChange={(e) => setProductImage(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono text-[11px]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(false)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingProduct}
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isCreatingProduct ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
              Publish & Synchronize
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
