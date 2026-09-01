"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BellIcon, CheckIcon, ArrowLeftIcon } from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const token = localStorage.getItem("skynav_token");
        const res = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        if (res.ok) {
          const json = await res.json();
          setNotifications(json.data || []);
        }
      } catch (err) {
        console.error("Failed to load notifications", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotifs();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <Link
        href="/customer"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand-600 transition"
      >
        <ArrowLeftIcon size={14} /> Back to Store
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Notifications
        </h1>
        <p className="text-xs text-slate-500">Order updates and delivery alerts</p>
      </div>

      {notifications.length === 0 ? (
        <div className="py-16 text-center bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <BellIcon size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No New Notifications</h3>
          <p className="text-xs text-slate-500">You will receive live flight and delivery alerts here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-4 rounded-2xl bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{n.title}</h4>
                <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
