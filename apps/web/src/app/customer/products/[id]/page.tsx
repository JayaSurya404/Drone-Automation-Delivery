"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductResponse } from "@skynav/contracts";
import { useCart } from "../../../../features/commerce/cart-context";
import {
  DroneIcon,
  HeartIcon,
  ShoppingCartIcon,
  ZapIcon,
  CheckIcon,
  ChevronLeftIcon,
  ShieldIcon,
  StarIcon,
  PlusIcon,
  MinusIcon
} from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;
  let router: any = { push: () => {}, replace: () => {} };
  try { router = useRouter(); } catch {}

  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useCart();
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const inWish = product ? isInWishlist(product.id) : false;

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/products/${productId}`);
        if (res.ok) {
          const json = await res.json();
          setProduct(json.data);
        }
      } catch (err) {
        console.error("Failed to load product", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [productId]);

  const handleAddToCart = async () => {
    if (!product) return;
    setIsAdding(true);
    try {
      await addToCart(product, quantity);
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    setIsAdding(true);
    try {
      await addToCart(product, quantity);
      router.push("/customer/checkout");
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Product Not Found</h2>
        <Link href="/customer" className="mt-4 inline-block px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl">
          Back to Store
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Back Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/customer" className="hover:text-brand-600 flex items-center gap-1">
          <ChevronLeftIcon size={14} /> Back to Store
        </Link>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-300 font-medium">{product.category}</span>
        <span>/</span>
        <span className="text-slate-900 dark:text-slate-100 font-bold truncate max-w-[200px]">{product.name}</span>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm">
        {/* Product Image Preview */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50">
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          <div className="absolute top-4 right-4">
            <button
              type="button"
              onClick={() => (inWish ? removeFromWishlist(product.id) : addToWishlist(product))}
              className={`p-3 rounded-full backdrop-blur-md transition shadow-lg ${
                inWish
                  ? "bg-rose-500 text-white"
                  : "bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:text-rose-500"
              }`}
            >
              <HeartIcon size={20} />
            </button>
          </div>
        </div>

        {/* Product Details & Purchase HUD */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-brand-400">
                {product.category}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                <CheckIcon size={14} /> In Stock ({product.stockQuantity} available)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                ${(product.priceCents / 100).toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">Taxes calculated at checkout</span>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {product.description}
            </p>

            {/* Drone Flight Specs Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <DroneIcon size={16} className="text-brand-500" /> Drone Payload Weight
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {product.weightGrams >= 1000 ? `${(product.weightGrams / 1000).toFixed(2)} kg` : `${product.weightGrams} grams`}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <ZapIcon size={16} className="text-amber-500" /> Delivery Method
                </span>
                <span className="font-bold text-emerald-500">Autonomous Hexacopter AirDrop</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <ShieldIcon size={16} className="text-cyan-500" /> Airworthiness Compliance
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Class-A Certified Safe</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {/* Quantity Controller */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quantity:</span>
              <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl p-1 bg-white dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <MinusIcon size={14} />
                </button>
                <span className="w-8 text-center text-sm font-bold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(product.stockQuantity, quantity + 1))}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <PlusIcon size={14} />
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isAdding}
                onClick={handleAddToCart}
                className="w-full py-3.5 px-6 rounded-xl border border-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <ShoppingCartIcon size={18} />
                <span>Add to Cart</span>
              </button>
              <button
                type="button"
                disabled={isAdding}
                onClick={handleBuyNow}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <ZapIcon size={18} />
                <span>Buy Now with Drone Drop</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
