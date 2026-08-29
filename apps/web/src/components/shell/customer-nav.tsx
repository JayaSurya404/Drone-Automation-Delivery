"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PackageIcon,
  RadarIcon,
  BellIcon,
  UserIcon,
  ActivityIcon
} from "@skynav/ui";

export function CustomerNav({ onLinkClick }: { onLinkClick?: () => void }) {
  let pathname = "";
  try {
    pathname = usePathname() || "";
  } catch {
    pathname = "";
  }

  const links = [
    { href: "/customer", label: "Dashboard", icon: <ActivityIcon size={18} /> },
    { href: "/customer/orders", label: "My Orders", icon: <PackageIcon size={18} /> },
    { href: "/customer/tracking", label: "Live Tracking", icon: <RadarIcon size={18} /> },
    { href: "/customer/notifications", label: "Notifications", icon: <BellIcon size={18} /> },
    { href: "/customer/profile", label: "Profile & Addresses", icon: <UserIcon size={18} /> }
  ];

  return (
    <nav className="space-y-1.5 p-3">
      {links.map((link) => {
        const isActive = pathname === link.href || (link.href !== "/customer" && Boolean(pathname && pathname.startsWith(link.href)));
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
