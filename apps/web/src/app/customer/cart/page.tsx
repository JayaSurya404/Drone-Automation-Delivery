"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../../../features/commerce/cart-context";
import {
  ShoppingCartIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
  DroneIcon,
  ZapIcon,
  ShieldIcon,
  ChevronRightIcon
} from "@skynav/ui";

export default function CustomerCartPage() {
  let router: any = { push: () => {}, replace: () => {} };
  try { router = useRouter(); } catch {}
  const { cart, updateCartQuantity, removeCartItem, clearCart, isLoadingCart } = useCart();

  if (isLoadingCart) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-20 bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm animate-in fade-in duration-300">
        <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
          <ShoppingCartIcon size={40} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Your Cart is Empty</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2">
          Discover farm-fresh groceries, rapid pharmacy essentials, and electronics ready for 15-minute autonomous drone delivery.
        </p>
        <Link
          href="/customer"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-2xl shadow-lg shadow-brand-500/25 transition"
        >
          <span>Explore Store</span>
          <ChevronRightIcon size={16} />
        </Link>
      </div>
    );
  }

  const weightProgress = Math.min(100, (cart.totalWeightGrams / 5000) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Your Drone Delivery Cart</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {cart.itemCount} items ready for packing at regional launch hub
          </p>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition"
        >
          Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Item List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm">
            {cart.items.map((item) => {
              const formattedItemTotal = `$${((item.product.priceCents * item.quantity) / 100).toFixed(2)}`;
              return (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-16 h-16 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{item.product.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ${(item.product.priceCents / 100).toFixed(2)} each • {item.product.weightGrams}g
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Quantity Selector */}
                    <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-1 bg-white dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() =>
                          item.quantity === 1 ? removeCartItem(item.id) : updateCartQuantity(item.id, item.quantity - 1)
                        }
                        className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <MinusIcon size={12} />
                      </button>
                      <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <PlusIcon size={12} />
                      </button>
                    </div>

                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 w-16 text-right">
                      {formattedItemTotal}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeCartItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition"
                      aria-label="Remove item"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drone Payload Meter */}
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <DroneIcon size={16} className="text-brand-500" /> Total Drone Payload
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {cart.totalWeightGrams}g / 5,000g max
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  cart.isDronePayloadCompliant ? "bg-emerald-500" : "bg-rose-500"
                }`}
                style={{ width: `${weightProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {cart.isDronePayloadCompliant
                ? "✓ Optimal cargo weight for single autonomous flight dispatch."
                : "⚠️ Exceeds hexacopter payload safety threshold."}
            </p>
          </div>
        </div>

        {/* Right Summary & Checkout Box */}
        <div className="space-y-4">
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Order Summary</h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  ${(cart.subtotalCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <span>Drone AirDrop Fee</span>
                  {cart.deliveryFeeCents === 0 && (
                    <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 rounded">
                      FREE PROMO
                    </span>
                  )}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {cart.deliveryFeeCents === 0 ? "$0.00" : `$${(cart.deliveryFeeCents / 100).toFixed(2)}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Flight Corridor Insurance</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Included (Free)</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
              <div>
                <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Total Price</span>
                <p className="text-[10px] text-slate-400">Taxes calculated</p>
              </div>
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                ${(cart.totalCents / 100).toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => router.push("/customer/checkout")}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 active:scale-[0.98] text-white text-sm font-bold shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2 transition"
            >
              <ZapIcon size={18} />
              <span>Proceed to Drone Checkout</span>
            </button>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 space-y-1">
              <p className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                <ShieldIcon size={12} className="text-emerald-500" /> SkyNav Delivery Guarantee
              </p>
              <p>Autonomous high-altitude corridor with tethered drop or soft precision touchdown.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
