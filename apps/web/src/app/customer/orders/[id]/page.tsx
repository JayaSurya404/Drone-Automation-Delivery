"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  DroneIcon,
  PackageIcon,
  RadarIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ShieldIcon
} from "@skynav/ui";
import type { OrderResponse } from "@skynav/contracts";

export default function CustomerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      if (!orderId) return;
      setLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("skynav_token") : null;
        const res = await fetch(`/api/v1/orders/${orderId}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const json = await res.json();
          setOrder(json.data);
        }
      } catch (err) {
        console.error("Failed to load order:", err);
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 animate-pulse space-y-4">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-500 flex items-center justify-center mx-auto">
          <PackageIcon size={24} />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Order Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The requested order does not exist or does not belong to your authenticated account.
        </p>
        <Link
          href="/customer/orders"
          className="inline-block px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
        >
          Back to Orders
        </Link>
      </div>
    );
  }

  const isActive = ["CREATED", "CONFIRMED", "ASSIGNED", "IN_TRANSIT"].includes(order.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
        <Link href="/customer/orders" className="hover:text-blue-600 dark:hover:text-cyan-400">
          Orders
        </Link>
        <ChevronRightIcon size={12} />
        <span className="text-slate-800 dark:text-slate-200">#{order.orderNumber}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              Order #{order.orderNumber}
            </h1>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
              {order.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Placed on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>

        {isActive && (
          <Link
            href="/customer/tracking"
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-sm flex items-center gap-2 self-start sm:self-auto"
          >
            <RadarIcon size={16} />
            <span>Track Flight Radar</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Package Specs */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Package & Payload Manifest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Description:</span>
              <span className="text-slate-900 dark:text-white font-bold">{order.package.description || "N/A"}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Payload Mass:</span>
              <span className="text-slate-900 dark:text-white">{order.package.weightGrams} grams</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Priority Level:</span>
              <span className="text-cyan-500 font-bold">{order.priority}</span>
            </div>
          </CardContent>
        </Card>

        {/* Drop Destination */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Landing Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Delivery Address:</span>
              <p className="text-slate-500 mt-0.5">{order.delivery.address || "Rooftop / Yard Landing Pad"}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Target Coordinates:</span>
              <p className="text-slate-500 font-mono mt-0.5">
                {order.delivery.latitude.toFixed(4)}° N, {order.delivery.longitude.toFixed(4)}° W
              </p>
            </div>
            {order.deliveryNotes && (
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Drop Instructions:</span>
                <p className="text-slate-500 mt-0.5">{order.deliveryNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
