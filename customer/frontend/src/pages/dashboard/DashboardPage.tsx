import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { ProductCard } from '../../components/products/ProductCard';
import { FeaturedProductsCarousel } from '../../components/products/FeaturedProductsCarousel';
import { Button } from '../../components/common/Button';
import { RealisticDroneHero } from '../../components/common/RealisticDroneHero';
import { Product } from '../../types/product';
import { storage } from '../../services/storage';
import { api } from '../../services/api';
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
  CheckCircle2,
  Box,
  Leaf,
  Send,
  Star,
  Compass,
} from 'lucide-react';

const RECENTLY_VIEWED_KEY = 'skynav_recently_viewed';

// High-resolution image-based category cards
const ECOM_CATEGORIES = [
  {
    id: 'cat_med',
    name: 'Pharmacy & Medicine',
    sub: 'Urgent Care & First Aid',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80',
    category: 'Medicine',
    eta: '8–11 min',
  },
  {
    id: 'cat_food',
    name: 'Hot Gourmet Meals',
    sub: 'Piping Hot at 68°C',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
    category: 'Food',
    eta: '12–15 min',
  },
  {
    id: 'cat_groc',
    name: 'Fresh Groceries',
    sub: 'Farm Direct & Cold Brew',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
    category: 'Groceries',
    eta: '10–14 min',
  },
  {
    id: 'cat_elec',
    name: 'Tech & Fast GaN',
    sub: 'Chargers, Cables & Audio',
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80',
    category: 'Electronics',
    eta: '10–12 min',
  },
  {
    id: 'cat_doc',
    name: 'Secure Documents',
    sub: 'Tamper-Proof Courier',
    image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
    category: 'Documents',
    eta: '8–10 min',
  },
  {
    id: 'cat_oth',
    name: 'Daily Essentials',
    sub: 'Lifestyle & Supplies',
    image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80',
    category: 'Other',
    eta: '10–15 min',
  },
];

const SPEED_FILTER_OPTIONS = [
  { label: '🚁 Under 15 min', maxMins: 15, desc: 'Ultra-fast emergency air corridor' },
  { label: '⚡ Under 25 min', maxMins: 25, desc: 'Priority scheduled drone flight' },
  { label: '📦 Same Day Express', maxMins: 60, desc: 'Flown direct from local fulfillment hub' },
  { label: '📅 Scheduled Air Drop', maxMins: 0, desc: 'Choose your custom drop-off time' },
];

