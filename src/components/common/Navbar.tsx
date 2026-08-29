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
  CheckCircle2,
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import { useOrders } from '../../context/OrderContext';
import { useAddress } from '../../context/AddressContext';
import { LocationModal } from './LocationModal';
import { INITIAL_PRODUCTS } from '../../services/mockData';
import { Product } from '../../types/product';

const POPULAR_SEARCHES = [
  'GaN Charger',
  'First Aid Kit',
  'Artisan Pizza',
  'Cold Brew',
  'Earbuds',
  'Avocado',
  'Courier Pouch',
  'Glucose Monitor',
];

const CATEGORY_TABS = [
  { label: 'All Products', path: '/products', icon: '🛍️' },
  { label: 'Medicines & Health', path: '/products?category=Medicine', icon: '💊' },
  { label: 'Hot Gourmet Meals', path: '/products?category=Food', icon: '🍕' },
  { label: 'Fresh Groceries', path: '/products?category=Groceries', icon: '🥑' },
  { label: 'Tech & Electronics', path: '/products?category=Electronics', icon: '⚡' },
  { label: 'Instant Documents', path: '/products?category=Documents', icon: '📄' },
  { label: 'Daily Essentials', path: '/products?category=Other', icon: '✨' },
];

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const { activeOrder } = useOrders();
  const { defaultAddress } = useAddress();
  const navigate = useNavigate();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('All');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<Product[]>([]);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter search suggestions in real-time
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const filtered = INITIAL_PRODUCTS.filter(p => {
      const matchCat = searchCategory === 'All' || p.category.toLowerCase() === searchCategory.toLowerCase();
      const matchText = p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.subCategory && p.subCategory.toLowerCase().includes(q));
      return matchCat && matchText;
    }).slice(0, 5);
    setSearchSuggestions(filtered);
  }, [searchQuery, searchCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchOpen(false);
    navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}${searchCategory !== 'All' ? `&category=${searchCategory}` : ''}`);
  };

  const handleSuggestionClick = (productId: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/products/${productId}`);
  };

  const handleQuickKeywordClick = (keyword: string) => {
    setSearchQuery(keyword);
    setIsSearchOpen(false);
    navigate(`/products?search=${encodeURIComponent(keyword)}`);
  };

  const handleLogout = async () => {
    await logout();
    setIsUserMenuOpen(false);
    navigate('/login');
  };

  return (
    <header className="navbar-ecommerce" role="banner">
      {/* ── Top Bar Notification for Active Flight (E-Commerce Header Pill) ── */}
      {isAuthenticated && activeOrder && (
        <div className="active-flight-top-strip">
          <div className="active-flight-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="pulse-dot cyan" />
              <span style={{ fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                LIVE DRONE IN-FLIGHT:
              </span>
              <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                Order #{activeOrder.id} is {activeOrder.status} (~{activeOrder.estimatedDeliveryTime})
              </span>
            </div>
            <Link to={`/tracking/${activeOrder.id}`} className="active-flight-track-btn">
              <Radio size={13} className="animate-spin" />
              Track Live Map
            </Link>
          </div>
        </div>
      )}

      {/* ── Main E-Commerce Header Row ── */}
      <div className="navbar-main-row">
        <div className="navbar-inner-ecom">

          {/* 1. Brand Logo */}
          <Link to="/" className="ecom-brand" aria-label="SkyLink E-Commerce Home">
            <div className="ecom-brand-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <line x1="5" y1="7" x2="19" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="19" y1="7" x2="5" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="5" cy="7" r="2.5" fill="white" opacity="0.9" />
                <circle cx="19" cy="7" r="2.5" fill="white" opacity="0.9" />
                <circle cx="5" cy="17" r="2.5" fill="white" opacity="0.9" />
                <circle cx="19" cy="17" r="2.5" fill="white" opacity="0.9" />
                <circle cx="12" cy="12" r="3.5" fill="white" />
                <circle cx="12" cy="12" r="1.5" fill="#0284c7" />
              </svg>
            </div>
            <div className="ecom-brand-text">
              <span className="brand-title">SkyLink<span className="brand-dot">.</span></span>
              <span className="brand-sub">Drone Express</span>
            </div>
          </Link>

          {/* 2. Deliver To Location Button (Amazon / Swiggy style) */}
          {isAuthenticated && (
            <button
              type="button"
              className="location-select-btn"
              onClick={() => setIsLocationModalOpen(true)}
              aria-label="Change delivery location"
            >
              <div className="location-pin-icon">
                <MapPin size={16} />
              </div>
              <div className="location-text-col">
                <span className="location-label">Deliver to {user?.name?.split(' ')[0] || 'You'}</span>
                <span className="location-address">
                  {defaultAddress
                    ? `${defaultAddress.label} - ${defaultAddress.city}`
                    : 'Select Location'} ▾
                </span>
              </div>
            </button>
          )}

          {/* 3. Prominent Search Bar with Autocomplete Suggestions */}
          <div className="ecom-search-wrapper" ref={searchContainerRef}>
            <form className="ecom-search-form" onSubmit={handleSearchSubmit}>
              <select
                className="search-category-select"
                value={searchCategory}
                onChange={e => setSearchCategory(e.target.value)}
                aria-label="Filter search by category"
              >
                <option value="All">All Categories</option>
                <option value="Medicine">Medicine & Health</option>
                <option value="Food">Hot Food</option>
                <option value="Groceries">Groceries</option>
                <option value="Electronics">Electronics</option>
                <option value="Documents">Documents</option>
              </select>

              <div className="search-input-box">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search products, medicine, food & essentials for 15-min drone delivery..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  aria-label="Search marketplace products"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchSuggestions([]);
                    }}
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <button type="submit" className="search-submit-btn" aria-label="Submit search">
                <Search size={18} />
              </button>
            </form>

            {/* Search Suggestions & Popular Searches Popup */}
            {isSearchOpen && (
              <div className="search-suggestions-dropdown">
                {searchSuggestions.length > 0 ? (
                  <div className="suggestions-list">
                    <div className="suggestions-header">
                      <Sparkles size={13} color="var(--accent-blue)" /> Product Matches
                    </div>
                    {searchSuggestions.map(product => (
                      <div
                        key={product.id}
                        className="suggestion-item"
                        onClick={() => handleSuggestionClick(product.id)}
                      >
                        <img src={product.image} alt={product.name} className="suggestion-img" />
                        <div className="suggestion-info">
                          <div className="suggestion-name">{product.name}</div>
                          <div className="suggestion-meta">
                            <span className="suggestion-cat">{product.category}</span>
                            <span className="suggestion-dot">•</span>
                            <span className="suggestion-price">${product.price.toFixed(2)}</span>
                            <span className="suggestion-dot">•</span>
                            <span className="suggestion-eta">🚁 ~{product.estimatedDeliveryMins}m</span>
                          </div>
                        </div>
                        <ArrowRight size={14} className="suggestion-arrow" />
                      </div>
                    ))}
                  </div>
                ) : searchQuery.trim() ? (
                  <div className="search-no-results">
                    No immediate match for "{searchQuery}". Press <strong>Enter</strong> to browse full catalog.
                  </div>
                ) : null}

                {/* Popular Search Tags */}
                <div className="popular-searches-box">
                  <div className="popular-header">
                    <Clock size={12} /> Popular Searches
                  </div>
                  <div className="popular-chips">
                    {POPULAR_SEARCHES.map(keyword => (
                      <button
                        key={keyword}
                        type="button"
                        className="popular-chip"
                        onClick={() => handleQuickKeywordClick(keyword)}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Right Side Actions (Account, Orders, Wishlist, Notifications, Cart) */}
          <div className="ecom-nav-actions">

            {isAuthenticated ? (
              <>
                {/* My Orders Link (Amazon style) */}
                <Link to="/orders" className="ecom-action-link" aria-label="My Orders">
                  <div className="action-top-label">Returns</div>
                  <div className="action-bottom-label">& Orders</div>
                </Link>

                {/* Wishlist Link */}
                <Link to="/wishlist" className="ecom-icon-action" aria-label={`Wishlist (${wishlistCount} items)`}>
                  <div className="icon-with-badge">
                    <Heart size={20} />
                    {wishlistCount > 0 && <span className="action-badge-count">{wishlistCount}</span>}
                  </div>
                  <span className="icon-subtext">Wishlist</span>
                </Link>

                {/* Notifications Bell */}
                <div className="user-menu-container" ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => setIsNotifOpen(prev => !prev)}
                    className="ecom-icon-action"
                    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                    aria-expanded={isNotifOpen}
                  >
                    <div className="icon-with-badge">
                      <Bell size={20} />
                      {unreadCount > 0 && <span className="action-badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                    </div>
                    <span className="icon-subtext">Alerts</span>
                  </button>

                  {isNotifOpen && (
                    <div className="dropdown-menu notif-dropdown" role="dialog" aria-label="Notifications">
                      <div className="notif-dropdown-header">
                        <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Notifications</span>
                        <Link
                          to="/notifications"
                          onClick={() => setIsNotifOpen(false)}
                          style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 700 }}
                        >
                          View All
                        </Link>
                      </div>

                      <div className="notif-dropdown-body">
                        {notifications.length === 0 ? (
                          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                            All caught up! 🎉
                          </div>
                        ) : (
                          notifications.slice(0, 5).map(notif => (
                            <button
                              key={notif.id}
                              type="button"
                              onClick={() => {
                                markAsRead(notif.id);
                                if (notif.actionUrl) {
                                  setIsNotifOpen(false);
                                  navigate(notif.actionUrl);
                                }
                              }}
                              className={`notif-item-btn ${notif.read ? 'read' : 'unread'}`}
                            >
                              <div className="notif-item-title">{notif.title}</div>
                              <div className="notif-item-msg">{notif.message}</div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Shopping Cart */}
                <Link to="/cart" className="ecom-cart-action" aria-label={`Shopping cart with ${itemCount} items`}>
                  <div className="cart-icon-wrapper">
                    <ShoppingBag size={22} />
                    <span className="cart-badge-counter">{itemCount}</span>
                  </div>
                  <div className="cart-text-col">
                    <span className="cart-sublabel">Basket</span>
                    <span className="cart-mainlabel">Cart</span>
                  </div>
                </Link>

                {/* User Account Dropdown */}
                <div className="user-menu-container" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(prev => !prev)}
                    className="account-btn"
                    aria-label="Customer profile menu"
                    aria-expanded={isUserMenuOpen}
                  >
                    <img
                      src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=0ea5e9&color=fff&size=64`}
                      alt={user?.name || 'Customer'}
                      className="account-avatar-img"
                    />
                    <div className="account-text-col">
                      <span className="account-greeting">Hello, {user?.name?.split(' ')[0] || 'Sign In'}</span>
                      <span className="account-main">Account ▾</span>
                    </div>
                  </button>

                  {isUserMenuOpen && (
                    <div className="dropdown-menu" role="menu">
                      <div className="account-dropdown-user-box">
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {user?.name}
                          {user?.isVerified && <CheckCircle2 size={14} color="#10b981" />}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{user?.email}</div>
                      </div>

                      <Link to="/profile" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)} role="menuitem">
                        <UserIcon size={15} /> My Profile
                      </Link>
                      <Link to="/orders" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)} role="menuitem">
                        <Package size={15} /> My Orders & Flights
                      </Link>
                      <Link to="/wishlist" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)} role="menuitem">
                        <Heart size={15} /> Saved Wishlist
                      </Link>
                      <Link to="/addresses" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)} role="menuitem">
                        <MapPin size={15} /> Saved Drop Zones
                      </Link>
                      <Link to="/support" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)} role="menuitem">
                        <HelpCircle size={15} /> Help Center & Support
                      </Link>

                      <div className="dropdown-divider" />

                      <button type="button" onClick={handleLogout} className="dropdown-item danger" role="menuitem">
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Category Quick-Navigation Sub Bar (E-Commerce standard) ── */}
      {isAuthenticated && (
        <nav className="ecom-category-nav" aria-label="E-commerce Categories">
          <div className="ecom-category-inner">
            <div className="category-scroll-strip">
              {CATEGORY_TABS.map(cat => (
                <NavLink
                  key={cat.label}
                  to={cat.path}
                  className={({ isActive }) =>
                    `category-tab-link ${isActive && cat.path === '/products' ? 'active' : ''}`
                  }
                >
                  <span className="category-tab-emoji">{cat.icon}</span>
                  <span>{cat.label}</span>
                </NavLink>
              ))}
            </div>

            {/* Air Drop Guarantee badge on right of category bar */}
            <div className="air-delivery-badge-pill">
              <Zap size={13} fill="#0ea5e9" color="#0ea5e9" />
              <span>Free Drone Delivery on orders over $35</span>
            </div>
          </div>
        </nav>
      )}

      {/* Location Selector Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />
    </header>
  );
};
