"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../features/auth/auth-context";
import { useCart } from "../../../features/commerce/cart-context";
import { AddressModal } from "../../../components/commerce/address-modal";
import {
  UserIcon,
  MapPinIcon,
  PackageIcon,
  HeartIcon,
  ShieldIcon,
  PlusIcon,
  ChevronRightIcon
} from "@skynav/ui";

export default function CustomerProfilePage() {
  const { user, logout } = useAuth();
  const { addresses, wishlist, deleteAddress } = useCart();
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Customer Account</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage your personal information, saved landing pads, and flight preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-500 text-white flex items-center justify-center text-xl font-bold">
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{user?.name || "Customer"}</h3>
              <p className="text-xs text-slate-500 truncate max-w-[160px]">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded">
                {user?.role || "CUSTOMER"}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <Link
              href="/customer/orders"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
            >
              <span className="flex items-center gap-2"><PackageIcon size={16} /> My Orders</span>
              <ChevronRightIcon size={14} />
            </Link>
            <Link
              href="/customer/wishlist"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
            >
              <span className="flex items-center gap-2"><HeartIcon size={16} /> Saved Wishlist ({wishlist?.total || 0})</span>
              <ChevronRightIcon size={14} />
            </Link>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Saved Addresses Manager */}
        <div className="md:col-span-2 bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Saved Landing Pads</h3>
              <p className="text-xs text-slate-500">Autonomous delivery drop zones for your account</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddressModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-xl flex items-center gap-1 transition"
            >
              <PlusIcon size={14} /> Add Address
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <MapPinIcon size={28} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">No landing addresses saved yet</p>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="mt-2 text-xs font-bold text-brand-600 hover:underline"
              >
                + Add Rooftop or Backyard Marker
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start justify-between"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{addr.recipientName}</span>
                      {addr.isDefault && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{addr.addressLine1} {addr.addressLine2}</p>
                    <p className="text-slate-500">{addr.city}, {addr.state} {addr.postalCode} • {addr.phone}</p>
                    <p className="text-[11px] font-mono text-brand-600 dark:text-brand-400 flex items-center gap-1 mt-1">
                      <MapPinIcon size={12} /> {addr.latitude.toFixed(4)}°N, {addr.longitude.toFixed(4)}°W
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteAddress(addr.id)}
                    className="text-xs font-semibold text-rose-500 hover:text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddressModal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} />
    </div>
  );
}
