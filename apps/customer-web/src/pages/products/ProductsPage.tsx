import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCategory, Product } from '../../types/product';
import { api } from '../../services/api';
import { ProductCard } from '../../components/products/ProductCard';
import { CategoryNav } from '../../components/products/CategoryNav';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { Search, Sparkles, Zap, ArrowUpDown, X, AlertTriangle, RefreshCw } from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = (searchParams.get('category') as ProductCategory) || 'All';
  const initialSearch = searchParams.get('search') || '';
  const dealsOnly = searchParams.get('deals') === 'true';

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'rating' | 'speed'>('popular');
  const [maxSpeedFilter, setMaxSpeedFilter] = useState<number>(0); // 0 means any
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state with URL params
  useEffect(() => {
    const cat = (searchParams.get('category') as ProductCategory) || 'All';
    const s = searchParams.get('search') || '';
    setSelectedCategory(cat);
    setSearchQuery(s);
  }, [searchParams]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.products.getAll({
        category: selectedCategory,
        search: searchQuery,
        sort: sortBy,
        maxSpeed: maxSpeedFilter > 0 ? maxSpeedFilter : undefined,
        deals: dealsOnly,
      });

      let filtered = [...data];

      if (dealsOnly) {
        filtered = filtered.filter(p => p.discountPercent && p.discountPercent >= 20);
      }

      if (maxSpeedFilter > 0) {
        filtered = filtered.filter(p => p.estimatedDeliveryMins <= maxSpeedFilter);
      }

      if (sortBy === 'speed') {
        filtered.sort((a, b) => a.estimatedDeliveryMins - b.estimatedDeliveryMins);
      }

      setProducts(filtered);
    } catch (err: any) {
      console.error('Failed to load products:', err);
      setError(err?.message || 'Unable to load products from catalog database.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery, sortBy, dealsOnly, maxSpeedFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleCategorySelect = (cat: ProductCategory | 'All') => {
    setSelectedCategory(cat);
    const newParams = new URLSearchParams(searchParams);
    if (cat === 'All') {
      newParams.delete('category');
    } else {
      newParams.set('category', cat);
    }
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setMaxSpeedFilter(0);
    setSortBy('popular');
    setSearchParams({});
  };

  return (
    <div className="main-content ecom-products-catalog-page">
      {/* ── Header ── */}
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div className="section-label">
          <Sparkles size={14} color="#0ea5e9" /> Autonomous Aero Marketplace
        </div>
        <h1 style={{ margin: '0.2rem 0 0.35rem', letterSpacing: '-0.03em' }}>
          {selectedCategory === 'All' ? 'All Marketplace Products' : `${selectedCategory} Collection`}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
          {isLoading
            ? 'Scanning autonomous drone dispatch centers...'
            : `${products.length} product${products.length === 1 ? '' : 's'} available for immediate aerial delivery.`}
        </p>
      </div>

      {/* ── Category Pills Nav ── */}
      <CategoryNav
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
      />

      {/* ── Active Filter Bar & Controls ── */}
      <div className="ecom-filter-toolbar">
        {/* Left: Active Search Tag & Count */}
        <div className="filter-status-left">
          <span className="results-count-text">
            Showing <strong>{products.length}</strong> items
            {selectedCategory !== 'All' && <span> in <em>{selectedCategory}</em></span>}
          </span>
          {searchQuery && (
            <div className="active-filter-chip">
              <span>Keyword: "{searchQuery}"</span>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  const np = new URLSearchParams(searchParams);
                  np.delete('search');
                  setSearchParams(np);
                }}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {dealsOnly && (
            <div className="active-filter-chip highlight">
              <span>⚡ Flash Air Deals</span>
              <button
                type="button"
                onClick={() => {
                  const np = new URLSearchParams(searchParams);
                  np.delete('deals');
                  setSearchParams(np);
                }}
                aria-label="Clear deals filter"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Right: Speed Filter Buttons & Sort Dropdown */}
        <div className="filter-controls-right">
          {/* Speed Toggles */}
          <div className="speed-filter-group">
            <span className="speed-filter-label">
              <Zap size={13} fill="#0ea5e9" color="#0ea5e9" /> Speed:
            </span>
            <button
              type="button"
              className={`speed-pill-btn ${maxSpeedFilter === 10 ? 'active' : ''}`}
              onClick={() => setMaxSpeedFilter(prev => (prev === 10 ? 0 : 10))}
            >
              &lt; 10 min
            </button>
            <button
              type="button"
              className={`speed-pill-btn ${maxSpeedFilter === 15 ? 'active' : ''}`}
              onClick={() => setMaxSpeedFilter(prev => (prev === 15 ? 0 : 15))}
            >
              &lt; 15 min
            </button>
          </div>

          {/* Sort Selector */}
          <div className="sort-select-wrapper">
            <ArrowUpDown size={14} className="sort-icon" />
            <select
              className="sort-select-input"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              aria-label="Sort products"
            >
              <option value="popular">Most Popular</option>
              <option value="speed">Fastest Drone Delivery</option>
              <option value="rating">Highest Customer Rating</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Product Grid & States ── */}
      {isLoading ? (
        <div className="products-grid">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <Skeleton height={200} borderRadius="0" />
              <div style={{ padding: '1.25rem' }}>
                <Skeleton width="35%" height={14} className="mb-2" />
                <Skeleton width="85%" height={20} className="mb-2" />
                <Skeleton width="100%" height={32} className="mb-4" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton width="30%" height={24} />
                  <Skeleton width="35%" height={36} borderRadius="var(--radius-md)" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: '2rem 1rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <EmptyState
            icon={<AlertTriangle size={40} color="#ef4444" />}
            title="Unable to load products"
            description={error}
            actionText="Try Again"
            onAction={loadProducts}
          />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Search size={36} color="var(--accent-blue)" />}
          title={selectedCategory !== 'All' ? 'No products in this category yet' : 'No Matching Products'}
          description={
            selectedCategory !== 'All'
              ? `We currently do not have active inventory in ${selectedCategory}. Check back soon or browse all categories.`
              : `We couldn't find any products matching your filters. Try clearing your search keyword or selected speed.`
          }
          actionText={selectedCategory !== 'All' ? 'View All Products' : 'Reset All Filters'}
          onAction={handleClearFilters}
        />
      ) : (
        <div className="products-grid">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};
