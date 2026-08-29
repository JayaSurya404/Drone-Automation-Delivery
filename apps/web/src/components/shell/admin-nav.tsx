"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  PackageIcon,
  DroneIcon,
  RouteIcon,
  RadarIcon,
  AlertTriangleIcon,
  FileTextIcon,
  SettingsIcon
} from "@skynav/ui";

export function AdminNav({ onLinkClick }: { onLinkClick?: () => void }) {
  let pathname = "";
  try {
    pathname = usePathname() || "";
  } catch {
    pathname = "";
  }

  const links = [
    { href: "/admin", label: "Operations Center", icon: <ActivityIcon size={18} /> },
    { href: "/admin/orders", label: "Delivery Orders", icon: <PackageIcon size={18} /> },
    { href: "/admin/fleet", label: "UAV Fleet Management", icon: <DroneIcon size={18} /> },
    { href: "/admin/missions", label: "Flight Missions", icon: <RouteIcon size={18} /> },
    { href: "/admin/tracking", label: "Live Radar & HUD", icon: <RadarIcon size={18} /> },
    { href: "/admin/alerts", label: "Incident Alerts", icon: <AlertTriangleIcon size={18} /> },
    { href: "/admin/audit", label: "Security & Audit Logs", icon: <FileTextIcon size={18} /> },
    { href: "/admin/settings", label: "Depot & Airspace", icon: <SettingsIcon size={18} /> }
  ];

  return (
    <nav className="space-y-1.5 p-3">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
        Mission Control
      </div>
      {links.map((link) => {
        const isActive = pathname === link.href || (link.href !== "/admin" && Boolean(pathname && pathname.startsWith(link.href)));
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onLinkClick}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              isActive
                ? "bg-blue-600/20 text-cyan-300 border border-blue-500/40 shadow-sm shadow-blue-900/30"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/60"
            }`}
          >
            <span className={isActive ? "text-cyan-400" : "text-slate-400"}>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
