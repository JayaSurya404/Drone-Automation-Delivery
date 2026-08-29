import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { ProductCard } from '../../components/products/ProductCard';
import { Button } from '../../components/common/Button';
import { Drone3DVisual } from '../../components/common/Drone3DVisual';
import { INITIAL_PRODUCTS } from '../../services/mockData';
import { Product } from '../../types/product';
import { storage } from '../../services/storage';
import {
  ShoppingBag,
  Zap,
  Clock,
  ShieldCheck,
  Plane,
  ChevronRight,
  ChevronLeft,
  Flame,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  Radio,
  MapPin,
} from 'lucide-react';

const RECENTLY_VIEWED_KEY = 'skylink_recently_viewed';

const HERO_SLIDES = [
  {
    id: 'slide_1',
    badge: '⚡ AUTONOMOUS AIR CORRIDOR',
    title: 'Ultra-Fast Drone Delivery in under 20 mins',
    subtitle: 'Order fresh meals, essential medicines, and tech chargers delivered straight to your rooftop or lawn pad.',
    ctaText: 'Explore Marketplace',
    ctaLink: '/products',
    secondaryText: 'Flash Deals',
    secondaryLink: '/products?deals=true',
    accentColor: '#0284c7',
    bgGradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #dbeafe 100%)',
    droneStatus: 'flying' as const,
  },
  {
    id: 'slide_2',
    badge: '🚨 24/7 EMERGENCY HEALTHCARE AIR DROP',
    title: 'Critical First Aid & Medicine in 8–12 Minutes',
    subtitle: 'When every second counts, autonomous electric drones bypass city traffic to deliver certified medical care.',
    ctaText: 'Shop Pharmacy',
    ctaLink: '/products?category=Medicine',
    secondaryText: 'First Aid Kits',
    secondaryLink: '/products/prod_med_1',
    accentColor: '#059669',
    bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #e0f2fe 100%)',
    droneStatus: 'flying' as const,
  },
  {
    id: 'slide_3',
    badge: '🍕 THERMAL-LOCK FLIGHT CONTAINER',
    title: 'Gourmet Woodfired Food Kept at 68°C',
    subtitle: 'Hot artisan pizzas, sushi bentos, and morning cold brew flown straight from top chef kitchens.',
    ctaText: 'Order Fresh Food',
    ctaLink: '/products?category=Food',
    secondaryText: 'View Menus',
    secondaryLink: '/products?category=Food',
    accentColor: '#d97706',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #f0f9ff 100%)',
    droneStatus: 'flying' as const,
  },
];

