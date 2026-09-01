"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../features/auth/auth-context";
import { useCart, formatINR } from "../../features/commerce/cart-context";
import { AddressModal } from "./address-modal";
import {
  DroneIcon,
  SearchIcon,
  MapPinIcon,
  HeartIcon,
  ShoppingCartIcon,
  BellIcon,
  UserIcon,
  SunIcon,
  MoonIcon,
  CloseIcon,
  ZapIcon
} from "@skynav/ui";

export function CustomerHeader() {
  let pathname = "";
  try { pathname = usePathname() || ""; } catch {}
  let router: any = { push: () => {}, replace: () => {} };
  try { router = useRouter(); } catch {}

  const { user, logout } = useAuth();
  const { cart, wishlist, selectedAddress } = useCart();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const cartCount = cart?.itemCount || 0;
  const wishCount = wishlist?.total || 0;
  const cartSubtotal = formatINR(cart?.subtotalPaise || cart?.subtotalCents || 0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/customer?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/customer");
    }
  };

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl transition">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo & City Delivery Badge */}
            <div className="flex items-center gap-4 sm:gap-6">
              <Link href="/customer" className="flex items-center gap-2 group">
                <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md group-hover:scale-105 transition">
                  <DroneIcon size={22} />
                </div>
                <div>
                  <span className="text-lg font-black tracking-tight bg-gradient-to-r from-brand-600 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">
                    SkyNav
                  </span>
                  <span className="hidden sm:inline-block ml-1.5 text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    Store
                  </span>
                </div>
              </Link>

              {/* Delivery Location Selector */}
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
              >
                <MapPinIcon size={16} className="text-brand-500 flex-shrink-0" />
                <div className="text-xs">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                    ⚡ 15m Drone Drop
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1 max-w-[150px] leading-tight">
                    {selectedAddress ? `${selectedAddress.city} (${selectedAddress.recipientName})` : "Select Landing Pad"}
                  </p>
                </div>
              </button>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-lg hidden sm:block">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search atta, milk, tea, snacks, medical essentials..."
                  className="w-full pl-10 pr-10 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                />
                <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      router.push("/customer");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <CloseIcon size={14} />
                  </button>
                )}
              </form>
            </div>

            {/* Right Nav Icons */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Toggle Theme"
              >
                {isDarkMode ? <SunIcon size={18} /> : <MoonIcon size={18} />}
              </button>

              {/* Wishlist */}
              <Link
                href="/customer/wishlist"
                className={`relative p-2 rounded-xl transition ${
                  pathname === "/customer/wishlist"
                    ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                aria-label="Wishlist"
              >
                <HeartIcon size={20} />
                {wishCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] text-[10px] font-bold text-center text-white bg-rose-500 rounded-full shadow-sm">
                    {wishCount}
                  </span>
                )}
              </Link>

              {/* Cart Button with INR Subtotal */}
              <Link
                href="/customer/cart"
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                  pathname === "/customer/cart"
                    ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60"
                }`}
                aria-label="Shopping Cart"
              >
                <ShoppingCartIcon size={20} className={pathname === "/customer/cart" ? "text-white" : "text-emerald-600 dark:text-emerald-400"} />
                <span className="text-xs font-bold">
                  {cartCount > 0 ? cartSubtotal : "Cart"}
                </span>
                {cartCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-black text-white bg-emerald-600 rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>

              {/* Notifications */}
              <Link
                href="/customer/notifications"
                className={`relative p-2 rounded-xl transition ${
                  pathname === "/customer/notifications"
                    ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                aria-label="Notifications"
              >
                <BellIcon size={20} />
              </Link>

              {/* Account Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-cyan-500 text-white flex items-center justify-center text-xs font-bold">
                    {user?.name ? user.name[0].toUpperCase() : "U"}
                  </div>
                </button>

                {isProfileMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onMouseLeave={() => setIsProfileMenuOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.name || "Customer"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/customer/orders"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        📦 My Orders
                      </Link>
                      <Link
                        href="/customer/tracking"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        📡 Live Delivery Radar
                      </Link>
                      <Link
                        href="/customer/wishlist"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        ❤️ Saved Wishlist
                      </Link>
                      <Link
                        href="/customer/profile"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        ⚙️ Account & Saved Addresses
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Search Input */}
          <div className="pb-3 sm:hidden">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search atta, milk, tea, snacks..."
                className="w-full pl-10 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <SearchIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </form>
          </div>
        </div>
      </header>

      {/* Address Selection Modal */}
      <AddressModal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} />
    </>
  );
}
