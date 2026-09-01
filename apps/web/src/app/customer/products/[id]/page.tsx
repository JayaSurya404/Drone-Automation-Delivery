"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ProductResponse } from "@skynav/contracts";
import { useCart, formatINR } from "../../../../features/commerce/cart-context";
import {
  DroneIcon,
  ShoppingCartIcon,
  HeartIcon,
  ZapIcon,
  CheckIcon,
  ArrowLeftIcon,
  AlertTriangleIcon
} from "@skynav/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ProductDetailPage() {
  let params: any = {};
  try {
    params = useParams() || {};
  } catch {}
  let router: any = { push: () => {}, replace: () => {} };
  try {
    router = useRouter();
  } catch {}
  const id = params?.id as string;

  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useCart();

  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/v1/products/${id}`);
        if (!res.ok) throw new Error("Product not found");
        const json = await res.json();
        setProduct(json.data);
      } catch (err: any) {
        setError(err.message || "Failed to load product");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (error || (!product && !isLoading)) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="p-4 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 w-16 h-16 mx-auto flex items-center justify-center">
          <AlertTriangleIcon size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Product Details</h2>
        <p className="text-sm text-slate-500">{error || "Loading product specifications..."}</p>
        <Link
          href="/customer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-md hover:bg-brand-500 transition"
        >
          <ArrowLeftIcon size={14} /> Back to SkyNav Store
        </Link>
      </div>
    );
  }

  const inWish = product ? isInWishlist(product.id) : false;
  const priceFormatted = formatINR(product?.pricePaise || product?.priceCents || 0);
  const mrpFormatted = product?.mrpPaise ? formatINR(product.mrpPaise) : null;
  const discountPercent =
    product?.discountPercent ||
    (product?.mrpPaise && product.mrpPaise > (product.pricePaise || 0)
      ? Math.round(((product.mrpPaise - (product.pricePaise || 0)) / product.mrpPaise) * 100)
      : 0);

  const handleAddToCart = async () => {
    if (!product) return;
    setIsActionLoading(true);
    try {
      await addToCart(product, quantity);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    setIsActionLoading(true);
    try {
      await addToCart(product, quantity);
      router.push("/customer/cart");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      <Link
        href="/customer"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
      >
        <ArrowLeftIcon size={14} /> Back to Storefront
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        {/* Product Image */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
          <img
            src={product?.imageUrl}
            alt={product?.name || "Product"}
            className="w-full h-full object-cover"
          />
          {discountPercent > 0 && (
            <div className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black uppercase tracking-wider shadow-lg">
              {discountPercent}% OFF
            </div>
          )}
          {product && (
            <button
              type="button"
              onClick={() => (inWish ? removeFromWishlist(product.id) : addToWishlist(product))}
              className={`absolute top-4 right-4 p-3 rounded-full backdrop-blur-md shadow-lg transition ${
                inWish
                  ? "bg-rose-500 text-white"
                  : "bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-rose-500"
              }`}
            >
              <HeartIcon size={20} />
            </button>
          )}
        </div>

        {/* Product Details & Purchase Form */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
              <span>{product?.category || "Category"}</span>
              <span>•</span>
              <span className="text-slate-500">
                {product && product.weightGrams >= 1000 ? `${(product.weightGrams / 1000).toFixed(1)} kg` : `${product?.weightGrams || 0} grams`}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {product?.name || "Product Name"}
            </h1>

            {/* Pricing */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{priceFormatted}</span>
              {mrpFormatted && mrpFormatted !== priceFormatted && (
                <span className="text-sm text-slate-400 line-through font-medium">MRP {mrpFormatted}</span>
              )}
              {discountPercent > 0 && product && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Save {formatINR((product.mrpPaise || 0) - (product.pricePaise || product.priceCents || 0))}
                </span>
              )}
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {product?.description || "Product description"}
            </p>

            {/* Drone Delivery Specs Pill */}
            <div className="p-4 rounded-2xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900/50 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-700 dark:text-brand-300">
                <DroneIcon size={16} />
                <span>Autonomous AirDrop Delivery Features:</span>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pl-5 list-disc">
                <li>Estimated transit time: <strong>12–15 minutes</strong></li>
                <li>Package weight: <strong>{product?.weightGrams || 0}g</strong> (Operational drone limit: 4,000g)</li>
                <li>Rooftop / Lawn laser-guided winch touchdown</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  -
                </button>
                <span className="w-10 text-center text-sm font-bold text-slate-900 dark:text-slate-100">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={isActionLoading || !product}
                onClick={handleAddToCart}
                className="flex-1 py-3.5 px-6 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <ShoppingCartIcon size={18} />
                <span>Add to Cart</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isActionLoading || !product}
              onClick={handleBuyNow}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 transition active:scale-[0.99] disabled:opacity-50"
            >
              <ZapIcon size={18} />
              <span>Instant Drone Checkout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
