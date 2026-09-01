"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartProvider, useCart } from "../../features/commerce/cart-context";
import { CustomerHeader } from "../../components/commerce/customer-header";
import { DroneIcon, ShoppingCartIcon, HeartIcon, PackageIcon, UserIcon, RadarIcon } from "@skynav/ui";

function MobileBottomNav() {
  let pathname = "";
  try { pathname = usePathname() || ""; } catch {}
  const { cart, wishlist } = useCart();

  const cartCount = cart?.itemCount || 0;
  const wishCount = wishlist?.total || 0;

  const navItems = [
    { href: "/customer", label: "Store", icon: DroneIcon },
    { href: "/customer/orders", label: "Orders", icon: PackageIcon },
    { href: "/customer/tracking", label: "Radar", icon: RadarIcon },
    { href: "/customer/wishlist", label: "Wishlist", icon: HeartIcon, count: wishCount },
    { href: "/customer/cart", label: "Cart", icon: ShoppingCartIcon, count: cartCount },
    { href: "/customer/profile", label: "Account", icon: UserIcon }
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center justify-center p-1.5 rounded-xl text-[10px] font-medium transition ${
              isActive
                ? "text-brand-600 dark:text-brand-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <div className="relative">
              <Icon size={18} />
              {Boolean(item.count && item.count > 0) && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[14px] text-[8px] font-bold text-center text-white bg-brand-500 rounded-full">
                  {item.count}
                </span>
              )}
            </div>
            <span className="mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
        <CustomerHeader />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-8">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </CartProvider>
  );
}
