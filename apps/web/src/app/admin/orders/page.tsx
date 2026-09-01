"use client";

import React, { useState } from "react";
import {
  Card,
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

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredOrders = DEMO_ORDERS.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.recipientName.toLowerCase().includes(search.toLowerCase()) ||
      order.deliveryAddress.toLowerCase().includes(search.toLowerCase()) ||
      order.packageDescription.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Delivery Orders Master Board</h2>
          <p className="text-xs text-slate-400 mt-1">
            Review incoming order payloads, assign available fleet drones, and oversee package dispatch.
          </p>
        </div>
        <Button variant="primary" size="md" leftIcon={<PlusIcon size={16} />}>
          Manual Order Ingestion
        </Button>
      </div>

      <Card variant="glass" className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Filter by order code, recipient name, address, or payload description..."
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
                { value: "ALL", label: "All Order Statuses" },
                { value: "SUBMITTED", label: "Submitted / Awaiting Dispatch" },
                { value: "IN_TRANSIT", label: "In Flight (Active)" },
                { value: "DELIVERED", label: "Delivered" },
                { value: "CANCELLED", label: "Cancelled" }
              ]}
            />
          </div>
        </div>
      </Card>

      <Card variant="glass" className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Code</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Delivery Address</TableHead>
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
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-200">{order.recipientName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{order.recipientPhone}</div>
                  </TableCell>
                  <TableCell className="text-slate-300 max-w-xs truncate">
                    {order.deliveryAddress}
                  </TableCell>
                  <TableCell className="font-mono text-slate-300">
                    {order.weightKg.toFixed(1)} kg
                  </TableCell>
                  <TableCell className="font-mono">
                    {order.assignedDroneCallsign ? (
                      <span className="text-cyan-400 font-bold">{order.assignedDroneCallsign}</span>
                    ) : (
                      <span className="text-amber-400 font-semibold">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    {order.status === "SUBMITTED" ? (
                      <Button variant="primary" size="sm">
                        Dispatch UAV →
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm">
                        Inspect
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  No orders matched your search criteria.
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
