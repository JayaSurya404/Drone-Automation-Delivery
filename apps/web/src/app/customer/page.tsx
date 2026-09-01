"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { ProductResponse } from "@skynav/contracts";
import { ProductCard } from "../../components/commerce/product-card";
import { DroneIcon, SparklesIcon, ZapIcon, FilterIcon, RefreshIcon } from "@skynav/ui";

const CATEGORIES = [
  "All",
  "Groceries",
  "Pharmacy",
  "Food & Beverages",
  "Electronics",
  "Essentials",
  "Emergency Supplies",
  "Documents"
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CustomerStorefrontPage() {
  let searchParamQuery = "";
  try {
    const searchParams = useSearchParams();
    searchParamQuery = searchParams.get("search") || "";
  } catch {}
  let router: any = { push: () => {}, replace: () => {} };
  try { router = useRouter(); } catch {}

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE_URL}/api/v1/products`);
      if (selectedCategory !== "All") {
        url.searchParams.set("category", selectedCategory);
      }
      if (searchParamQuery) {
        url.searchParams.set("search", searchParamQuery);
      }
      url.searchParams.set("limit", "50");

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
      } else {
        setError("Failed to load products from store database.");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading store catalog.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchParamQuery]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Delivery Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-brand-950 to-indigo-950 text-white p-6 sm:p-10 border border-slate-800 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-xs font-semibold text-cyan-300">
            <SparklesIcon size={14} />
            <span>Autonomous Aerial Logistics</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Order Groceries, Pharmacy & Essentials Dropped by Drone in 15 Mins
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Ultra-fast precision delivery straight to your designated rooftop or landing pad marker. Zero traffic delays, 100% electric.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Fleet Active in San Francisco Corridor</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold">
              <ZapIcon size={14} />
              <span>Free Delivery on Orders Over $35</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition duration-200 ${
                isSelected
                  ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                  : "bg-surface-card dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-brand-400 hover:text-brand-600"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Store Catalog Content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{selectedCategory === "All" ? "Featured Products" : selectedCategory}</span>
              {searchParamQuery && (
                <span className="text-xs font-normal text-slate-500">
                  matching &quot;{searchParamQuery}&quot;
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified drone-payload compliant products ready for instant flight dispatch
            </p>
          </div>

          <button
            type="button"
            onClick={fetchProducts}
            className="p-2 text-slate-500 hover:text-brand-600 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refresh Products"
          >
            <RefreshIcon size={16} />
          </button>
        </div>

        {/* Loading / Error / Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-72 rounded-2xl bg-slate-200 dark:bg-slate-800/60 animate-pulse border border-slate-100 dark:border-slate-800"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl">
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
            <button
              type="button"
              onClick={fetchProducts}
              className="mt-3 px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg shadow"
            >
              Try Again
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <DroneIcon size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No products found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              {searchParamQuery
                ? `We couldn't find any products matching "${searchParamQuery}". Try adjusting your search or category.`
                : "No products are currently available in this category."}
            </p>
            {searchParamQuery && (
              <button
                type="button"
                onClick={() => router.push("/customer")}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl transition"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
