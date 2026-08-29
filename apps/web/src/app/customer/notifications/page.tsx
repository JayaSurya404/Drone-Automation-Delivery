"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Tabs,
  Badge,
  BellIcon,
  CheckCircleIcon,
  ChevronRightIcon
} from "@skynav/ui";
import { DEMO_NOTIFICATIONS } from "@/lib/demo-data";

export default function CustomerNotificationsPage() {
  const [activeTab, setActiveTab] = useState("ALL");
  const [notifications, setNotifications] = useState(DEMO_NOTIFICATIONS);

  const filtered = notifications.filter(
    (n) => activeTab === "ALL" || n.category === activeTab
  );

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const tabs = [
    { id: "ALL", label: "All Activity", count: notifications.length },
    { id: "DELIVERY", label: "Deliveries", count: notifications.filter((n) => n.category === "DELIVERY").length },
    { id: "SYSTEM", label: "System", count: notifications.filter((n) => n.category === "SYSTEM").length }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Notifications & Dispatch Updates</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time flight alerts, touchdown verifications, and account security notifications.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead}>
          Mark All as Read
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <Card variant="glass" className="divide-y divide-slate-800/60 p-0 overflow-hidden">
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-5 flex items-start justify-between gap-4 transition-colors ${
                item.read ? "bg-slate-900/30 hover:bg-slate-800/20" : "bg-blue-950/20 hover:bg-blue-950/30"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-2.5 rounded-xl border mt-0.5 ${
                    item.read
                      ? "bg-slate-800 text-slate-400 border-slate-700"
                      : "bg-blue-600/20 text-cyan-400 border-cyan-500/30"
                  }`}
                >
                  <BellIcon size={18} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                    {!item.read && <Badge variant="primary" size="sm">New</Badge>}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-xl">{item.message}</p>
                  <span className="text-[10px] font-mono text-slate-400 block pt-1">{item.timestamp}</span>
                </div>
              </div>

              {item.link && (
                <Link href={item.link}>
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
