import React from 'react';
import { ProductCategory } from '../../types/product';
import { Sparkles, Utensils, ShoppingBasket, Pill, FileText, Smartphone, Layers } from 'lucide-react';

interface CategoryNavProps {
  selectedCategory: ProductCategory | 'All';
  onSelectCategory: (category: ProductCategory | 'All') => void;
}

const CATEGORIES: { id: ProductCategory | 'All'; label: string; icon: React.ReactNode }[] = [
  { id: 'All', label: 'All Items', icon: <Sparkles size={16} /> },
  { id: 'Medicine', label: 'Medicine & Urgent Care', icon: <Pill size={16} /> },
  { id: 'Food', label: 'Hot Food & Dining', icon: <Utensils size={16} /> },
  { id: 'Groceries', label: 'Fresh Groceries', icon: <ShoppingBasket size={16} /> },
  { id: 'Electronics', label: 'Tech & Cables', icon: <Smartphone size={16} /> },
  { id: 'Documents', label: 'Secure Documents', icon: <FileText size={16} /> },
  { id: 'Other', label: 'Pet & Home Essentials', icon: <Layers size={16} /> },
];

export const CategoryNav: React.FC<CategoryNavProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem',
        marginBottom: '1.5rem',
        scrollbarWidth: 'none',
      }}
    >
      {CATEGORIES.map((cat) => {
        const isSelected = selectedCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.1rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.875rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: isSelected
                ? 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-blue) 100%)'
                : 'var(--bg-card)',
              color: isSelected ? '#050a14' : 'var(--text-secondary)',
              border: isSelected
                ? '1px solid rgba(255, 255, 255, 0.4)'
                : '1px solid var(--border-default)',
              boxShadow: isSelected ? '0 0 15px var(--accent-cyan-glow)' : 'none',
              transition: 'all var(--transition-fast)',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
};
