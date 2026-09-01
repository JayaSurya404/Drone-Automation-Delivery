"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../features/auth/auth-context";
import { useCart } from "../../../features/commerce/cart-context";
import { AddressModal } from "../../../components/commerce/address-modal";
import {
  DroneIcon,
  MapPinIcon,
  CheckIcon,
  ZapIcon,
  ShieldIcon,
  CreditCardIcon,
  PlusIcon,
  ChevronLeftIcon
} from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CustomerCheckoutPage() {
  let router: any = { push: () => {}, replace: () => {} };
  try { router = useRouter(); } catch {}
  const { token, user } = useAuth();
  const { cart, selectedAddress, clearCart } = useCart();

  const [priority, setPriority] = useState<"STANDARD" | "EXPRESS" | "URGENT">("STANDARD");
  const [deliveryNotes, setDeliveryNotes] = useState<string>("");
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-bold">Your cart is empty</h2>
        <Link href="/customer" className="mt-4 inline-block px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl">
          Browse Store
        </Link>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      setError("Please select or add a designated drone landing address.");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      // Hub origin default in SF
      const hubOrigin = {
        latitude: 37.7749,
        longitude: -122.4194,
        altitudeMeters: 10,
        address: "SkyNav Launch Hub Alpha (Downtown SF)"
      };

      const dropLocation = {
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
        altitudeMeters: 0,
        address: `${selectedAddress.addressLine1}, ${selectedAddress.city}`
      };

      const orderPayload = {
        pickup: hubOrigin,
        delivery: dropLocation,
        package: {
          weightGrams: cart.totalWeightGrams || 500,
          description: cart.items.map((i) => `${i.quantity}x ${i.product.name}`).join(", ")
        },
        priority,
        deliveryNotes: deliveryNotes || selectedAddress.deliveryInstructions || "Autonomous precision drop on landing pad.",
        items: cart.items.map((i) => ({
          productId: i.productId,
          productName: i.product.name,
          unitPriceCents: i.product.priceCents,
          quantity: i.quantity,
          weightGrams: i.product.weightGrams,
          imageUrl: i.product.imageUrl
        }))
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(orderPayload)
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.detail || "Failed to place order.");
      }

      const json = await res.json();
      const createdOrder = json.data;

      // Clear cart on successful order placement
      await clearCart();

      // Redirect to Order Detail
      router.push(`/customer/orders/${createdOrder.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/customer/cart" className="hover:text-brand-600 flex items-center gap-1">
          <ChevronLeftIcon size={14} /> Back to Cart
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Checkout & Drone Dispatch</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Confirm landing pad coordinates and flight priority
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Config Steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Landing Pad Address */}
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs">1</span>
                <span>Designated Landing Pad Address</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
              >
                {selectedAddress ? "Change" : "Select Address"}
              </button>
            </div>

            {selectedAddress ? (
              <div className="p-4 rounded-2xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 flex items-start justify-between">
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-slate-900 dark:text-slate-100">{selectedAddress.recipientName} ({selectedAddress.phone})</p>
                  <p className="text-slate-600 dark:text-slate-300">{selectedAddress.addressLine1} {selectedAddress.addressLine2}</p>
                  <p className="text-slate-500">{selectedAddress.city}, {selectedAddress.state} {selectedAddress.postalCode}</p>
                  <p className="text-[11px] font-mono text-brand-600 dark:text-brand-400 flex items-center gap-1 mt-1">
                    <MapPinIcon size={12} /> {selectedAddress.latitude.toFixed(4)}°N, {selectedAddress.longitude.toFixed(4)}°W
                  </p>
                </div>
                <span className="p-1 bg-brand-600 text-white rounded-full">
                  <CheckIcon size={12} />
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 transition flex items-center justify-center gap-2"
              >
                <PlusIcon size={16} /> Choose or Add Landing Coordinates
              </button>
            )}
          </div>

          {/* Step 2: Flight Priority */}
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs">2</span>
              <span>Flight Dispatch Priority</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setPriority("STANDARD")}
                className={`p-4 rounded-2xl border cursor-pointer transition ${
                  priority === "STANDARD"
                    ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/30"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">⚡ Standard AirDrop</span>
                  {priority === "STANDARD" && <CheckIcon size={14} className="text-brand-600" />}
                </div>
                <p className="text-xs text-slate-500">Autonomous 15-20 min window</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">Free Promo</p>
              </div>

              <div
                onClick={() => setPriority("EXPRESS")}
                className={`p-4 rounded-2xl border cursor-pointer transition ${
                  priority === "EXPRESS"
                    ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/30"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">🚀 Express Priority Flight</span>
                  {priority === "EXPRESS" && <CheckIcon size={14} className="text-brand-600" />}
                </div>
                <p className="text-xs text-slate-500">Immediate launch, 10-12 mins</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">Priority Corridor</p>
              </div>
            </div>
          </div>

          {/* Step 3: Delivery Instructions */}
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs">3</span>
              <span>Landing Zone Notes & Instructions</span>
            </h3>
            <textarea
              rows={2}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="e.g. Leave package inside the patio landing square marker. Keep dog indoors."
              className="w-full px-4 py-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Right Summary & Place Order */}
        <div className="space-y-4">
          <div className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Package Contents</h3>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400 line-clamp-1 flex-1 pr-2">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    ${((item.product.priceCents * item.quantity) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>${(cart.subtotalCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Drone Delivery</span>
                <span className="text-emerald-500 font-semibold">
                  {cart.deliveryFeeCents === 0 ? "FREE" : `$${(cart.deliveryFeeCents / 100).toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span>Total</span>
                <span>${(cart.totalCents / 100).toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting || !selectedAddress}
              onClick={handlePlaceOrder}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white text-sm font-bold shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <DroneIcon size={20} />
              <span>{isSubmitting ? "Dispatching Flight..." : "Confirm & Dispatch Drone"}</span>
            </button>
          </div>
        </div>
      </div>

      <AddressModal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} />
    </div>
  );
}
