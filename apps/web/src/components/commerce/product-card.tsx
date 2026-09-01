"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { ProductResponse } from "@skynav/contracts";
import { useCart, formatINR } from "../../features/commerce/cart-context";
import { HeartIcon, ShoppingCartIcon, PlusIcon, MinusIcon, ZapIcon } from "@skynav/ui";

interface ProductCardProps {
  product: ProductResponse;
}

export function ProductCard({ product }: ProductCardProps) {
  const { cart, addToCart, updateCartQuantity, removeCartItem, addToWishlist, removeFromWishlist, isInWishlist } = useCart();
  const [isUpdating, setIsUpdating] = useState(false);

  const inWish = isInWishlist(product.id);
  const cartItem = cart?.items.find((i) => i.productId === product.id);
  const quantity = cartItem?.quantity || 0;

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inWish) {
      await removeFromWishlist(product.id);
    } else {
      await addToWishlist(product);
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsUpdating(true);
    try {
      await addToCart(product, 1);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleIncrease = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cartItem) return;
    setIsUpdating(true);
    try {
      await updateCartQuantity(cartItem.id, quantity + 1);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDecrease = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cartItem) return;
    setIsUpdating(true);
    try {
      if (quantity === 1) {
        await removeCartItem(cartItem.id);
      } else {
        await updateCartQuantity(cartItem.id, quantity - 1);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const priceFormatted = formatINR(product.pricePaise || product.priceCents || 0);
  const mrpFormatted = product.mrpPaise ? formatINR(product.mrpPaise) : null;
  const discountPercent = product.discountPercent || (product.mrpPaise && product.mrpPaise > (product.pricePaise || 0)
    ? Math.round(((product.mrpPaise - (product.pricePaise || 0)) / product.mrpPaise) * 100)
    : 0);

  return (
    <div className="group relative flex flex-col justify-between bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500/50 dark:hover:border-brand-500/50 rounded-2xl p-4 shadow-sm hover:shadow-xl transition duration-300 overflow-hidden">
      <div>
        {/* Image Container */}
        <Link href={`/customer/products/${product.id}`} className="block relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
            loading="lazy"
          />
          {/* Wishlist Heart Button */}
          <button
            type="button"
            onClick={handleToggleWishlist}
            className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition shadow-md ${
              inWish
                ? "bg-rose-500 text-white"
                : "bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-rose-500"
            }`}
            aria-label="Wishlist"
          >
            <HeartIcon size={16} />
          </button>

          {/* Discount Badge */}
          {discountPercent > 0 && (
            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow">
              {discountPercent}% OFF
            </div>
          )}

          {/* Delivery ETA Badge */}
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950/80 backdrop-blur-md text-[11px] font-medium text-emerald-400 shadow">
            <ZapIcon size={12} className="text-amber-400" />
            <span>12-15m Drone Drop</span>
          </div>
        </Link>

        {/* Category & Weight */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span className="font-medium text-brand-600 dark:text-brand-400 uppercase tracking-wider text-[10px]">
            {product.category}
          </span>
          <span className="font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
            {product.weightGrams >= 1000 ? `${(product.weightGrams / 1000).toFixed(1)}kg` : `${product.weightGrams}g`}
          </span>
        </div>

        {/* Title */}
        <Link href={`/customer/products/${product.id}`} className="block">
          <h4 className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition text-sm">
            {product.name}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 min-h-[32px]">
            {product.description}
          </p>
        </Link>
      </div>

      {/* Pricing & Cart Action */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-black text-slate-900 dark:text-slate-100">{priceFormatted}</span>
            {mrpFormatted && mrpFormatted !== priceFormatted && (
              <span className="text-xs text-slate-400 line-through">{mrpFormatted}</span>
            )}
          </div>
        </div>

        {quantity > 0 ? (
          <div className="flex items-center gap-1.5 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 rounded-lg p-0.5">
            <button
              type="button"
              disabled={isUpdating}
              onClick={handleDecrease}
              className="p-1 rounded text-brand-700 dark:text-brand-300 hover:bg-brand-200/50 dark:hover:bg-brand-800/50 transition disabled:opacity-50"
              aria-label="Decrease quantity"
            >
              <MinusIcon size={14} />
            </button>
            <span className="w-6 text-center text-xs font-bold text-brand-700 dark:text-brand-300">{quantity}</span>
            <button
              type="button"
              disabled={isUpdating}
              onClick={handleIncrease}
              className="p-1 rounded text-brand-700 dark:text-brand-300 hover:bg-brand-200/50 dark:hover:bg-brand-800/50 transition disabled:opacity-50"
              aria-label="Increase quantity"
            >
              <PlusIcon size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isUpdating}
            onClick={handleAddToCart}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-95 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            <ShoppingCartIcon size={14} />
            <span>Add</span>
          </button>
        )}
      </div>
    </div>
  );
}
