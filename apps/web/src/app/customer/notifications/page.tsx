"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../features/auth/auth-context";
import {
  BellIcon,
  CheckCircleIcon,
  ZapIcon,
  AlertTriangleIcon,
  PackageIcon,
  CheckIcon
} from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CustomerNotificationsPage() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
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
  }, [token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllAsRead = async () => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Delivery Notifications</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time flight status and drone drop alerts
          </p>
        </div>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
          >
            <CheckIcon size={14} /> Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
            <BellIcon size={32} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Notifications</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            You are all caught up! Updates regarding your orders will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-2xl border transition flex items-start gap-4 ${
                n.isRead
                  ? "bg-surface-card dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-80"
                  : "bg-brand-50/50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-800"
              }`}
            >
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <PackageIcon size={18} />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{n.title}</h4>
                  <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
