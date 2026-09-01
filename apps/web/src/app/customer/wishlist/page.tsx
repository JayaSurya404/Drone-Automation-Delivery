"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "../../../features/commerce/cart-context";
import { HeartIcon, ShoppingCartIcon, TrashIcon, ChevronRightIcon } from "@skynav/ui";

export default function CustomerWishlistPage() {
  const { wishlist, addToCart, removeFromWishlist, isLoadingWishlist } = useCart();

  if (isLoadingWishlist) {
    return (
      <div className="py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!wishlist || wishlist.items.length === 0) {
    return (
      <div className="text-center py-20 bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm animate-in fade-in duration-300">
        <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
          <HeartIcon size={40} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Your Wishlist is Empty</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2">
          Save your favorite groceries, medical essentials, and snacks for fast 1-click drone delivery later.
        </p>
        <Link
          href="/customer"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-2xl shadow-lg shadow-brand-500/25 transition"
        >
          <span>Browse Products</span>
          <ChevronRightIcon size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Saved Wishlist</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {wishlist.total} saved items ready for instant drone ordering
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {wishlist.items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col justify-between bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition"
          >
            <div>
              <Link href={`/customer/products/${item.product.id}`} className="block relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3">
                <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
              </Link>
              <div className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-1">
                {item.product.category}
              </div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-1">
                {item.product.name}
              </h4>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">
                ${(item.product.priceCents / 100).toFixed(2)}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={async () => {
                  await addToCart(item.product, 1);
                  await removeFromWishlist(item.product.id);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <ShoppingCartIcon size={14} />
                <span>Move to Cart</span>
              </button>
              <button
                type="button"
                onClick={() => removeFromWishlist(item.product.id)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 transition"
                aria-label="Remove"
              >
                <TrashIcon size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