const CATEGORY_TILES = [
  {
    id: 'cat_med',
    name: 'Pharmacy & Medicine',
    sub: 'Urgent First Aid & Care',
    icon: '💊',
    bg: '#eff6ff',
    border: '#bfdbfe',
    category: 'Medicine',
    eta: '8-11 min',
  },
  {
    id: 'cat_food',
    name: 'Hot Meals & Dining',
    sub: 'Piping Hot Gourmet',
    icon: '🍕',
    bg: '#fff7ed',
    border: '#fed7aa',
    category: 'Food',
    eta: '12-15 min',
  },
  {
    id: 'cat_groc',
    name: 'Fresh Groceries',
    sub: 'Farm Fresh & Drinks',
    icon: '🥑',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    category: 'Groceries',
    eta: '10-14 min',
  },
  {
    id: 'cat_elec',
    name: 'Tech & Fast GaN',
    sub: 'Chargers, Cables & Audio',
    icon: '⚡',
    bg: '#faf5ff',
    border: '#e9d5ff',
    category: 'Electronics',
    eta: '10-12 min',
  },
  {
    id: 'cat_doc',
    name: 'Instant Documents',
    sub: 'Tamper-Proof Courier',
    icon: '📄',
    bg: '#f8fafc',
    border: '#e2e8f0',
    category: 'Documents',
    eta: '8-10 min',
  },
  {
    id: 'cat_oth',
    name: 'Daily Essentials',
    sub: 'Pet Care & Supplies',
    icon: '✨',
    bg: '#fdf4ff',
    border: '#f5d0fe',
    category: 'Other',
    eta: '10-15 min',
  },
];

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { activeOrder } = useOrders();
  const navigate = useNavigate();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  // Flash Deals Countdown Timer (e.g. 04h : 18m : 42s)
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 18, seconds: 42 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 4, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Slide Auto-play
  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % HERO_SLIDES.length);
    }, 6500);
    return () => clearInterval(slideTimer);
  }, []);

  // Load Recently Viewed from storage
  useEffect(() => {
    const viewedIds = storage.get<string[]>(RECENTLY_VIEWED_KEY, []);
    if (viewedIds.length > 0) {
      const prods = INITIAL_PRODUCTS.filter(p => viewedIds.includes(p.id));
      setRecentlyViewed(prods.slice(0, 4));
    }
  }, []);

  const dealsProducts = INITIAL_PRODUCTS.filter(p => p.discountPercent && p.discountPercent >= 25).slice(0, 4);
  const popularProducts = INITIAL_PRODUCTS.slice(0, 8);
  const medicineProducts = INITIAL_PRODUCTS.filter(p => p.category === 'Medicine');
  const foodProducts = INITIAL_PRODUCTS.filter(p => p.category === 'Food');

  const slide = HERO_SLIDES[currentSlide];

  return (
    <div className="main-content ecom-home-page">

      {/* ══════════════════════════════════════════
          1. HERO BANNER CAROUSEL / SLIDER
      ══════════════════════════════════════════ */}
      <div className="ecom-hero-banner-wrapper">
        <div
          className="ecom-hero-banner"
          style={{ background: slide.bgGradient }}
        >
          {/* Background Ambient Grid */}
          <div className="hero-grid-pattern" />

          {/* Left Text Col */}
          <div className="hero-text-content">
            <div className="hero-pill-badge" style={{ color: slide.accentColor, borderColor: `${slide.accentColor}33` }}>
              <span className="pulse-dot" style={{ backgroundColor: slide.accentColor }} />
              <span>{slide.badge}</span>
            </div>

            <h1 className="hero-headline">{slide.title}</h1>
            <p className="hero-subtext">{slide.subtitle}</p>

            <div className="hero-cta-group">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate(slide.ctaLink)}
                rightIcon={<ArrowRight size={18} />}
              >
                {slide.ctaText}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate(slide.secondaryLink)}
              >
                {slide.secondaryText}
              </Button>
            </div>
          </div>

          {/* Right 3D Drone Visual */}
          <div className="hero-drone-visual-wrap">
            <Drone3DVisual
              size={290}
              status={slide.droneStatus}
              hasCargo={true}
              enableParallax={true}
            />
          </div>

          {/* Slider Prev / Next Controls */}
          <button
            type="button"
            className="hero-arrow-btn prev"
            onClick={() => setCurrentSlide(prev => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
            aria-label="Previous banner"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="hero-arrow-btn next"
            onClick={() => setCurrentSlide(prev => (prev + 1) % HERO_SLIDES.length)}
            aria-label="Next banner"
          >
            <ChevronRight size={20} />
          </button>

          {/* Slide Indicator Dots */}
          <div className="hero-dots-container">
            {HERO_SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`hero-dot ${idx === currentSlide ? 'active' : ''}`}
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          2. CATEGORY QUICK-TILES
      ══════════════════════════════════════════ */}
      <section className="ecom-section category-tiles-section">
        <div className="section-title-row">
          <div>
            <span className="section-pre-label">Marketplace Categories</span>
            <h2 className="section-main-title">Shop by Rapid Air Delivery Category</h2>
          </div>
          <Link to="/products" className="section-view-all-link">
            All Categories <ChevronRight size={16} />
          </Link>
        </div>

        <div className="category-tiles-grid">
          {CATEGORY_TILES.map(cat => (
            <div
              key={cat.id}
              className="category-card-tile"
              onClick={() => navigate(`/products?category=${cat.category}`)}
              style={{ background: cat.bg, borderColor: cat.border }}
            >
              <div className="tile-icon-circle">{cat.icon}</div>
              <div className="tile-info">
                <div className="tile-title">{cat.name}</div>
                <div className="tile-sub">{cat.sub}</div>
              </div>
              <div className="tile-eta-badge">
                <Zap size={11} fill="#0ea5e9" color="#0ea5e9" /> {cat.eta}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. ⚡ LIGHTNING FLASH DEALS (WITH TIMER)
      ══════════════════════════════════════════ */}
      <section className="ecom-section flash-deals-section">
        <div className="flash-deals-header-box">
          <div className="deals-title-col">
            <div className="deals-flame-tag">
              <Flame size={16} fill="#ef4444" color="#ef4444" />
              <span>LIGHTNING DRONE DEALS</span>
            </div>
            <h2 className="deals-main-heading">Up to 35% OFF · Limited Air Stock</h2>
          </div>

          <div className="deals-countdown-box">
            <span className="timer-label"><Clock size={14} /> Ends in:</span>
            <div className="timer-digits">
              <span className="digit-box">{String(timeLeft.hours).padStart(2, '0')}h</span>
              <span className="colon">:</span>
              <span className="digit-box">{String(timeLeft.minutes).padStart(2, '0')}m</span>
              <span className="colon">:</span>
              <span className="digit-box">{String(timeLeft.seconds).padStart(2, '0')}s</span>
            </div>
          </div>
        </div>

        <div className="products-grid">
          {dealsProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. 🚁 WHY SKYLAND DRONE COMMERCE (VALUE PROP)
      ══════════════════════════════════════════ */}
      <section className="ecom-section drone-features-showcase">
        <div className="features-inner-grid">
          <div className="feature-item-card">
            <div className="feature-icon-wrapper" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <Zap size={24} />
            </div>
            <h3 className="feature-title">8–15 Minute Air Speed</h3>
            <p className="feature-desc">Autonomous high-altitude flight routes completely bypass city gridlock and traffic signals.</p>
          </div>

          <div className="feature-item-card">
            <div className="feature-icon-wrapper" style={{ background: '#ecfdf5', color: '#059669' }}>
              <ShieldCheck size={24} />
            </div>
            <h3 className="feature-title">Safe Sonar Landing Drops</h3>
            <p className="feature-desc">Precision optical sensors gently lower packages to your backyard lawn, patio, or rooftop landing pad.</p>
          </div>

          <div className="feature-item-card">
            <div className="feature-icon-wrapper" style={{ background: '#fff7ed', color: '#ea580c' }}>
              <Radio size={24} />
            </div>
            <h3 className="feature-title">Live 3D Telemetry GPS</h3>
            <p className="feature-desc">Watch your delivery drone fly in real-time with accurate live altitude, speed, and ETA on interactive map.</p>
          </div>

          <div className="feature-item-card">
            <div className="feature-icon-wrapper" style={{ background: '#fdf4ff', color: '#c026d3' }}>
              <Sparkles size={24} />
            </div>
            <h3 className="feature-title">100% Zero-Carbon Electric</h3>
            <p className="feature-desc">Eco-friendly electric quadcopters run on certified solar battery hubs for a cleaner urban footprint.</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. POPULAR & BESTSELLERS
      ══════════════════════════════════════════ */}
      <section className="ecom-section">
        <div className="section-title-row">
          <div>
            <span className="section-pre-label">Customer Favorites</span>
            <h2 className="section-main-title">Trending Across SkyLink Marketplace</h2>
          </div>
          <Link to="/products" className="section-view-all-link">
            View All Products <ChevronRight size={16} />
          </Link>
        </div>

        <div className="products-grid">
          {popularProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. URGENT PHARMACY & HOT MEALS ROWS
      ══════════════════════════════════════════ */}
      <section className="ecom-section category-highlight-row">
        <div className="category-highlight-card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', border: '1px solid #bbf7d0' }}>
          <div className="highlight-header">
            <div>
              <span className="highlight-pill" style={{ color: '#059669', background: '#d1fae5' }}>Emergency Health</span>
              <h3 className="highlight-heading">Rapid Medical Care Drops</h3>
              <p className="highlight-sub">Sterile kits, inhalers, glucose monitors, and allergy care delivered within 10 minutes.</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate('/products?category=Medicine')}>
              Shop Pharmacy
            </Button>
          </div>
          <div className="highlight-items-grid">
            {medicineProducts.slice(0, 3).map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. RECENTLY VIEWED PRODUCTS (IF ANY)
      ══════════════════════════════════════════ */}
      {recentlyViewed.length > 0 && (
        <section className="ecom-section recently-viewed-section">
          <div className="section-title-row">
            <div>
              <span className="section-pre-label">Browsing History</span>
              <h2 className="section-main-title">Recently Viewed By You</h2>
            </div>
          </div>
          <div className="products-grid">
            {recentlyViewed.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          8. BOTTOM PROMO DISPATCH BANNER
      ══════════════════════════════════════════ */}
      <div className="ecom-bottom-promo-banner">
        <div className="promo-banner-inner">
          <div className="promo-text-wrap">
            <span className="promo-tag">NEW CUSTOMER SPECIAL</span>
            <h3 className="promo-heading">Get 15% OFF your next drone flight order with code <strong>DRONEFAST</strong></h3>
            <p className="promo-sub">Use at checkout on any order over $25. Free flight dispatch guarantee included.</p>
          </div>
          <Button variant="primary" size="lg" onClick={() => navigate('/products')}>
            Shop Now
          </Button>
        </div>
      </div>

    </div>
  );
};
