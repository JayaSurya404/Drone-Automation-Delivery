"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../../features/auth/auth-context";
import {
  PackageIcon,
  DroneIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronRightIcon,
  ZapIcon,
  AlertTriangleIcon
} from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CustomerOrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/orders?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data || []);
      } else {
        setError("Failed to fetch order history.");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading orders.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Your Delivery Orders</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Track autonomous drone deliveries and review past orders
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-xs text-rose-600">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <PackageIcon size={40} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">No Orders Placed Yet</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2">
            When you order groceries, snacks, or medical supplies, your real-time drone flight dispatch will appear here.
          </p>
          <Link
            href="/customer"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-2xl shadow-lg shadow-brand-500/25 transition"
          >
            <span>Start Shopping</span>
            <ChevronRightIcon size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });

            const isActiveDelivery = ["CONFIRMED", "ASSIGNED", "IN_TRANSIT", "SUBMITTED"].includes(order.status);

            return (
              <div
                key={order.id}
                className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-3xl p-5 sm:p-6 shadow-sm transition space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <DroneIcon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">{order.orderNumber}</p>
                      <p className="text-[11px] text-slate-400">{formattedDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        order.status === "DELIVERED"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : isActiveDelivery
                          ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 animate-pulse"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {order.status === "DELIVERED" ? (
                        <CheckCircleIcon size={14} />
                      ) : isActiveDelivery ? (
                        <ZapIcon size={14} />
                      ) : (
                        <ClockIcon size={14} />
                      )}
                      <span>{order.status.replace("_", " ")}</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">Destination Landing Pad:</p>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {order.delivery?.address || "Designated Landing Zone"}
                    </p>
                    {order.package?.description && (
                      <p className="text-xs text-slate-500 line-clamp-1 max-w-md">
                        Items: {order.package.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {isActiveDelivery && (
                      <Link
                        href={`/customer/tracking?orderId=${order.id}`}
                        className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl shadow flex items-center gap-1.5 transition"
                      >
                        <ZapIcon size={14} />
                        <span>Track Live Delivery</span>
                      </Link>
                    )}
                    <Link
                      href={`/customer/orders/${order.id}`}
                      className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
