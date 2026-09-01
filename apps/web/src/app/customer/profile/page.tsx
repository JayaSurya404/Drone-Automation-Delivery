"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../features/auth/auth-context";
import { useCart } from "../../../features/commerce/cart-context";
import { AddressModal } from "../../../components/commerce/address-modal";
import { UserIcon, MapPinIcon, ArrowLeftIcon, PlusIcon } from "@skynav/ui";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { addresses, deleteAddress } = useCart();
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <Link
        href="/customer"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand-600 transition"
      >
        <ArrowLeftIcon size={14} /> Back to Store
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Customer Account & Settings
        </h1>
        <p className="text-xs text-slate-500">Manage profile and saved drone landing coordinates</p>
      </div>

      {/* User Information */}
      <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center text-2xl font-black shadow-lg">
            {user?.name ? user.name[0].toUpperCase() : "U"}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{user?.name || "Customer"}</h2>
            <p className="text-xs text-slate-500">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-bold uppercase tracking-wider">
              {user?.role || "CUSTOMER"}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition"
          >
            Sign Out of Account
          </button>
        </div>
      </div>

      {/* Saved Drone Landing Pads */}
      <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <MapPinIcon size={18} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Saved Drone Landing Pads
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsAddressModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-500 transition shadow"
          >
            <PlusIcon size={14} /> Add Landing Pad
          </button>
        </div>

        {addresses.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No landing addresses saved yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {addresses.map((a) => (
              <div
                key={a.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{a.recipientName}</span>
                  {a.isDefault && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-200 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{a.addressLine1} {a.addressLine2}</p>
                <p className="text-xs text-slate-500">{a.city}, {a.state} - {a.postalCode}</p>
                <p className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                  📍 {a.latitude.toFixed(4)}°N, {a.longitude.toFixed(4)}°E
                </p>
                <button
                  type="button"
                  onClick={() => deleteAddress(a.id)}
                  className="text-xs text-rose-500 hover:text-rose-700 mt-2 block"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddressModal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} />
    </div>
  );
}
