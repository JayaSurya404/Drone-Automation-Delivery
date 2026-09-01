"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, formatINR } from "../../../features/commerce/cart-context";
import {
  DroneIcon,
  ShoppingCartIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
  CheckIcon,
  ZapIcon
} from "@skynav/ui";

export default function CartPage() {
  let router: any = { push: () => {}, replace: () => {} };
  try {
    router = useRouter();
  } catch {}

  const { cart, updateCartQuantity, removeCartItem, clearCart, isLoadingCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const items = cart?.items || [];
  const itemCount = cart?.itemCount || 0;
  const grossWeightGrams = cart?.grossWeightGrams || cart?.totalWeightGrams || 0;
  const operationalPayloadLimitGrams = cart?.operationalPayloadLimitGrams || 4000;
  const isPayloadExceeded = cart?.isPayloadExceeded || grossWeightGrams > operationalPayloadLimitGrams;
  const remainingCapacityGrams = Math.max(0, operationalPayloadLimitGrams - grossWeightGrams);

  const subtotalPaise = cart?.subtotalPaise || cart?.subtotalCents || 0;
  const deliveryFeePaise = cart?.deliveryFeePaise || cart?.deliveryFeeCents || 0;
  const totalPaise = cart?.totalPaise || cart?.totalCents || 0;
  const savingsPaise = cart?.savingsPaise || 0;

  const freeDeliveryThreshold = 49900; // ₹499
  const amountNeededForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotalPaise);

  if (items.length === 0 && !isLoadingCart) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
          <ShoppingCartIcon size={36} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Your Drone Cart is Empty</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Add fresh groceries, daily milk, or tech essentials to experience 15-minute drone airdrop.
        </p>
        <Link
          href="/customer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md transition"
        >
          Explore Catalog & Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Drone Delivery Cart
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {itemCount} {itemCount === 1 ? "item" : "items"} ready for autonomous packaging & flight dispatch
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => clearCart()}
            className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition"
          >
            Clear all items
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Free Delivery Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600 text-white">
              <ZapIcon size={16} />
            </div>
            <div className="flex-1 text-xs">
              {amountNeededForFreeDelivery > 0 ? (
                <p className="text-emerald-800 dark:text-emerald-300 font-medium">
                  Add <strong className="font-bold">{formatINR(amountNeededForFreeDelivery)}</strong> more for <strong>FREE Drone AirDrop</strong>!
                </p>
              ) : (
                <p className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1">
                  <CheckIcon size={14} /> Congratulations! You unlocked FREE Autonomous Drone AirDrop.
                </p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
            {items.map((item) => {
              const p = item.product;
              const unitPrice = p.pricePaise || p.priceCents || 0;
              const lineTotal = unitPrice * item.quantity;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 flex-shrink-0"
                    />
                    <div className="space-y-1">
                      <Link
                        href={`/customer/products/${p.id}`}
                        className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-brand-600 transition line-clamp-1"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {p.weightGrams >= 1000 ? `${(p.weightGrams / 1000).toFixed(1)}kg` : `${p.weightGrams}g`} • {formatINR(unitPrice)} each
                      </p>
                      <p className="text-xs font-black text-slate-900 dark:text-slate-100">
                        Total: {formatINR(lineTotal)}
                      </p>
                    </div>
                  </div>

                  {/* Quantity Controller & Delete */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.quantity === 1) {
                            removeCartItem(item.id);
                          } else {
                            updateCartQuantity(item.id, item.quantity - 1);
                          }
                        }}
                        className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        <MinusIcon size={14} />
                      </button>
                      <span className="w-7 text-center text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      >
                        <PlusIcon size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCartItem(item.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      aria-label="Remove item"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payload Meter & Price Summary */}
        <div className="space-y-6">
          {/* Drone Payload Meter Card */}
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <DroneIcon size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Drone Payload Capacity</h3>
                <p className="text-[11px] text-slate-500">Operational flight delivery limit: 4.0 kg</p>
              </div>
            </div>

            {/* Capacity Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-400">
                  Gross: {(grossWeightGrams / 1000).toFixed(2)} kg
                </span>
                <span className={isPayloadExceeded ? "text-rose-600 font-bold" : "text-slate-500"}>
                  Limit: 4.00 kg
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isPayloadExceeded
                      ? "bg-rose-500"
                      : grossWeightGrams > 3000
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, (grossWeightGrams / 4000) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                {isPayloadExceeded ? (
                  <span className="text-rose-500 font-bold flex items-center gap-1 mt-1">
                    <AlertTriangleIcon size={12} />
                    Payload exceeds 4.0 kg by {(grossWeightGrams - 4000)}g. Please decrease quantities to proceed.
                  </span>
                ) : (
                  <span>Remaining payload room: <strong>{(remainingCapacityGrams / 1000).toFixed(2)} kg</strong></span>
                )}
              </p>
            </div>
          </div>

          {/* Bill Summary */}
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Payment Summary</h3>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(subtotalPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span>Drone Flight Delivery Fee</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {deliveryFeePaise === 0 ? <span className="text-emerald-500">FREE</span> : formatINR(deliveryFeePaise)}
                </span>
              </div>
              {savingsPaise > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Total Discount Savings</span>
                  <span>- {formatINR(savingsPaise)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-base font-black text-slate-900 dark:text-slate-100">
                <span>Total Payable</span>
                <span className="text-brand-600 dark:text-brand-400">{formatINR(totalPaise)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={isPayloadExceeded || items.length === 0}
              onClick={() => router.push("/customer/checkout")}
              className="w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-[0.99] text-white text-sm font-bold shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Proceed to Drone Checkout</span>
              <ArrowRightIcon size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
