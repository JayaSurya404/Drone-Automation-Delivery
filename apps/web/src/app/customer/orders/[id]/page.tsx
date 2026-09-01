"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "../../../../features/auth/auth-context";
import {
  ChevronLeftIcon,
  DroneIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  ZapIcon,
  ShieldIcon,
  PackageIcon
} from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const TIMELINE_STEPS = [
  { status: "CREATED", label: "Order Placed", desc: "Autonomous flight route calculated" },
  { status: "CONFIRMED", label: "Order Confirmed", desc: "Hub staff secured package payload" },
  { status: "ASSIGNED", label: "Drone Dispatched", desc: "SkyNav Hexacopter calibrated & armed" },
  { status: "IN_TRANSIT", label: "In Flight Corridor", desc: "Cruising at 80m altitude" },
  { status: "DELIVERING", label: "Arriving at Landing Pad", desc: "Descending with precision tether" },
  { status: "DELIVERED", label: "Safe Drop Completed", desc: "Package released on landing zone" }
];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  const { token } = useAuth();

  const [order, setOrder] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrder() {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setOrder(json.data);
        } else {
          setError("Order not found or access unauthorized.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load order details.");
      } finally {
        setIsLoading(false);
      }
    }
    loadOrder();
  }, [orderId, token]);

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-sm font-semibold text-rose-500">{error || "Order not found"}</p>
        <Link href="/customer/orders" className="mt-4 inline-block px-4 py-2 text-xs font-semibold text-white bg-brand-600 rounded-xl">
          Back to Orders
        </Link>
      </div>
    );
  }

  const getStepIndex = (status: string) => {
    switch (status) {
      case "CREATED":
      case "SUBMITTED":
        return 0;
      case "CONFIRMED":
        return 1;
      case "ASSIGNED":
        return 2;
      case "IN_TRANSIT":
        return 3;
      case "DELIVERING":
        return 4;
      case "DELIVERED":
        return 5;
      default:
        return 0;
    }
  };

  const currentStep = getStepIndex(order.status);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/customer/orders" className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600">
          <ChevronLeftIcon size={14} /> Back to Orders
        </Link>
        {["CONFIRMED", "ASSIGNED", "IN_TRANSIT", "DELIVERING"].includes(order.status) && (
          <Link
            href={`/customer/tracking?orderId=${order.id}`}
            className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow flex items-center gap-1.5 transition"
          >
            <ZapIcon size={14} /> Track Live Radar
          </Link>
        )}
      </div>

      <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-xs font-medium text-slate-400">Order Reference</span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {order.orderNumber}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Placed on {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-medium text-slate-400">Delivery Status</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                {order.status.replace("_", " ")}
              </span>
            </div>
          </div>
        </div>

        {/* 6-Step Delivery Progression Timeline */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Autonomous Flight Progression
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {TIMELINE_STEPS.map((step, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              const isFuture = idx > currentStep;

              return (
                <div
                  key={step.status}
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-2 transition ${
                    isCurrent
                      ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-md shadow-brand-500/10"
                      : isPast
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : "border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold">{idx + 1}</span>
                    {isPast ? (
                      <CheckCircleIcon size={16} className="text-emerald-500" />
                    ) : isCurrent ? (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-brand-500 animate-pulse" />
                    ) : (
                      <ClockIcon size={14} className="text-slate-300 dark:text-slate-700" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-tight">{step.label}</h4>
                    <p className="text-[10px] opacity-80 line-clamp-2 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Details & Delivery Map Coordinates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Landing Zone Coordinates</h3>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{order.delivery?.address}</p>
              <p className="font-mono text-brand-600 dark:text-brand-400 flex items-center gap-1">
                <MapPinIcon size={12} /> {Number(order.delivery?.latitude || 0).toFixed(4)}°N, {Number(order.delivery?.longitude || 0).toFixed(4)}°W
              </p>
              {order.deliveryNotes && (
                <p className="text-slate-500 italic mt-2">Instructions: &quot;{order.deliveryNotes}&quot;</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Flight Payload Summary</h3>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total Weight:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{order.package?.weightGrams} grams</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Dispatch Priority:</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">{order.priority}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Airspace Safety Gate:</span>
                <span className="font-bold text-emerald-500">Autonomous Cleared</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items Table */}
        {order.items && order.items.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordered Products</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {order.items.map((item: any) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-800" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{item.productName}</p>
                      <p className="text-[11px] text-slate-400">Qty: {item.quantity} • ${((item.unitPriceCents || 0) / 100).toFixed(2)} ea</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    ${(((item.unitPriceCents || 0) * (item.quantity || 1)) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
