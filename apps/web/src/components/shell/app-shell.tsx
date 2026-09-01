"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DroneIcon, MenuIcon, CloseIcon, productName } from "@skynav/ui";
import { CustomerNav } from "@/components/shell/customer-nav";
import { AdminNav } from "@/components/shell/admin-nav";
import { TopBar } from "@/components/shell/top-bar";

export interface AppShellProps {
  role: "customer" | "admin";
  title?: string;
  children: React.ReactNode;
}

export function AppShell({ role, title, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#070b14] text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-800/80 bg-slate-950/90 backdrop-blur-xl shrink-0 sticky top-0 h-screen z-40">
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-slate-800/80 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <DroneIcon size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                {productName}
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  {role.toUpperCase()}
                </span>
              </span>
              <span className="text-[10px] text-slate-400 tracking-wider uppercase font-mono">Autonomous Ops</span>
            </div>
          </Link>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto py-2">
          {role === "customer" ? <CustomerNav /> : <AdminNav />}
        </div>

        {/* Footer info & Role Switcher */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 text-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono">Workspace Switcher</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/customer"
              className={`text-center py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                role === "customer"
                  ? "bg-blue-600/30 border-blue-500/40 text-cyan-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Customer
            </Link>
            <Link
              href="/admin"
              className={`text-center py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                role === "admin"
                  ? "bg-blue-600/30 border-blue-500/40 text-cyan-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Admin Ops
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Navigation Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden animate-fade-in"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Mobile Drawer Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-y-0 left-0 w-72 bg-slate-950 border-r border-slate-800 z-50 flex flex-col lg:hidden animate-scale-up">
          <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                <DroneIcon size={18} />
              </div>
              <span className="font-bold text-white tracking-tight">{productName}</span>
            </div>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {role === "customer" ? (
              <CustomerNav onLinkClick={() => setMobileNavOpen(false)} />
            ) : (
              <AdminNav onLinkClick={() => setMobileNavOpen(false)} />
            )}
          </div>
        </div>
      )}

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header Bar */}
        <div className="lg:hidden h-14 px-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-900"
            aria-label="Open Navigation Menu"
          >
            <MenuIcon size={20} />
          </button>
          <span className="font-bold text-sm text-slate-100">{productName}</span>
          <div className="w-8" />
        </div>

        <TopBar role={role} title={title} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
