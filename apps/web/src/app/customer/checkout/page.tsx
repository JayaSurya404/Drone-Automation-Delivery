"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart, formatINR } from "../../../features/commerce/cart-context";
import { AddressModal } from "../../../components/commerce/address-modal";
import {
  DroneIcon,
  MapPinIcon,
  CheckIcon,
  ZapIcon,
  ArrowLeftIcon,
  AlertTriangleIcon
} from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CheckoutPage() {
  let router: any = { push: () => {}, replace: () => {} };
  try {
    router = useRouter();
  } catch {}

  const { cart, selectedAddress, clearCart } = useCart();

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [priority, setPriority] = useState<"STANDARD" | "EXPRESS">("STANDARD");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = cart?.items || [];
  const itemCount = cart?.itemCount || 0;
  const subtotalPaise = cart?.subtotalPaise || cart?.subtotalCents || 0;
  const deliveryFeePaise = cart?.deliveryFeePaise || cart?.deliveryFeeCents || 0;
  const totalPaise = cart?.totalPaise || cart?.totalCents || 0;
  const grossWeightGrams = cart?.grossWeightGrams || cart?.totalWeightGrams || 0;

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Your cart is empty</h2>
        <Link
          href="/customer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-md hover:bg-brand-500 transition"
        >
          <ArrowLeftIcon size={14} /> Back to Store
        </Link>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      setIsAddressModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const orderPayload = {
        priority,
        deliveryNotes,
        originLatitude: 12.9716, // SkyNav Bengaluru Central Launch Hub
        originLongitude: 77.5946,
        originAddress: "SkyNav Metro Air Hub #1, Bengaluru Central",
        destinationLatitude: selectedAddress.latitude,
        destinationLongitude: selectedAddress.longitude,
        destinationAddress: `${selectedAddress.addressLine1}, ${selectedAddress.addressLine2 ? selectedAddress.addressLine2 + ", " : ""}${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.postalCode}`,
        recipientName: selectedAddress.recipientName,
        recipientPhone: selectedAddress.phone,
        recipientEmail: "customer@skynav.delivery",
        package: {
          weightGrams: grossWeightGrams,
          declaredValueCents: totalPaise,
          requiresRefrigeration: false,
          hazardousMaterial: false
        },
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          unitPricePaise: item.product.pricePaise || item.product.priceCents || 0,
          totalPricePaise: (item.product.pricePaise || item.product.priceCents || 0) * item.quantity,
          quantity: item.quantity,
          weightGrams: item.product.weightGrams,
          imageUrl: item.product.imageUrl
        }))
      };

      const token = localStorage.getItem("skynav_token");
      const res = await fetch(`${API_BASE_URL}/api/v1/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(orderPayload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.message || "Failed to create order");
      }

      const created = await res.json();
      await clearCart();
      router.push(`/customer/orders/${created.id || created.orderNumber}`);
    } catch (err: any) {
      setError(err.message || "Order placement failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <Link
        href="/customer/cart"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-600 transition"
      >
        <ArrowLeftIcon size={14} /> Back to Cart
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Drone AirDrop Checkout
        </h1>
        <p className="text-xs text-slate-500">
          Verify landing pad marker and dispatch flight path
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-3">
          <AlertTriangleIcon size={18} className="text-rose-600 flex-shrink-0" />
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Landing Address Card */}
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <MapPinIcon size={18} />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  1. Delivery Landing Pad
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                {selectedAddress ? "Change" : "Select Address"}
              </button>
            </div>

            {selectedAddress ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedAddress.recipientName} ({selectedAddress.phone})
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {selectedAddress.addressLine1} {selectedAddress.addressLine2}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.postalCode}
                </p>
                <p className="text-[11px] font-mono text-brand-600 dark:text-brand-400 mt-1">
                  📍 Coordinates: {selectedAddress.latitude.toFixed(4)}°N, {selectedAddress.longitude.toFixed(4)}°E
                </p>
              </div>
            ) : (
              <div className="p-6 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
                <p className="text-xs text-slate-500 mb-3">No landing address selected.</p>
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl shadow hover:bg-brand-500 transition"
                >
                  + Add / Select Landing Pad
                </button>
              </div>
            )}
          </div>

          {/* Delivery Zone Instructions */}
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              2. Landing Pad Drop Instructions
            </h3>
            <textarea
              rows={2}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="e.g. Center marker on rooftop terrace. Ring apartment 402 upon touchdown."
              className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Flight Priority Option */}
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              3. Dispatch Priority
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPriority("STANDARD")}
                className={`p-4 rounded-2xl border text-left transition ${
                  priority === "STANDARD"
                    ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-slate-900 dark:text-slate-100"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Standard AirDrop</span>
                  {priority === "STANDARD" && <CheckIcon size={14} className="text-brand-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">12–15 min corridor flight</p>
              </button>

              <button
                type="button"
                onClick={() => setPriority("EXPRESS")}
                className={`p-4 rounded-2xl border text-left transition ${
                  priority === "EXPRESS"
                    ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 text-slate-900 dark:text-slate-100"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1">
                    <ZapIcon size={12} className="text-amber-400" /> Express AirDrop
                  </span>
                  {priority === "EXPRESS" && <CheckIcon size={14} className="text-brand-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Direct priority UAV launch</p>
              </button>
            </div>
          </div>
        </div>

        {/* Order Review & Dispatch Button */}
        <div className="space-y-6">
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Order Items ({itemCount})</h3>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {items.map((i) => (
                <div key={i.id} className="flex justify-between text-xs py-1">
                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-[160px]">
                    {i.quantity}x {i.product.name}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatINR((i.product.pricePaise || i.product.priceCents || 0) * i.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(subtotalPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span>AirDrop Delivery</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {deliveryFeePaise === 0 ? <span className="text-emerald-500">FREE</span> : formatINR(deliveryFeePaise)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-base font-black text-slate-900 dark:text-slate-100">
                <span>Total Amount</span>
                <span className="text-brand-600 dark:text-brand-400">{formatINR(totalPaise)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting || !selectedAddress}
              onClick={handlePlaceOrder}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DroneIcon size={18} />
              <span>{isSubmitting ? "Dispatching Flight..." : "Confirm & Dispatch Drone AirDrop"}</span>
            </button>
          </div>
        </div>
      </div>

      <AddressModal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} />
    </div>
  );
}
