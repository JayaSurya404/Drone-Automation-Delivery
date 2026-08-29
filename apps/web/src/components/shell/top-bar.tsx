"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BellIcon,
  SearchIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  SettingsIcon,
  SignalIcon,
  CloseIcon
} from "@skynav/ui";
import { DEMO_NOTIFICATIONS } from "@/lib/demo-data";

export function TopBar({
  role = "admin",
  title
}: {
  role?: "customer" | "admin";
  title?: string;
}) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showNotifications, setShowNotifications] = useState(false);
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toUTCString().slice(17, 25) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", nextTheme);
    }
  };

  const unreadCount = DEMO_NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <header className="h-16 px-6 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Page Title & Breadcrumb Area */}
      <div className="flex items-center gap-3">
        {title && <h1 className="text-base font-semibold text-slate-100 tracking-tight">{title}</h1>}
      </div>

      {/* Center Tactical Clock & System Health */}
      <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-semibold">{timeStr || "10:30:00 UTC"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <SignalIcon size={14} className="text-emerald-400" />
          <span>UAV GATEWAY LINKED</span>
        </div>
      </div>

      {/* Right Actions (Search, Notifications, Theme, Profile) */}
      <div className="flex items-center gap-2">
        {/* Quick Search */}
        <div className="relative hidden sm:block">
          <SearchIcon size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Quick search (orders, drones, missions)..."
            className="w-56 lg:w-72 bg-slate-900/80 text-slate-200 placeholder-slate-500 text-xs rounded-lg pl-8 pr-3 py-2 border border-slate-800 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
          aria-label="Toggle dark/light theme"
        >
          {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>

        {/* Notifications Popover Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors relative"
            aria-label="Notifications"
          >
            <BellIcon size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl shadow-black/90 p-4 z-50 animate-scale-up">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Notifications ({unreadCount} unread)
                </span>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <CloseIcon size={14} />
                </button>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {DEMO_NOTIFICATIONS.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1 transition-colors ${
                      n.read ? "bg-slate-950/40 border-slate-800/60" : "bg-blue-950/20 border-cyan-500/30"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-200">{n.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{n.timestamp}</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed text-[11px]">{n.message}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 text-center">
                <Link
                  href={role === "customer" ? "/customer/notifications" : "/admin/alerts"}
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-cyan-400 hover:underline font-medium"
                >
                  View All Alerts & Activity →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <Link
          href={role === "customer" ? "/customer/profile" : "/admin/settings"}
          className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-cyan-300 font-semibold text-xs">
            {role === "customer" ? "CU" : "OP"}
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-200 leading-none">
              {role === "customer" ? "Evelyn Reed" : "Commander Vance"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono capitalize">{role} Account</span>
          </div>
        </Link>
      </div>
    </header>
  );
}
