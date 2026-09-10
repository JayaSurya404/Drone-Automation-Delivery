import React, { useState, useEffect, useCallback } from 'react';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Zap,
  Tag,
  Scale,
  Layers,
  Archive,
  Eye,
} from 'lucide-react';

interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category_id: string;
  category_name?: string;
  sub_category?: string;
  description?: string;
  price: number;
  stock_count: number;
  weight_grams: number;
  is_drone_eligible: number;
  is_active: number;
  image: string;
  badge?: string;
  created_at?: string;
  updated_at?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export const ProductsPage: React.FC = () => {
  const { addToast } = useToast();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: 'SkyNav Direct',
    categoryId: 'cat_elec',
    subCategory: 'General',
    description: '',
    price: '999',
    stockCount: '50',
    weightGrams: '350',
    isDroneEligible: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600',
    badge: 'New Arrival',
  });

  // Fetch Products & Categories
  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prodsRes, catsRes] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/admin/products/categories'),
      ]);

      if (prodsRes.ok) {
        const prods = await prodsRes.json();
        setProducts(prods);
      }

      if (catsRes.ok) {
        const cats = await catsRes.json();
        setCategories(cats);
      }
    } catch (err) {
      console.error('Failed to load products from admin backend:', err);
      addToast('error', 'Network error: could not connect to admin product services.');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const openCreateModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setFormData({
      name: '',
      brand: 'SkyNav Direct',
      categoryId: categories[0]?.id || 'cat_elec',
      subCategory: 'General',
      description: 'Autonomous flight-ready product packaged in certified aerial pod.',
      price: '999',
      stockCount: '50',
      weightGrams: '350',
      isDroneEligible: true,
      isActive: true,
      image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600',
      badge: 'New Arrival',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: AdminProduct) => {
    setIsEditing(true);
    setCurrentId(p.id);
    setFormData({
      name: p.name,
      brand: p.brand || 'SkyNav Direct',
      categoryId: p.category_id,
      subCategory: p.sub_category || 'General',
      description: p.description || '',
      price: p.price.toString(),
      stockCount: p.stock_count.toString(),
      weightGrams: p.weight_grams.toString(),
      isDroneEligible: Boolean(p.is_drone_eligible),
      isActive: Boolean(p.is_active),
      image: p.image || '',
      badge: p.badge || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price) {
      addToast('error', 'Product name and price are mandatory.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        categoryId: formData.categoryId,
        subCategory: formData.subCategory.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        stockCount: parseInt(formData.stockCount) || 0,
        weightGrams: parseInt(formData.weightGrams) || 100,
        isDroneEligible: formData.isDroneEligible,
        isActive: formData.isActive,
        image: formData.image.trim(),
        badge: formData.badge.trim() || null,
      };

      const url = isEditing && currentId ? `/api/admin/products/${currentId}` : '/api/admin/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Request failed.' }));
        throw new Error(errorData.error || 'Failed to save product.');
      }

      addToast(
        'success',
        isEditing
          ? `Product "${formData.name}" updated & synced to customer catalog!`
          : `Product "${formData.name}" created & synced to customer database!`
      );
      setIsModalOpen(false);
      fetchCatalog();
    } catch (err: any) {
      addToast('error', err.message || 'Operation failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!window.confirm(`Archive and deactivate "${name}" from customer catalog?`)) return;

    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to archive product.');
      addToast('success', `Product "${name}" archived from active catalog.`);
      fetchCatalog();
    } catch (err: any) {
      addToast('error', err.message || 'Could not archive product.');
    }
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || p.category_id === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Calculate Metrics
  const totalItems = products.length;
  const activeItems = products.filter((p) => p.is_active === 1).length;
  const lowStockCount = products.filter((p) => p.stock_count <= 10).length;
  const totalStockUnits = products.reduce((acc, p) => acc + p.stock_count, 0);

  const columns: Column<AdminProduct>[] = [
    {
      header: 'Product',
      accessor: (p) => (
        <div className="flex items-center gap-3">
          <img
            src={p.image}
            alt={p.name}
            className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200';
            }}
          />
          <div>
            <div className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
              <span>{p.name}</span>
              {p.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {p.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 font-mono block">
              {p.brand} • {p.id}
            </span>
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Category',
      accessor: (p) => (
        <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          {p.category_name || p.category_id}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Price (INR)',
      accessor: (p) => (
        <span className="font-bold text-emerald-400 text-xs font-mono">
          ₹{p.price.toLocaleString('en-IN')}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Weight',
      accessor: (p) => (
        <div className="text-xs">
          <span className="font-mono text-slate-200">{p.weight_grams} g</span>
          {p.is_drone_eligible ? (
            <span className="text-[10px] text-cyan-400 block font-semibold">✓ Drone Ready</span>
          ) : (
            <span className="text-[10px] text-amber-400 block font-semibold">⚠ Heavy Cargo</span>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Stock',
      accessor: (p) => (
        <div>
          <span
            className={`font-mono text-xs font-bold ${
              p.stock_count <= 10 ? 'text-rose-400' : 'text-slate-200'
            }`}
          >
            {p.stock_count} units
          </span>
          {p.stock_count <= 10 && (
            <span className="text-[10px] text-rose-400 block font-semibold">Low Stock</span>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Catalog Status',
      accessor: (p) => (
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
            p.is_active
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {p.is_active ? 'Active' : 'Archived'}
        </span>
      ),
      sortable: true,
    },
    {
      header: 'Actions',
      accessor: (p) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openEditModal(p)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title="Edit Product"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          {p.is_active === 1 && (
            <button
              type="button"
              onClick={() => handleArchive(p.id, p.name)}
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
              title="Archive Product"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="h-5 w-5 text-cyan-400" /> Product Catalog & Inventory Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Authoritative source of product truth. Changes persist to <code className="text-cyan-400 font-mono">admin.db</code> and synchronize instantly to Customer Storefront.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchCatalog}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white transition-colors"
            title="Refresh Catalog"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-black font-bold text-xs hover:opacity-90 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Products</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-xl font-black text-slate-100 mt-1 block">{totalItems}</span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Configured in admin catalog</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live in Store</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-xl font-black text-emerald-400 mt-1 block">{activeItems}</span>
          <span className="text-[10px] text-emerald-500/80 mt-0.5 block">Visible to customer storefront</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Stock Units</span>
            <Package className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-xl font-black text-slate-100 mt-1 block">{totalStockUnits}</span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Physical warehouse inventory</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Low Stock Watch</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xl font-black text-amber-400 mt-1 block">{lowStockCount}</span>
          <span className="text-[10px] text-amber-500/80 mt-0.5 block">Items with &le; 10 units</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search products by name, brand, or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-semibold"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Data Table */}
      <DataTable
        title="Admin Authoritative Products Table"
        columns={columns}
        data={filteredProducts}
        searchable={false}
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Product & Push Catalog Sync' : 'Add New Indian Catalog Product'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-200">
          <p className="text-slate-400 text-[11px]">
            Changes persist directly to <code className="text-cyan-400">admin.db</code> and automatically sync across the secure integration bridge to <code className="text-cyan-400">customer.db</code>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-300 block mb-1">Product Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. BoAt Storm GaN 65W Rapid Fast Charger"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Brand Name</label>
              <input
                type="text"
                placeholder="e.g. boAt, Apollo, Aavin"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Category *</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-semibold"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Price in INR (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="1299"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Stock Count</label>
              <input
                type="number"
                required
                placeholder="50"
                value={formData.stockCount}
                onChange={(e) => setFormData({ ...formData, stockCount: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Payload Weight (grams) *</label>
              <input
                type="number"
                required
                placeholder="350"
                value={formData.weightGrams}
                onChange={(e) => setFormData({ ...formData, weightGrams: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Promotional Badge</label>
              <input
                type="text"
                placeholder="e.g. Best Seller, Urgent Dispatch, Fresh Daily"
                value={formData.badge}
                onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-300 block mb-1">Product Image URL</label>
              <input
                type="url"
                required
                placeholder="https://images.unsplash.com/..."
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-300 block mb-1">Product Description</label>
              <textarea
                rows={2}
                placeholder="Technical specifications and delivery packaging information..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDroneEligible"
                checked={formData.isDroneEligible}
                onChange={(e) => setFormData({ ...formData, isDroneEligible: e.target.checked })}
                className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-cyan-500 h-4 w-4"
              />
              <label htmlFor="isDroneEligible" className="font-semibold text-slate-300 cursor-pointer">
                Autonomous Drone Eligible (&le; 5.0 kg)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-cyan-500 h-4 w-4"
              />
              <label htmlFor="isActive" className="font-semibold text-slate-300 cursor-pointer">
                Publish Active in Customer Store
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-black font-bold text-xs hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving & Syncing…
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Publish Product'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default ProductsPage;
