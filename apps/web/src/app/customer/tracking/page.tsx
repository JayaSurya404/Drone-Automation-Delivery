"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../../features/auth/auth-context";
import {
  DroneIcon,
  MapPinIcon,
  ZapIcon,
  ShieldIcon,
  ClockIcon,
  CompassIcon,
  CheckCircleIcon,
  WarehouseIcon
} from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CustomerTrackingPage() {
  let orderIdParam: string | null = null;
  try {
    const searchParams = useSearchParams();
    orderIdParam = searchParams.get("orderId");
  } catch {}
  const { token } = useAuth();

  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchActiveOrders = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/orders?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const allOrders: any[] = json.data || [];
        const inFlight = allOrders.filter((o) =>
          ["CONFIRMED", "ASSIGNED", "IN_TRANSIT", "DELIVERING", "SUBMITTED"].includes(o.status)
        );
        setActiveOrders(inFlight);

        if (inFlight.length > 0) {
          if (orderIdParam) {
            const match = inFlight.find((o) => o.id === orderIdParam);
            setSelectedOrder(match || inFlight[0]);
          } else {
            setSelectedOrder(inFlight[0]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load tracking data", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, orderIdParam]);

  useEffect(() => {
    fetchActiveOrders();
  }, [fetchActiveOrders]);

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!selectedOrder) {
    return (
      <div className="text-center py-20 bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm animate-in fade-in duration-300">
        <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
          <DroneIcon size={40} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">No Deliveries Currently In Flight</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2">
          When you place an order, live drone telemetry, flight corridor navigation, and arrival countdowns will appear here.
        </p>
        <Link
          href="/customer"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-2xl shadow-lg shadow-brand-500/25 transition"
        >
          <span>Order Now</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Live Delivery Radar</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Autonomous high-altitude drone tracking to your designated landing pad
          </p>
        </div>

        {/* Multi-Order Selector */}
        {activeOrders.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Select Active Order:</span>
            <select
              value={selectedOrder.id}
              onChange={(e) => {
                const found = activeOrders.find((o) => o.id === e.target.value);
                if (found) setSelectedOrder(found);
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
              {activeOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} ({o.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Radar Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Map View */}
        <div className="lg:col-span-2 relative aspect-[16/10] sm:aspect-[16/9] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl p-6 flex flex-col justify-between text-white">
          {/* Background Grid & Radar Sweep */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-brand-500/10 pointer-events-none" />

          {/* Top Radar HUD Bar */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 text-xs font-semibold text-cyan-400">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span>RADAR LIVE • CORRIDOR #04</span>
            </div>
            <span className="text-xs font-mono text-slate-400">ORDER: {selectedOrder.orderNumber}</span>
          </div>

          {/* Flight Path Graphic */}
          <div className="relative z-10 my-auto flex items-center justify-between px-6 sm:px-12">
            {/* Origin Hub */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-cyan-400 shadow-lg">
                <WarehouseIcon size={24} />
              </div>
              <span className="text-[11px] font-bold text-slate-300">Launch Hub</span>
            </div>

            {/* In-Transit Drone Marker */}
            <div className="flex-1 mx-6 relative flex items-center">
              <div className="w-full h-1 bg-gradient-to-r from-cyan-500 via-brand-500 to-emerald-500 rounded-full opacity-60" />
              <div className="absolute left-1/2 -translate-x-1/2 -top-4 p-2.5 rounded-full bg-brand-600 text-white shadow-xl shadow-brand-500/50 animate-bounce">
                <DroneIcon size={22} />
              </div>
            </div>

            {/* Destination Landing Pad */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 shadow-lg">
                <MapPinIcon size={24} />
              </div>
              <span className="text-[11px] font-bold text-slate-300">Your Landing Pad</span>
            </div>
          </div>

          {/* Bottom Telemetry Overlay */}
          <div className="relative z-10 grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-center">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-medium">Estimated Drop</p>
              <p className="text-sm font-black text-amber-400 font-mono">⚡ 8 mins</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-medium">Remaining Distance</p>
              <p className="text-sm font-black text-cyan-400 font-mono">1.8 km</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-medium">Air Corridor Status</p>
              <p className="text-sm font-black text-emerald-400">Clear & Safe</p>
            </div>
          </div>
        </div>

        {/* Right Details Panel */}
        <div className="space-y-4">
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Package & Landing Info</h3>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedOrder.delivery?.address}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cargo Weight:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedOrder.package?.weightGrams}g</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Flight Gate:</span>
                <span className="font-bold text-emerald-500">Autonomous Active</span>
              </div>
            </div>

            {/* Landing Safety Tips */}
            <div className="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/20 text-xs space-y-2">
              <p className="font-bold text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
                <ShieldIcon size={16} /> Safe Drone Delivery Tips
              </p>
              <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 list-disc pl-4">
                <li>Keep landing zone clear of pets and obstacles.</li>
                <li>Drone will hover at 3m and gently lower package with tether.</li>
                <li>Audio chime will sound before release.</li>
              </ul>
            </div>

            <Link
              href={`/customer/orders/${selectedOrder.id}`}
              className="w-full py-3 text-center block rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
            >
              View Full Order Invoice
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
