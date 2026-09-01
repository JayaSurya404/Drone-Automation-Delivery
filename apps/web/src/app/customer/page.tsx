"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ProductResponse } from "@skynav/contracts";
import { ProductCard } from "../../components/commerce/product-card";
import { DroneIcon, SearchIcon, ZapIcon, CheckIcon } from "@skynav/ui";

const CATEGORIES = [
  "All",
  "Groceries",
  "Daily Essentials",
  "Snacks & Beverages",
  "Personal Care",
  "Household Essentials",
  "Pharmacy & Wellness",
  "Small Electronics"
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CustomerStorePage() {
  let searchParamQuery = "";
  try {
    const sp = useSearchParams();
    if (sp) searchParamQuery = sp.get("search") || "";
  } catch {}

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [localSearch, setLocalSearch] = useState<string>(searchParamQuery);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalSearch(searchParamQuery);
  }, [searchParamQuery]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/v1/products?limit=100`);
      if (!res.ok) throw new Error("Failed to load products");
      const json = await res.json();
      setProducts(json.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load product catalog");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategory === "All" || p.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !localSearch.trim() ||
        p.name.toLowerCase().includes(localSearch.toLowerCase()) ||
        p.description.toLowerCase().includes(localSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(localSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, localSearch]);

  const dailyEssentials = useMemo(
    () => products.filter((p) => p.category === "Daily Essentials"),
    [products]
  );
  const groceries = useMemo(
    () => products.filter((p) => p.category === "Groceries"),
    [products]
  );
  const snacks = useMemo(
    () => products.filter((p) => p.category === "Snacks & Beverages"),
    [products]
  );

  return (
    <div className="space-y-8 pb-16">
      {/* Quick-Commerce Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 shadow-2xl border border-indigo-900/50">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-300 text-xs font-bold tracking-wide">
            <ZapIcon size={14} className="text-amber-400" />
            <span>INSTANT AUTONOMOUS AIRDROP • BENGALURU & METRO CORRIDORS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Daily Essentials Delivered in{" "}
            <span className="bg-gradient-to-r from-amber-300 via-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              12–15 Minutes
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Fresh milk, atta, tea, medicines, and snacks dropped smoothly directly onto your rooftop or garden landing marker.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckIcon size={12} />
              </span>
              ₹0 Delivery on ₹499+
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckIcon size={12} />
              </span>
              Precision Landing Guarantee
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckIcon size={12} />
              </span>
              Up to 4.0 kg Flight Capacity
            </div>
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex items-center justify-center w-48 h-48 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          <DroneIcon size={80} className="text-brand-400 animate-pulse" />
        </div>
      </section>

      {/* Category Navigation Pills */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
            Shop by Category
          </h2>
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch("");
                setSelectedCategory("All");
              }}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition shadow-sm ${
                  isSelected
                    ? "bg-brand-600 text-white shadow-brand-500/25"
                    : "bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Dynamic Products Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>{selectedCategory === "All" ? "All Products" : selectedCategory}</span>
            <span className="text-xs font-normal text-slate-400">({filteredProducts.length} items)</span>
          </h3>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl">
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
            <button
              type="button"
              onClick={loadProducts}
              className="mt-3 px-4 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-500 transition"
            >
              Retry
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-12 text-center bg-surface-card dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No products found</p>
            <p className="text-xs text-slate-500 mt-1">Try searching for other groceries, beverages or essentials.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Featured Section: Popular Daily Essentials */}
      {!localSearch && selectedCategory === "All" && dailyEssentials.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>⚡ Popular Daily Essentials</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fresh milk, bread, eggs, curd & mineral water</p>
            </div>
            <button
              onClick={() => setSelectedCategory("Daily Essentials")}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {dailyEssentials.slice(0, 6).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Featured Section: Fresh Groceries & Staples */}
      {!localSearch && selectedCategory === "All" && groceries.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                🌾 Kitchen Groceries & Staples
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Atta, Basmati rice, pulses, cooking oils and salts</p>
            </div>
            <button
              onClick={() => setSelectedCategory("Groceries")}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {groceries.slice(0, 6).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Featured Section: Snacks & Beverages */}
      {!localSearch && selectedCategory === "All" && snacks.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                ☕ Snacks, Tea & Quick Bites
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tata Tea Gold, Nescafe, Maggi, Haldiram's Bhujia & chocolates</p>
            </div>
            <button
              onClick={() => setSelectedCategory("Snacks & Beverages")}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {snacks.slice(0, 6).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
