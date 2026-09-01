"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatINR } from "../../../../features/commerce/cart-context";
import {
  DroneIcon,
  MapPinIcon,
  CheckIcon,
  ZapIcon,
  ArrowLeftIcon,
  AlertTriangleIcon
} from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const PROGRESS_STEPS = [
  { key: "PENDING", label: "Order Placed", desc: "Order registered and queued" },
  { key: "ASSIGNED", label: "Package Preparing", desc: "Warehouse packaging & payload check" },
  { key: "DISPATCHED", label: "Drone Dispatched", desc: "UAV cleared for takeoff" },
  { key: "IN_TRANSIT", label: "In Flight Corridor", desc: "Autonomous transit to landing marker" },
  { key: "DELIVERED", label: "Delivered", desc: "Precision landing touchdown complete" }
];

export default function OrderDetailPage() {
  let params: any = {};
  try {
    params = useParams() || {};
  } catch {}
  const id = params?.id as string;

  const [order, setOrder] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem("skynav_token");
        const res = await fetch(`${API_BASE_URL}/api/v1/orders/${id}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (!res.ok) throw new Error("Order not found");
        const json = await res.json();
        setOrder(json);
      } catch (err: any) {
        setError(err.message || "Failed to load order");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  if (error || (!order && !isLoading)) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="p-4 rounded-full bg-rose-50 text-rose-500 w-16 h-16 mx-auto flex items-center justify-center">
          <AlertTriangleIcon size={32} />
        </div>
        <h2 className="text-xl font-bold">Order Details</h2>
        <p className="text-xs text-slate-500">{error || "Loading flight records..."}</p>
        <Link
          href="/customer/orders"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold"
        >
          <ArrowLeftIcon size={14} /> Back to Orders
        </Link>
      </div>
    );
  }

  const items = order?.items || [];
  const statusIndex = PROGRESS_STEPS.findIndex((s) => s.key === order?.status);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <Link
        href="/customer/orders"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand-600 transition"
      >
        <ArrowLeftIcon size={14} /> Back to Orders List
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
            Order Tracking
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {order?.orderNumber || "ORD-PENDING"}
          </h1>
        </div>
        <Link
          href="/customer/tracking"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-bold shadow-md hover:opacity-90 transition"
        >
          <ZapIcon size={14} /> View Live Radar
        </Link>
      </div>

      {/* Flight Progress Stepper */}
      <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <DroneIcon size={18} className="text-brand-500" />
          <span>Flight Progress Status</span>
        </h3>

        <div className="relative flex flex-col md:flex-row justify-between gap-4">
          {PROGRESS_STEPS.map((step, idx) => {
            const isCompleted = statusIndex >= idx;
            const isCurrent = statusIndex === idx;

            return (
              <div key={step.key} className="flex-1 flex md:flex-col items-center gap-3 text-left md:text-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition shadow-sm ${
                    isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  {isCompleted ? <CheckIcon size={14} /> : idx + 1}
                </div>
                <div>
                  <p className={`text-xs font-bold ${isCurrent ? "text-brand-600 dark:text-brand-400" : "text-slate-900 dark:text-slate-100"}`}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-slate-500 max-w-[140px]">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Details & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Landing Address */}
        <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MapPinIcon size={16} className="text-brand-500" />
            <span>Touchdown Landing Location</span>
          </h3>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{order?.recipientName || "Recipient"}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{order?.destinationAddress || "Designated Landing Zone"}</p>
          <p className="text-xs text-slate-500">Contact: {order?.recipientPhone || "Registered Phone"}</p>
          {order?.destinationLatitude && (
            <p className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
              📍 {order.destinationLatitude.toFixed(4)}°N, {order.destinationLongitude?.toFixed(4)}°E
            </p>
          )}
        </div>

        {/* Invoice Summary */}
        <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Package & Payment</h3>
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Gross Weight</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {order?.package?.weightGrams ? `${(order.package.weightGrams / 1000).toFixed(2)} kg` : "Standard"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Priority</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{order?.priority || "STANDARD"}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-base font-black text-slate-900 dark:text-slate-100">
              <span>Total Paid</span>
              <span className="text-brand-600 dark:text-brand-400">
                {formatINR(order?.package?.declaredValueCents || order?.totalCents || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
