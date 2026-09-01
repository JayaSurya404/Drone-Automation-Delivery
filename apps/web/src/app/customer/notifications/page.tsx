"use client";

import React, { useState, useEffect } from "react";
import {
  BellIcon,
  PackageIcon,
  CheckCircleIcon
} from "@skynav/ui";

export default function CustomerNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotifs() {
      setLoading(true);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("skynav_token") : null;
        const res = await fetch("/api/v1/notifications", {
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
        console.error("Failed to load notifications:", err);
      } finally {
        setLoading(false);
      }
    }
    loadNotifs();
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Notifications
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Flight status, dispatch alerts, and delivery confirmations.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3 py-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <BellIcon size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Notifications</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            You're all caught up! When you place orders or missions are dispatched, flight alerts will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 flex items-start gap-3.5 text-xs shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                <BellIcon size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{n.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(n.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
