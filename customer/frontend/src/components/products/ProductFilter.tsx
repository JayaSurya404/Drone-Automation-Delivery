import React from 'react';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { Input } from '../common/Input';

interface ProductFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'price-asc' | 'price-desc' | 'rating' | 'popular' | 'newest';
  onSortChange: (sort: 'price-asc' | 'price-desc' | 'rating' | 'popular' | 'newest') => void;
  totalResults: number;
}

export const ProductFilter: React.FC<ProductFilterProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  totalResults,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      {/* Search Input */}
      <div style={{ flex: '1 1 300px', maxWidth: '480px' }}>
        <Input
          placeholder="Search food, medicine, groceries, urgent tech..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search size={18} />}
          style={{ marginBottom: 0 }}
        />
      </div>

      {/* Results Count & Sort Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{totalResults}</strong> drone-ready items
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowUpDown size={16} color="var(--text-tertiary)" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="form-control"
            style={{
              padding: '0.55rem 0.85rem',
              fontSize: '0.85rem',
              width: 'auto',
              cursor: 'pointer',
            }}
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Newest Additions</option>
          </select>
        </div>
      </div>
    </div>
  );
};
