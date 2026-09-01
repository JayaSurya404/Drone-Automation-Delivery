"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  DroneIcon,
  RadarIcon,
  PackageIcon,
  MapPinIcon,
  ShieldIcon
} from "@skynav/ui";
import type { OrderResponse } from "@skynav/contracts";

export default function CustomerTrackingPage() {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActive() {
      setLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("skynav_token") : null;
        const res = await fetch("/api/v1/orders", {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const json = await res.json();
          const active = (json.data || []).filter((o: OrderResponse) =>
            ["CREATED", "CONFIRMED", "ASSIGNED", "IN_TRANSIT"].includes(o.status)
          );
          setOrders(active);
        }
      } catch (err) {
        console.error("Failed to load tracking orders:", err);
      } finally {
        setLoading(false);
      }
    }
    loadActive();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Live Drone Delivery Radar
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Real-time telemetry and destination ETA for active deliveries.
        </p>
      </div>

      {loading ? (
        <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-cyan-400 mx-auto">
            <RadarIcon size={28} />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            No Deliveries Currently In Flight
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            You do not have any active drone deliveries in transit. Place a delivery request to watch live radar telemetry and arrival telemetry.
          </p>
          <Link
            href="/customer/orders"
            className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            View Orders / Request Delivery
          </Link>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-white p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 animate-pulse">
                <DroneIcon size={24} />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                  IN TRANSIT • {orders[0].status}
                </span>
                <h2 className="text-base font-bold text-white mt-1">Drone En Route to Drop Pad</h2>
                <p className="text-xs text-slate-400 mt-0.5">Destination: {orders[0].delivery.address || "Landing Pad"}</p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] font-mono uppercase text-slate-400">Estimated Arrival</span>
              <p className="text-xl font-bold font-mono text-cyan-400">~ 12 MINS</p>
            </div>
          </div>

          <div className="py-6 flex items-center justify-between px-6 sm:px-12 relative text-xs font-mono">
            <div className="flex flex-col items-center gap-2 z-10">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                DEP
              </div>
              <span className="text-slate-400">Depot</span>
            </div>

            <div className="absolute left-16 right-16 top-1/2 -translate-y-1/2 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 animate-pulse" />
            </div>

            <div className="flex flex-col items-center gap-1 z-10">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/40">
                <DroneIcon size={20} />
              </div>
              <span className="text-[10px] text-cyan-300 font-bold">In Flight</span>
            </div>

            <div className="flex flex-col items-center gap-2 z-10">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                PAD
              </div>
              <span className="text-slate-400">Destination</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-3 border-t border-slate-800">
            <span className="flex items-center gap-1.5">
              <ShieldIcon size={14} className="text-emerald-400" />
              Autonomous corridor active
            </span>
            <span>Payload: {orders[0].package.weightGrams}g</span>
          </div>
        </div>
      )}
    </div>
  );
}
