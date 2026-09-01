"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  DroneIcon,
  PackageIcon,
  RadarIcon,
  ChevronRightIcon,
  ClockIcon,
  ShieldIcon
} from "@skynav/ui";
import { useAuth } from "@/features/auth/auth-context";
import type { OrderResponse } from "@skynav/contracts";

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      setIsLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("skynav_token") : null;
        if (!token) {
          setIsLoading(false);
          return;
        }

        const res = await fetch("/api/v1/orders", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          }
        });

        if (res.ok) {
          const json = await res.json();
          setOrders(json.data || []);
        }
      } catch (err) {
        console.error("Failed to load customer orders:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadOrders();
  }, []);

  const activeOrders = orders.filter((o) =>
    ["CREATED", "CONFIRMED", "ASSIGNED", "IN_TRANSIT"].includes(o.status)
  );
  const activeOrder = activeOrders[0] || null;
  const recentOrders = orders.slice(0, 3);

  const displayName = user?.name || "Customer";

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Welcome Banner */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-900/20 via-slate-900/60 to-cyan-950/20 p-6 sm:p-8 backdrop-blur-xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {`Welcome, ${displayName} 👋`}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Manage your autonomous aerial deliveries and monitor in-flight drop operations.
            </p>
          </div>

          <Link
            href="/customer/orders"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all self-start sm:self-auto"
          >
            <PackageIcon size={16} />
            <span>New Delivery Request</span>
          </Link>
        </div>
      </div>

      {/* Active In-Flight Delivery Banner or Empty State */}
      {isLoading ? (
        <div className="h-44 rounded-3xl bg-slate-200 dark:bg-slate-800/60 animate-pulse" />
      ) : activeOrder ? (
        <Card variant="glass" className="border-cyan-500/30">
          <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                  Active Mission In Progress
                </span>
              </div>
              <span className="text-xs font-mono text-slate-500">Order #{activeOrder.orderNumber}</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center border border-cyan-500/20">
                  <DroneIcon size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeOrder.package.description || `${activeOrder.package.weightGrams}g Autonomous Delivery`}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Destination: {activeOrder.delivery.address || "Designated Landing Pad"}
                  </p>
                </div>
              </div>

              <Link
                href="/customer/tracking"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-sm transition-all"
              >
                <RadarIcon size={16} />
                <span>Track Live Radar</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <DroneIcon size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Active Deliveries in Flight</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            You do not currently have any drones dispatched. Create a new delivery order to begin live telemetry and aerial tracking.
          </p>
        </div>
      )}

      {/* Account Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="glass">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
              <PackageIcon size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Orders</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                {orders.length}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DroneIcon size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Active In Transit</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                {activeOrders.length}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <ShieldIcon size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Completed Drops</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                {orders.filter((o) => o.status === "DELIVERED").length}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Deliveries List */}
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Your account-scoped dispatch history</CardDescription>
          </div>
          <Link
            href="/customer/orders"
            className="text-xs text-blue-600 dark:text-cyan-400 hover:underline font-medium"
          >
            View All ({orders.length}) →
          </Link>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2 py-4">
              <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">
              No orders found for this account. Your placed orders will be listed here.
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <PackageIcon size={18} className="text-cyan-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          #{order.orderNumber}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-cyan-400 border border-blue-500/20">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {order.delivery.address || "Rooftop / Yard Landing Zone"}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/customer/orders/${order.id}`}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <ChevronRightIcon size={16} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
