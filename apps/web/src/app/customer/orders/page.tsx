"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  OrderStatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
  Modal,
  PackageIcon,
  SearchIcon,
  PlusIcon
} from "@skynav/ui";
import { DEMO_ORDERS, type DemoOrder } from "@/lib/demo-data";

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<DemoOrder[]>(DEMO_ORDERS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New Order Form State
  const [packageDescription, setPackageDescription] = useState("");
  const [weightKg, setWeightKg] = useState("1.5");
  const [deliveryAddress, setDeliveryAddress] = useState("500 Howard St, San Francisco, CA");
  const [deliveryLat, setDeliveryLat] = useState("37.7892");
  const [deliveryLon, setDeliveryLon] = useState("-122.3972");
  const [recipientName, setRecipientName] = useState("John Customer");
  const [recipientPhone, setRecipientPhone] = useState("+1 (555) 019-2834");
  const [priority, setPriority] = useState<"STANDARD" | "HIGH" | "EXPRESS">("STANDARD");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: DemoOrder = {
      id: `ord-${Date.now()}`,
      orderNumber,
      recipientName: recipientName || "Active Customer",
      recipientPhone: recipientPhone || "+1 (555) 000-0000",
      deliveryAddress: deliveryAddress || "San Francisco Airspace Sector 4",
      packageDescription: packageDescription || "Autonomous Parcel",
      weightKg: parseFloat(weightKg) || 1.5,
      status: "IN_TRANSIT",
      assignedDroneId: "00000000-0000-0000-0000-000000000011",
      assignedDroneCallsign: "SKY-001",
      createdAt: new Date().toISOString(),
      etaTime: "12 mins",
      proofOfDeliveryCode: `${Math.floor(1000 + Math.random() * 9000)}`
    };

    setTimeout(() => {
      setOrders([newOrder, ...orders]);
      setIsSubmitting(false);
      setIsCreateOpen(false);
      // Reset form
      setPackageDescription("");
    }, 400);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.packageDescription.toLowerCase().includes(search.toLowerCase()) ||
      order.deliveryAddress.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Title and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">My Aerial Delivery Orders</h2>
          <p className="text-xs text-slate-400 mt-1">
            Track, inspect manifests, and dispatch autonomous drone shipments in real time.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<PlusIcon size={16} />}
          onClick={() => setIsCreateOpen(true)}
        >
          New Drone Delivery
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card variant="glass" className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search by order ID, package description, or address..."
              leftIcon={<SearchIcon size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "ALL", label: "All Statuses" },
                { value: "IN_TRANSIT", label: "In Flight (Active)" },
                { value: "DELIVERED", label: "Delivered" },
                { value: "CONFIRMED", label: "Confirmed" },
                { value: "CREATED", label: "Submitted (Pending)" }
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card variant="glass" className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Package Info</TableHead>
              <TableHead>Delivery Destination</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Assigned UAV</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-bold text-cyan-300">
                    <Link href={`/customer/orders/${order.id}`} className="hover:underline">
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium text-slate-200">
                    {order.packageDescription}
                  </TableCell>
                  <TableCell className="text-slate-300 max-w-xs truncate">
                    {order.deliveryAddress}
                  </TableCell>
                  <TableCell className="font-mono text-slate-300">
                    {order.weightKg.toFixed(1)} kg
                  </TableCell>
                  <TableCell className="font-mono text-slate-300">
                    {order.assignedDroneCallsign ? (
                      <span className="text-cyan-400 font-semibold">{order.assignedDroneCallsign}</span>
                    ) : (
                      <span className="text-slate-500">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/customer/orders/${order.id}`}>
                      <Button variant="ghost" size="sm">
                        Track & View →
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  No delivery orders matched your search criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Pagination
          currentPage={1}
          totalPages={1}
          totalItems={filteredOrders.length}
          pageSize={10}
          onPageChange={() => {}}
        />
      </Card>

      {/* New Drone Delivery Creation Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Schedule Autonomous UAV Delivery"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Package Manifest & Contents
            </label>
            <Input
              required
              placeholder="e.g. Critical Medical Cooler, Emergency Diagnostic Kit"
              value={packageDescription}
              onChange={(e) => setPackageDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payload Weight (kg)
              </label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="10.0"
                required
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Flight Priority
              </label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                options={[
                  { value: "STANDARD", label: "Standard (Scheduled)" },
                  { value: "HIGH", label: "High Priority" },
                  { value: "EXPRESS", label: "Express Tactical" }
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Delivery Destination Dropzone Address
            </label>
            <Input
              required
              placeholder="Landing Pad Street Address"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Recipient Name
              </label>
              <Input
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Recipient Phone
              </label>
              <Input
                required
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-950/40 border border-cyan-500/20 text-xs text-slate-300">
            <span className="text-cyan-400 font-semibold">Autonomous Dispatch:</span> Upon creation, the optimal drone from Depot Alpha will be assigned, flight corridors validated against active geofences, and live takeoff initiated.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Dispatching UAV..." : "Confirm & Launch Mission"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
