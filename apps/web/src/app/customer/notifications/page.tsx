"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Card,
  Button,
  Tabs,
  Badge,
  BellIcon,
  ChevronRightIcon
} from "@skynav/ui";
import { DEMO_NOTIFICATIONS } from "@/lib/demo-data";
import { useRealtimeNotifications } from "@/lib/notifications";
import type { NotificationResponse } from "@skynav/contracts";

export default function CustomerNotificationsPage() {
  const [activeTab, setActiveTab] = useState("ALL");

  // Initial seed from demo data formatted as NotificationResponse
  const initialItems: NotificationResponse[] = DEMO_NOTIFICATIONS.map((n) => ({
    id: n.id,
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    userId: "11111111-1111-1111-1111-111111111111",
    type: (n.category === "DELIVERY" ? "DELIVERY_UPDATE" : "SYSTEM") as any,
    severity: "INFO" as const,
    title: n.title,
    message: n.message,
    isRead: n.read,
    readAt: n.read ? n.timestamp : null,
    createdAt: n.timestamp,
    metadata: { link: n.link }
  }));

  const {
    notifications,
    unreadCount,
    isConnected,
    markReadLocal,
    markAllReadLocal
  } = useRealtimeNotifications({
    channel: "notifications:user",
    initialNotifications: initialItems
  });

  const filtered = notifications.filter((n) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "DELIVERY") return n.type === "DELIVERY_UPDATE" || n.type === "ORDER_UPDATE";
    if (activeTab === "SYSTEM") return n.type === "SYSTEM" || n.type === "DRONE_UPDATE" || n.type === "EMERGENCY";
    return true;
  });

  const tabs = [
    { id: "ALL", label: "All Activity", count: notifications.length },
    {
      id: "DELIVERY",
      label: "Deliveries",
      count: notifications.filter((n) => n.type === "DELIVERY_UPDATE" || n.type === "ORDER_UPDATE").length
    },
    {
      id: "SYSTEM",
      label: "System",
      count: notifications.filter((n) => n.type === "SYSTEM" || n.type === "DRONE_UPDATE" || n.type === "EMERGENCY").length
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white tracking-tight">Notifications & Dispatch Updates</h2>
            {isConnected && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
            {unreadCount > 0 && (
              <Badge variant="primary" size="sm">
                {unreadCount} Unread
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time flight alerts, touchdown verifications, and account security notifications.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllReadLocal}>
          Mark All as Read
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <Card variant="glass" className="divide-y divide-slate-800/60 p-0 overflow-hidden">
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => markReadLocal(item.id)}
              className={`p-5 flex items-start justify-between gap-4 transition-colors cursor-pointer ${
                item.isRead ? "bg-slate-900/30 hover:bg-slate-800/20" : "bg-blue-950/20 hover:bg-blue-950/30"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-2.5 rounded-xl border mt-0.5 ${
                    item.isRead
                      ? "bg-slate-800 text-slate-400 border-slate-700"
                      : "bg-blue-600/20 text-cyan-400 border-cyan-500/30"
                  }`}
                >
                  <BellIcon size={18} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                    {!item.isRead && <Badge variant="primary" size="sm">New</Badge>}
                    {item.severity === "CRITICAL" && <Badge variant="danger" size="sm">Critical</Badge>}
                    {item.severity === "WARNING" && <Badge variant="warning" size="sm">Warning</Badge>}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-xl">{item.message}</p>
                  <span className="text-[10px] font-mono text-slate-400 block pt-1">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {(item.metadata as any)?.link && (
                <Link href={(item.metadata as any).link}>
                  <Button variant="ghost" size="sm" rightIcon={<ChevronRightIcon size={14} />}>
                    View
                  </Button>
                </Link>
              )}
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">
            No notifications found in this category.
          </div>
        )}
      </Card>
    </div>
  );
}
