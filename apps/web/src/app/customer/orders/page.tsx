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
  PackageIcon,
  SearchIcon,
  PlusIcon
} from "@skynav/ui";
import { DEMO_ORDERS } from "@/lib/demo-data";

export default function CustomerOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredOrders = DEMO_ORDERS.filter((order) => {
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
            Track, inspect manifests, and view proof-of-delivery receipts for your autonomous shipments.
          </p>
        </div>
        <Button variant="primary" size="md" leftIcon={<PlusIcon size={16} />}>
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
                { value: "SUBMITTED", label: "Submitted (Pending)" }
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
    </div>
  );
}
