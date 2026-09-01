"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "../../../features/commerce/cart-context";
import { DroneIcon, ArrowRightIcon, ZapIcon } from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem("skynav_token");
        const res = await fetch(`${API_BASE_URL}/api/v1/orders`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (!res.ok) throw new Error("Failed to load orders");
        const json = await res.json();
        setOrders(json.data || []);
      } catch (err: any) {
        setError(err.message || "Failed to load order history");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            My Drone AirDrop Orders
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track flight progress, delivery invoices & touchdown status
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="py-16 text-center bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <DroneIcon size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Orders Placed Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Order your first grocery or daily essential package to experience 15-minute drone air drop.
          </p>
          <Link
            href="/customer"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md transition"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusColor =
              order.status === "DELIVERED"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : order.status === "CANCELLED" || order.status === "FAILED"
                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                : "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border-brand-200 dark:border-brand-800";

            return (
              <div
                key={order.id}
                className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order</span>
                    <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                      {order.orderNumber}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${statusColor}`}>
                      {order.status.replace(/_/g, " ")}
                    </span>
                    <Link
                      href={`/customer/orders/${order.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Track Flight <ArrowRightIcon size={14} />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Touchdown Pad</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{order.destinationAddress || "Landing Zone"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Package Weight</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {order.package?.weightGrams ? `${(order.package.weightGrams / 1000).toFixed(2)} kg` : "Standard Box"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Amount</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {formatINR(order.package?.declaredValueCents || order.totalCents || 0)}
                    </p>
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
