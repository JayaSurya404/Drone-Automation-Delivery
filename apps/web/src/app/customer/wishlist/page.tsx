"use client";

import React from "react";
import Link from "next/link";
import { useCart, formatINR } from "../../../features/commerce/cart-context";
import { HeartIcon, ShoppingCartIcon, TrashIcon, ArrowLeftIcon } from "@skynav/ui";

export default function WishlistPage() {
  const { wishlist, removeFromWishlist, addToCart, isLoadingWishlist } = useCart();
  const items = wishlist?.items || [];

  if (items.length === 0 && !isLoadingWishlist) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
          <HeartIcon size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Your Wishlist is Empty</h2>
        <p className="text-xs text-slate-500">
          Save your favorite Indian groceries and snacks to order anytime with 1-click drone delivery.
        </p>
        <Link
          href="/customer"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md transition"
        >
          Explore Catalog
        </Link>
      </div>
    );
  }

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
          Saved Wishlist ({items.length})
        </h1>
        <p className="text-xs text-slate-500">Your bookmarked products</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((item) => {
          const p = item.product;
          const price = formatINR(p.pricePaise || p.priceCents || 0);

          return (
            <div
              key={item.id}
              className="bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
            >
              <img
                src={p.imageUrl}
                alt={p.name}
                className="w-full aspect-square object-cover rounded-xl bg-slate-100 dark:bg-slate-800"
              />
              <div>
                <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase">{p.category}</span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">{p.name}</h4>
                <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1">{price}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => addToCart(p, 1)}
                  className="flex-1 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
                >
                  <ShoppingCartIcon size={14} /> Add to Cart
                </button>
                <button
                  type="button"
                  onClick={() => removeFromWishlist(p.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                  aria-label="Remove"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
