import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Package,
  Bell,
  LogOut,
  User as UserIcon,
  MapPin,
  HelpCircle,
  Radio,
  Search,
  Heart,
  ChevronDown,
  X,
  Sparkles,
  Zap,
  Tag,
  Clock,
  ArrowRight,
  Plane,
  Menu,
  ShieldCheck,
  PhoneCall,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import { useOrders } from '../../context/OrderContext';
import { useAddress } from '../../context/AddressContext';
import { LocationModal } from './LocationModal';
import { Button } from './Button';
import { INITIAL_PRODUCTS } from '../../services/mockData';
import { Product } from '../../types/product';

const POPULAR_SEARCHES = [
  'GaN Fast Charger',
  'First Aid Kit',
  'Artisan Pizza',
  'Cold Brew',
  'Wireless Earbuds',
  'Organic Avocados',
  'Legal Courier Pouch',
  'Glucose Monitor',
];

const SIDE_CATEGORIES = [
  { label: 'All Products', path: '/products', icon: '🛍️' },
  { label: 'Pharmacy & Medicine', path: '/products?category=Medicine', icon: '💊', eta: '8–11m' },
  { label: 'Hot Gourmet Meals', path: '/products?category=Food', icon: '🍕', eta: '12–15m' },
  { label: 'Fresh Groceries', path: '/products?category=Groceries', icon: '🥑', eta: '10–14m' },
  { label: 'Tech & Electronics', path: '/products?category=Electronics', icon: '⚡', eta: '10–12m' },
  { label: 'Instant Documents', path: '/products?category=Documents', icon: '📄', eta: '8–10m' },
  { label: 'Daily Essentials', path: '/products?category=Other', icon: '✨', eta: '10–15m' },
];

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { itemCount, subtotal } = useCart();
  const { wishlistCount } = useWishlist();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const { activeOrder } = useOrders();
  const { defaultAddress } = useAddress();
  const navigate = useNavigate();

  // Drawer & Menus state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<Product[]>([]);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close user menu or search on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock body scroll when side drawer is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  // Real-time search suggestions
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const filtered = INITIAL_PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    ).slice(0, 5);

    setSearchSuggestions(filtered);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchOpen(false);
    navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleSuggestionClick = (prod: Product) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/products/${prod.id}`);
  };

  const handlePopularSearchClick = (term: string) => {
    setSearchQuery(term);
    setIsSearchOpen(false);
    navigate(`/products?search=${encodeURIComponent(term)}`);
  };

  return (
    <>
      {/* ══════════════════════════════════════════
          CLEAN, STREAMLINED TOP BAR
      ══════════════════════════════════════════ */}
      <header className="clean-top-navbar">
        <div className="clean-navbar-inner">

          {/* ── Left: Menu Drawer Toggle + Logo ── */}
          <div className="navbar-left-group">
            <button
              type="button"
              className="navbar-menu-toggle-btn"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open side navigation menu"
              title="Menu & Delivery Options"
            >
              <Menu size={22} />
              <span className="menu-btn-label">Menu</span>
            </button>

            <Link to="/dashboard" className="clean-brand-logo">
              <div className="clean-logo-icon">
                <Plane size={20} className="plane-icon" />
              </div>
              <div className="clean-brand-text">
                <span className="brand-name">SkyLink</span>
                <span className="brand-badge">DRONE STORE</span>
              </div>
            </Link>
          </div>

          {/* ── Center: Prominent Search Bar ── */}
          <div className="navbar-center-search" ref={searchContainerRef}>
            <form onSubmit={handleSearchSubmit} className="clean-search-form">
              <Search size={18} className="search-icon-prefix" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search products, categories, first aid, tech, pizza..."
                className="clean-search-input"
                aria-label="Search products"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="search-clear-btn"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
              <button type="submit" className="clean-search-btn" aria-label="Search">
                Search
              </button>
            </form>

            {/* ── Search Dropdown Suggestions ── */}
            {isSearchOpen && (
              <div className="clean-search-dropdown">
                {searchSuggestions.length > 0 ? (
                  <div className="search-results-box">
                    <div className="search-header-label">
                      <Sparkles size={13} /> Matching Products
                    </div>
                    {searchSuggestions.map((prod) => (
                      <div
                        key={prod.id}
                        className="search-result-item"
                        onClick={() => handleSuggestionClick(prod)}
                      >
                        <img src={prod.image} alt={prod.name} className="result-thumb" />
                        <div className="result-info">
                          <div className="result-title">{prod.name}</div>
                          <div className="result-meta">
                            <span className="result-cat">{prod.category}</span>
                            {prod.isDroneEligible && (
                              <span className="result-eta">
                                <Zap size={10} fill="#0284c7" color="#0284c7" /> ~{prod.estimatedDeliveryMins}m by Air
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="result-price">${prod.price.toFixed(2)}</div>
                      </div>
                    ))}
                    <div className="search-see-all-row" onClick={handleSearchSubmit}>
                      <span>See all results for "{searchQuery}"</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                ) : searchQuery.trim() ? (
                  <div className="search-empty-box">
                    <p>No products found for "{searchQuery}"</p>
                    <span>Try searching for GaN charger, pizza, cold brew, or first aid</span>
                  </div>
                ) : (
                  <div className="search-popular-box">
                    <div className="search-header-label">
                      <Tag size={13} /> Popular Searches
                    </div>
                    <div className="popular-tags-flow">
                      {POPULAR_SEARCHES.map((term) => (
                        <button
                          key={term}
                          type="button"
                          className="popular-tag-btn"
                          onClick={() => handlePopularSearchClick(term)}
                        >
                          <Search size={12} /> {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right: Wishlist, Cart, Profile (User Requested) ── */}
          <div className="navbar-right-actions">
            {/* Wishlist */}
            <Link to="/wishlist" className="navbar-action-btn" title="Saved Wishlist">
              <div className="action-icon-wrap">
                <Heart size={21} />
                {wishlistCount > 0 && <span className="action-badge-dot">{wishlistCount}</span>}
              </div>
              <span className="action-label">Wishlist</span>
            </Link>

            {/* Cart Button */}
            <Link to="/cart" className="clean-cart-btn" title="Shopping Cart">
              <div className="cart-icon-container">
                <ShoppingBag size={19} />
                {itemCount > 0 && <span className="cart-count-badge">{itemCount}</span>}
              </div>
              <div className="cart-text-container">
                <span className="cart-title">Cart</span>
                <span className="cart-total-amt">${subtotal.toFixed(2)}</span>
              </div>
            </Link>

            {/* Profile / Account Dropdown */}
            <div className="navbar-profile-wrapper" ref={userMenuRef}>
              <button
                type="button"
                className="navbar-profile-btn"
                onClick={() => setIsUserMenuOpen(prev => !prev)}
                aria-label="User Account Menu"
              >
                <img
                  src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                  alt={user?.name || 'Profile'}
                  className="profile-avatar-img"
                />
                <div className="profile-btn-info">
                  <span className="profile-name">{user?.name?.split(' ')[0] || 'Account'}</span>
                  <ChevronDown size={12} className="chevron" />
                </div>
              </button>

              {/* Profile Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="navbar-user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-name">{user?.name || 'Customer Account'}</div>
                    <div className="user-dropdown-email">{user?.email || 'alex.mercer@skylink.io'}</div>
                  </div>
                  <div className="user-dropdown-nav">
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="dropdown-nav-item"
                    >
                      <UserIcon size={16} /> My Profile & Preferences
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="dropdown-nav-item"
                    >
                      <Package size={16} /> My Orders
                    </Link>
                    <Link
                      to="/addresses"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="dropdown-nav-item"
                    >
                      <MapPin size={16} /> Saved Drop Zones & Addresses
                    </Link>
                    <Link
                      to="/wishlist"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="dropdown-nav-item"
                    >
                      <Heart size={16} /> My Wishlist ({wishlistCount})
                    </Link>
                    <Link
                      to="/notifications"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="dropdown-nav-item"
                    >
                      <Bell size={16} /> Notifications {unreadCount > 0 && `(${unreadCount})`}
                    </Link>
                    <div className="dropdown-divider" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                        navigate('/login');
                      }}
                      className="dropdown-logout-item"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ── Clean Horizontal Category Bar (Text Only) ── */}
        <nav className="clean-category-strip" aria-label="Product categories">
          <div className="clean-category-strip-inner">
            {SIDE_CATEGORIES.map((cat) => (
              <NavLink
                key={cat.path}
                to={cat.path}
                className={({ isActive }) => `clean-category-pill ${isActive ? 'active' : ''}`}
              >
                <span className="cat-pill-label">{cat.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {/* ══════════════════════════════════════════
          SLIDE-OUT SIDE NAVIGATION DRAWER (ON-DEMAND)
      ══════════════════════════════════════════ */}
      {isSidebarOpen && (
        <div className="side-drawer-backdrop" onClick={() => setIsSidebarOpen(false)}>
          <aside
            className="side-drawer-panel"
            ref={sidebarRef}
            onClick={(e) => e.stopPropagation()}
            aria-label="Side navigation drawer"
          >
            {/* Drawer Header */}
            <div className="side-drawer-header">
              <div className="drawer-brand">
                <div className="drawer-logo-icon">
                  <Plane size={18} />
                </div>
                <div>
                  <div className="drawer-brand-name">SkyLink</div>
                  <span className="drawer-brand-sub">AERIAL MARKETPLACE</span>
                </div>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="side-drawer-body">

              {/* 1. Active Order Live Tracking Card (if active) */}
              {activeOrder && (
                <div className="drawer-active-flight-card">
                  <div className="active-flight-header">
                    <span className="flight-radar-dot" />
                    <span className="flight-radar-text">ORDER IN FLIGHT</span>
                  </div>
                  <h4 className="active-flight-title">Drone Delivery In Transit</h4>
                  <p className="active-flight-eta">Arriving in approx 12 min to your landing pad.</p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      setIsSidebarOpen(false);
                      navigate(`/tracking/${activeOrder.id}`);
                    }}
                    rightIcon={<ArrowRight size={14} />}
                  >
                    Track Live Map
                  </Button>
                </div>
              )}

              {/* 2. Delivery Location Selector Box */}
              <div className="drawer-location-box">
                <div className="location-box-header">
                  <span className="location-box-label">
                    <MapPin size={14} color="#0284c7" /> Deliver To
                  </span>
                  <button
                    type="button"
                    className="location-change-btn"
                    onClick={() => {
                      setIsLocationModalOpen(true);
                      setIsSidebarOpen(false);
                    }}
                  >
                    Change
                  </button>
                </div>
                <div className="location-box-content">
                  <span className="location-box-addr">
                    {defaultAddress
                      ? `${defaultAddress.label} · ${defaultAddress.building}, ${defaultAddress.street}`
                      : 'No address selected'}
                  </span>
                  {defaultAddress && (
                    <span className="location-box-pad">
                      Landing Pad: <strong>{defaultAddress.dropZoneType || 'Lawn'}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* 3. Main Navigation Links */}
              <div className="drawer-section">
                <div className="drawer-section-title">Navigation</div>
                <div className="drawer-nav-list">
                  <NavLink
                    to="/dashboard"
                    onClick={() => setIsSidebarOpen(false)}
                    className={({ isActive }) => `drawer-nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span>🏠 Marketplace Home</span>
                    <ChevronRight size={15} />
                  </NavLink>
                  <NavLink
                    to="/orders"
                    onClick={() => setIsSidebarOpen(false)}
                    className={({ isActive }) => `drawer-nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span>📦 Orders & Tracking</span>
                    {activeOrder && <span className="drawer-pill-green">1 Active</span>}
                    <ChevronRight size={15} />
                  </NavLink>
                  <NavLink
                    to="/notifications"
                    onClick={() => setIsSidebarOpen(false)}
                    className={({ isActive }) => `drawer-nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span>🔔 Customer Alerts</span>
                    {unreadCount > 0 && <span className="drawer-pill-badge">{unreadCount}</span>}
                    <ChevronRight size={15} />
                  </NavLink>
                  <NavLink
                    to="/addresses"
                    onClick={() => setIsSidebarOpen(false)}
                    className={({ isActive }) => `drawer-nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span>📍 Saved Drop Zones & Addresses</span>
                    <ChevronRight size={15} />
                  </NavLink>
                  <NavLink
                    to="/wishlist"
                    onClick={() => setIsSidebarOpen(false)}
                    className={({ isActive }) => `drawer-nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span>💖 Wishlist & Favorites</span>
                    {wishlistCount > 0 && <span className="drawer-pill-count">{wishlistCount}</span>}
                    <ChevronRight size={15} />
                  </NavLink>
                </div>
              </div>

              {/* 4. Shop by Department / Category */}
              <div className="drawer-section">
                <div className="drawer-section-title">Shop by Category</div>
                <div className="drawer-nav-list">
                  {SIDE_CATEGORIES.map((cat) => (
                    <NavLink
                      key={cat.path}
                      to={cat.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={({ isActive }) => `drawer-nav-link ${isActive ? 'active' : ''}`}
                    >
                      <div className="drawer-cat-left">
                        <span className="drawer-cat-icon">{cat.icon}</span>
                        <span>{cat.label}</span>
                      </div>
                      {cat.eta && <span className="drawer-cat-eta">{cat.eta}</span>}
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* 5. Aviation Safety & Customer Support */}
              <div className="drawer-section">
                <div className="drawer-section-title">Drone Support & Safety</div>
                <div className="drawer-nav-list">
                  <NavLink
                    to="/support"
                    onClick={() => setIsSidebarOpen(false)}
                    className="drawer-nav-link"
                  >
                    <span>❓ Help Center & FAQs</span>
                    <ChevronRight size={15} />
                  </NavLink>
                  <div className="drawer-help-box">
                    <div className="help-box-label">24/7 Live Flight Support</div>
                    <div className="help-box-phone">
                      <PhoneCall size={14} /> 1-800-SKY-DRONE
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Drawer Footer: User Profile & Sign Out */}
            <div className="side-drawer-footer">
              <div className="drawer-user-row">
                <img
                  src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                  alt={user?.name || 'Customer'}
                  className="drawer-avatar"
                />
                <div className="drawer-user-info">
                  <div className="drawer-user-name">{user?.name || 'Customer Account'}</div>
                  <div className="drawer-user-email">{user?.email || 'alex.mercer@skylink.io'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    logout();
                    navigate('/login');
                  }}
                  className="drawer-logout-btn"
                  title="Sign Out"
                >
                  <LogOut size={17} />
                </button>
              </div>
            </div>

          </aside>
        </div>
      )}

      {/* Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />
    </>
  );
};