const TESTIMONIALS = [
  {
    id: 't_1',
    author: 'Elena Rostova',
    role: 'Verified Customer · San Francisco',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    rating: 5,
    title: 'Pizza arrived steaming hot in 13 minutes!',
    content: 'Unbelievable experience. The pizza crust was crispy and cheese melted. The drone hovered quietly and lowered the thermal pod right on my lawn pad.',
  },
  {
    id: 't_2',
    author: 'Jason Vance',
    role: 'Verified Customer · SoMa Tech Hub',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    rating: 5,
    title: 'Emergency GaN charger saved my presentation',
    content: 'My charger died 20 mins before a major executive pitch. Ordered on SkyNav and the drone was at our office rooftop landing pad in 11 minutes.',
  },
  {
    id: 't_3',
    author: 'Dr. Sarah Lin',
    role: 'Healthcare Professional · Pacific Heights',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    rating: 5,
    title: 'The cleanest emergency medical drops',
    content: 'Fast, sterile, and perfectly tracked with real-time GPS telemetry. This is the future of urban delivery logistics.',
  },
];

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { activeOrder } = useOrders();
  const navigate = useNavigate();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [selectedSpeed, setSelectedSpeed] = useState<number>(15);

  // Flash Deals Live Countdown Timer (04h : 18m : 42s)
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

  // Fetch live products from backend database
  useEffect(() => {
    let isMounted = true;
    api.products.getAll().then((data) => {
      if (!isMounted) return;
      setAllProducts(data);
      const viewedIds = storage.get<string[]>(RECENTLY_VIEWED_KEY, []);
      if (viewedIds.length > 0) {
        const prods = data.filter(p => viewedIds.includes(p.id));
        setRecentlyViewed(prods.slice(0, 4));
      }
    }).catch(err => console.error('Failed to load dashboard products:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Products subsets based on actual live database data
  const newArrivals = allProducts.slice(0, 4);
  const bestSellers = allProducts.slice(2, 6);
  const dealsProducts = allProducts.filter(p => p.discountPercent && p.discountPercent >= 20).slice(0, 4);
  const speedFilteredProducts = allProducts.filter(p =>
    selectedSpeed === 0 ? true : p.estimatedDeliveryMins <= selectedSpeed
  ).slice(0, 4);

  return (
    <div className="main-content ecom-home-page">

      {/* ══════════════════════════════════════════
          1. ACTIVE ORDER PREVIEW BANNER (IF ACTIVE)
      ══════════════════════════════════════════ */}
      {activeOrder && (
        <div className="active-order-ecom-banner">
          <div className="active-order-banner-left">
            <div className="active-order-ping-box">
              <span className="ping-dot" />
              <span className="ping-title">LIVE DELIVERY IN TRANSIT</span>
            </div>
            <h3 className="active-order-heading">
              Order #{activeOrder.id} is flying to you
            </h3>
            <p className="active-order-sub">
              Estimated Arrival in <strong>12 min</strong> to {activeOrder.deliveryAddress?.label || 'your saved drop zone'}.
            </p>
          </div>
          <div className="active-order-banner-right">
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(`/tracking/${activeOrder.id}`)}
              rightIcon={<ArrowRight size={16} />}
            >
              Track Live Flight Map
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          2. EDITORIAL HERO SECTION (SCREENSHOT 2 & 3 STYLE)
      ══════════════════════════════════════════ */}
      <section className="ecom-hero-section">
        <div className="ecom-hero-grid">
          {/* Left Hero Column */}
          <div className="ecom-hero-left">
            <div className="hero-eyebrow-badge">
              <span className="eyebrow-dot" />
              <span className="eyebrow-text">AUTONOMOUS AERIAL COMMERCE</span>
            </div>

            <h1 className="ecom-hero-headline">
              YOUR PRODUCTS. <br />
              <span className="headline-serif-italic">DELIVERED FROM THE SKY.</span>
            </h1>

            <p className="ecom-hero-description">
              Shop fresh gourmet meals, urgent medicines, groceries, and fast tech chargers delivered straight to your lawn or rooftop in 10–20 minutes.
            </p>

            {/* CTAs */}
            <div className="ecom-hero-actions">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/products')}
                rightIcon={<ArrowRight size={18} />}
              >
                Shop Marketplace
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/products?deals=true')}
              >
                Explore Flash Deals
              </Button>
            </div>

            {/* Customer Trust Rating Stack */}
            <div className="hero-trust-stack">
              <div className="hero-avatar-group">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80" alt="Customer" />
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80" alt="Customer" />
                <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&auto=format&fit=crop&q=80" alt="Customer" />
                <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80" alt="Customer" />
              </div>
              <div className="hero-trust-text">
                <div className="trust-stars-row">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />
                  ))}
                  <span className="trust-rating-score">4.9/5</span>
                </div>
                <span className="trust-sub">Loved by 12,000+ aerial delivery shoppers</span>
              </div>
            </div>
          </div>

          {/* Right Hero Visual with Realistic 3D Drone & HUD Telemetry */}
          <div className="ecom-hero-right">
            <RealisticDroneHero />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. TRUST / SERVICE INFORMATION BAR
      ══════════════════════════════════════════ */}
      <section className="ecom-trust-bar-section">
        <div className="ecom-trust-grid">
          <div className="trust-card-item">
            <div className="trust-icon-box bg-blue">
              <Zap size={22} />
            </div>
            <div className="trust-text-box">
              <h4 className="trust-title">10–20 Min Air Speed</h4>
              <p className="trust-desc">Flies direct to your lawn pad, bypassing city traffic gridlock.</p>
            </div>
          </div>

          <div className="trust-card-item">
            <div className="trust-icon-box bg-emerald">
              <Radio size={22} />
            </div>
            <div className="trust-text-box">
              <h4 className="trust-title">Live 3D Telemetry</h4>
              <p className="trust-desc">Watch your delivery drone travel on real-time interactive GPS map.</p>
            </div>
          </div>

          <div className="trust-card-item">
            <div className="trust-icon-box bg-purple">
              <ShieldCheck size={22} />
            </div>
            <div className="trust-text-box">
              <h4 className="trust-title">Precision Sonar Drops</h4>
              <p className="trust-desc">Optical sensors gently lower packages to your marked drop zone.</p>
            </div>
          </div>

          <div className="trust-card-item">
            <div className="trust-icon-box bg-amber">
              <Leaf size={22} />
            </div>
            <div className="trust-text-box">
              <h4 className="trust-title">100% Zero Emission</h4>
              <p className="trust-desc">Solar-charged clean electric aviation fleet for a greener planet.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. SHOP BY CATEGORY (IMAGE CARDS — SCREENSHOTS 2 & 3)
      ══════════════════════════════════════════ */}
      <section className="ecom-section shop-by-category-section">
        <div className="section-title-row">
          <div>
            <span className="section-pre-label">Marketplace Collections</span>
            <h2 className="section-main-title">Shop by Category</h2>
            <p className="section-sub-desc">Everything you need, delivered straight from the sky in minutes.</p>
          </div>
          <Link to="/products" className="section-view-all-link">
            View All Categories <ChevronRight size={16} />
          </Link>
        </div>

        <div className="category-image-cards-grid">
          {ECOM_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="category-image-card"
              onClick={() => navigate(`/products?category=${cat.category}`)}
            >
              <div className="category-card-bg-image-wrap">
                <img src={cat.image} alt={cat.name} className="category-card-bg-img" loading="lazy" />
                <div className="category-card-overlay" />
              </div>

              <div className="category-card-content">
                <span className="category-eta-tag">
                  <Zap size={11} fill="#0284c7" color="#0284c7" /> {cat.eta}
                </span>
                <h3 className="category-card-title">{cat.name}</h3>
                <span className="category-card-cta">
                  Explore Now <ArrowRight size={14} className="cta-arrow" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. FEATURED PRODUCTS 3D CAROUSEL (EXACT SCREENSHOT 1)
      ══════════════════════════════════════════ */}
      <FeaturedProductsCarousel products={allProducts} />

      {/* ══════════════════════════════════════════
          6. NEW ARRIVALS CAROUSEL / GRID (SCREENSHOTS 2 & 3)
      ══════════════════════════════════════════ */}
      <section className="ecom-section">
        <div className="section-title-row">
          <div>
            <span className="section-pre-label">Just Landed</span>
            <h2 className="section-main-title">New Arrivals</h2>
            <p className="section-sub-desc">The latest verified products added to our aerial catalog.</p>
          </div>
          <Link to="/products" className="section-view-all-link">
            View All <ChevronRight size={16} />
          </Link>
        </div>

        <div className="products-grid">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. DUAL PROMOTIONAL SPLIT BANNERS (SCREENSHOTS 2 & 3)
      ══════════════════════════════════════════ */}
      <section className="ecom-section dual-promo-banners-section">
        <div className="dual-promo-grid">
          {/* Banner 1: Urgent Medicine */}
          <div
            className="promo-split-card banner-medicine"
            onClick={() => navigate('/products?category=Medicine')}
          >
            <div className="promo-split-text">
              <span className="promo-pill-label">EMERGENCY HEALTH AIR DROP</span>
              <h3 className="promo-split-headline">Hospital-Grade First Aid & Medicine</h3>
              <p className="promo-split-sub">Sterile trauma kits, allergy pills, and glucose monitors flown in 8–12 minutes.</p>
              <span className="promo-split-btn">
                Shop Pharmacy <ArrowRight size={14} />
              </span>
            </div>
            <div className="promo-split-image-box">
              <img
                src="https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&auto=format&fit=crop&q=80"
                alt="Medical Air Drop"
                className="promo-split-img"
              />
            </div>
          </div>

          {/* Banner 2: Thermal Food Dispatch */}
          <div
            className="promo-split-card banner-food"
            onClick={() => navigate('/products?category=Food')}
          >
            <div className="promo-split-text">
              <span className="promo-pill-label">THERMAL-LOCK POD 68°C</span>
              <h3 className="promo-split-headline">Artisan Food Kept Piping Hot</h3>
              <p className="promo-split-sub">Woodfired sourdough pizzas and chef bentos transported with zero steam sogginess.</p>
              <span className="promo-split-btn">
                Order Fresh Food <ArrowRight size={14} />
              </span>
            </div>
            <div className="promo-split-image-box">
              <img
                src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80"
                alt="Hot Food Air Drop"
                className="promo-split-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          8. BEST SELLERS
      ══════════════════════════════════════════ */}
      <section className="ecom-section">
        <div className="section-title-row">
          <div>
            <span className="section-pre-label">Most Loved Picks</span>
            <h2 className="section-main-title">Best Sellers</h2>
            <p className="section-sub-desc">Customer favorite essentials with the highest delivery ratings.</p>
          </div>
          <Link to="/products" className="section-view-all-link">
            View All Products <ChevronRight size={16} />
          </Link>
        </div>

        <div className="products-grid">
          {bestSellers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          9. ⚡ TODAY'S LIGHTNING DEALS (WITH TIMER)
      ══════════════════════════════════════════ */}
      <section className="ecom-section flash-deals-section">
        <div className="flash-deals-header-box">
          <div className="deals-title-col">
            <div className="deals-flame-tag">
              <Flame size={16} fill="#ef4444" color="#ef4444" />
              <span>LIGHTNING AIR DEALS</span>
            </div>
            <h2 className="deals-main-heading">Up to 35% OFF · Limited Flight Stock</h2>
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
          {dealsProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          10. SHOP BY DELIVERY SPEED
      ══════════════════════════════════════════ */}
      <section className="ecom-section shop-by-speed-section">
        <div className="section-title-row">
          <div>
            <span className="section-pre-label">Rapid Air Options</span>
            <h2 className="section-main-title">Shop by Delivery Speed</h2>
            <p className="section-sub-desc">Select how quickly you need your items lowered to your landing pad.</p>
          </div>
        </div>

        {/* Speed Tabs */}
        <div className="speed-filter-tabs-row">
          {SPEED_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={`speed-tab-btn ${selectedSpeed === opt.maxMins ? 'active' : ''}`}
              onClick={() => setSelectedSpeed(opt.maxMins)}
            >
              <span className="speed-tab-label">{opt.label}</span>
              <span className="speed-tab-desc">{opt.desc}</span>
            </button>
          ))}
        </div>

        <div className="products-grid" style={{ marginTop: '1.5rem' }}>
          {speedFilteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          11. HOW DRONE DELIVERY WORKS (6-STEP VISUAL)
      ══════════════════════════════════════════ */}
      <section className="ecom-section how-it-works-section">
        <div className="how-it-works-header">
          <span className="section-pre-label">Seamless Logistics</span>
          <h2 className="section-main-title">How Drone Delivery Works</h2>
          <p className="section-sub-desc">From click to contactless landing drop in 6 simple autonomous steps.</p>
        </div>

        <div className="how-it-works-steps-grid">
          <div className="step-card">
            <span className="step-num">01</span>
            <div className="step-icon-circle"><ShoppingBag size={20} /></div>
            <h4 className="step-title">Choose Products</h4>
            <p className="step-desc">Browse thousands of groceries, medicines, food, and tech essentials.</p>
          </div>

          <div className="step-card">
            <span className="step-num">02</span>
            <div className="step-icon-circle"><MapPin size={20} /></div>
            <h4 className="step-title">Select Drop Zone</h4>
            <p className="step-desc">Pick your backyard lawn, patio, or registered building rooftop pad.</p>
          </div>

          <div className="step-card">
            <span className="step-num">03</span>
            <div className="step-icon-circle"><Box size={20} /></div>
            <h4 className="step-title">Thermal Vault Lock</h4>
            <p className="step-desc">Order is packed into a shock-proof, temperature-regulated cargo capsule.</p>
          </div>

          <div className="step-card">
            <span className="step-num">04</span>
            <div className="step-icon-circle"><Plane size={20} /></div>
            <h4 className="step-title">Autonomous Takeoff</h4>
            <p className="step-desc">Electric quadcopter ascends into dedicated high-speed flight corridor.</p>
          </div>

          <div className="step-card">
            <span className="step-num">05</span>
            <div className="step-icon-circle"><Radio size={20} /></div>
            <h4 className="step-title">Track Live in 3D</h4>
            <p className="step-desc">Watch real-time altitude, speed, and ETA on your interactive GPS map.</p>
          </div>

          <div className="step-card">
            <span className="step-num">06</span>
            <div className="step-icon-circle"><CheckCircle2 size={20} /></div>
            <h4 className="step-title">Sonar Precision Drop</h4>
            <p className="step-desc">Optical sensors gently lower your parcel with zero human contact.</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          12. CUSTOMER TESTIMONIALS
      ══════════════════════════════════════════ */}
      <section className="ecom-section testimonials-section">
        <div className="section-title-row">
          <div>
            <span className="section-pre-label">Real Flight Experiences</span>
            <h2 className="section-main-title">What Our Customers Say</h2>
          </div>
        </div>

        <div className="testimonials-grid">
          {TESTIMONIALS.map((item) => (
            <div key={item.id} className="testimonial-card">
              <div className="testimonial-stars">
                {[...Array(item.rating)].map((_, i) => (
                  <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />
                ))}
              </div>
              <h4 className="testimonial-title">"{item.title}"</h4>
              <p className="testimonial-body">{item.content}</p>
              <div className="testimonial-author-row">
                <img src={item.avatar} alt={item.author} className="author-avatar" />
                <div>
                  <div className="author-name">{item.author}</div>
                  <div className="author-role">{item.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          13. RECENTLY VIEWED (IF ANY)
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
            {recentlyViewed.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          14. NEWSLETTER SIGNUP BANNER (SCREENSHOT 2)
      ══════════════════════════════════════════ */}
      <section className="ecom-newsletter-section">
        <div className="newsletter-card-inner">
          <div className="newsletter-image-side">
            <img
              src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80"
              alt="Join SkyNav"
              className="newsletter-cover-img"
            />
          </div>
          <div className="newsletter-text-side">
            <span className="newsletter-tag">GET 15% OFF YOUR FIRST AERIAL ORDER</span>
            <h2 className="newsletter-heading">Get Updates From The Sky</h2>
            <p className="newsletter-sub">
              Sign up for exclusive flash air drops, new corridor launches, and seasonal discounts directly in your inbox.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert('Thank you for subscribing to SkyNav Flight Updates!');
              }}
              className="newsletter-form"
            >
              <input
                type="email"
                placeholder="Enter your email address..."
                className="newsletter-input"
                required
              />
              <button type="submit" className="newsletter-submit-btn">
                Subscribe <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      </section>

    </div>
  );
};
