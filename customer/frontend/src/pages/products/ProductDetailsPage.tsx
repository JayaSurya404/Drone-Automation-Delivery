import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAddress } from '../../context/AddressContext';
import { ProductCard } from '../../components/products/ProductCard';
import { Button } from '../../components/common/Button';
import { StarRating } from '../../components/common/StarRating';
import { Skeleton } from '../../components/common/Skeleton';
import { AuthRequiredModal } from '../../components/common/AuthRequiredModal';
import { Product } from '../../types/product';
import { PendingAction } from '../../types/auth';
import { storage } from '../../services/storage';
import { api } from '../../services/api';
import {
  ShoppingBag,
  Zap,
  Star,
  Heart,
  Share2,
  Check,
  Plus,
  Minus,
  MapPin,
  ShieldCheck,
  Plane,
  Truck,
  RotateCcw,
  Clock,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

const RECENTLY_VIEWED_KEY = 'skynav_recently_viewed';

export const ProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, setPendingAction } = useAuth();
  const { addToCart, items } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useNotifications();
  const { defaultAddress } = useAddress();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'reviews' | 'safety'>('desc');
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<PendingAction | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    api.products.getById(id)
      .then((found) => {
        if (!isMounted || !found) return;
        setProduct(found);
        setSelectedImageIndex(0);
        setQuantity(1);

        // Record to recently viewed
        const prevIds = storage.get<string[]>(RECENTLY_VIEWED_KEY, []);
        const updated = [found.id, ...prevIds.filter(i => i !== found.id)].slice(0, 8);
        storage.set(RECENTLY_VIEWED_KEY, updated);

        // Fetch related products
        api.products.getAll({ category: found.category }).then((related) => {
          if (isMounted) {
            setRelatedProducts(related.filter(p => p.id !== found.id).slice(0, 4));
          }
        }).catch(() => {});
      })
      .catch((err) => {
        console.error('Failed to load product details:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (!product) {
    return (
      <div className="main-content">
        <Skeleton width={200} height={24} className="mb-4" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
          <Skeleton height={420} borderRadius="var(--radius-xl)" />
          <div>
            <Skeleton height={36} className="mb-2" />
            <Skeleton height={20} width={180} className="mb-4" />
            <Skeleton height={48} width={140} className="mb-4" />
            <Skeleton height={100} className="mb-4" />
            <Skeleton height={52} />
          </div>
        </div>
      </div>
    );
  }

  const isFavorited = isInWishlist(product.id);
  const images = product.images && product.images.length > 0 ? product.images : [product.image];
  const activeImage = images[selectedImageIndex] || product.image;

  const savings = product.originalPrice ? product.originalPrice - product.price : 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      const action: PendingAction = {
        type: 'add_to_cart',
        productId: product.id,
        quantity,
        productName: product.name,
        returnTo: window.location.pathname + window.location.search,
      };
      setModalAction(action);
      setPendingAction(action);
      setAuthModalOpen(true);
      return;
    }
    addToCart(product, quantity);
    showToast('Added to Basket', `${quantity}x ${product.name} added to your drone basket.`, 'success');
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) {
      const action: PendingAction = {
        type: 'buy_now',
        productId: product.id,
        quantity,
        productName: product.name,
        returnTo: '/checkout',
      };
      setModalAction(action);
      setPendingAction(action);
      setAuthModalOpen(true);
      return;
    }
    addToCart(product, quantity);
    navigate('/checkout');
  };

  const handleWishlistToggle = () => {
    if (!isAuthenticated) {
      const action: PendingAction = {
        type: 'wishlist',
        productId: product.id,
        productName: product.name,
        returnTo: window.location.pathname + window.location.search,
      };
      setModalAction(action);
      setPendingAction(action);
      setAuthModalOpen(true);
      return;
    }
    const added = toggleWishlist(product);
    showToast(
      added ? 'Added to Wishlist' : 'Removed from Wishlist',
      `${product.name} ${added ? 'saved for fast drone ordering.' : 'removed from your favorites.'}`,
      'info'
    );
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link Copied', 'Product link copied to your clipboard.', 'info');
    }
  };

  return (
    <div className="main-content ecom-product-details-page">

      {/* ── Breadcrumbs ── */}
      <nav className="ecom-breadcrumbs" aria-label="Breadcrumbs">
        <Link to="/">Home</Link>
        <ChevronRight size={14} />
        <Link to={`/products?category=${product.category}`}>{product.category}</Link>
        {product.subCategory && (
          <>
            <ChevronRight size={14} />
            <Link to={`/products?category=${product.category}&sub=${product.subCategory}`}>{product.subCategory}</Link>
          </>
        )}
        <ChevronRight size={14} />
        <span className="current">{product.name}</span>
      </nav>

      {/* ── Main Product Grid: Gallery Left + Details Right ── */}
      <div className="product-details-main-grid">

        {/* ── LEFT: IMAGE GALLERY & ZOOM ── */}
        <div className="product-gallery-col">
          <div className="gallery-layout-wrap">
            {/* Thumbnail Selector */}
            {images.length > 1 && (
              <div className="gallery-thumbnails-strip">
                {images.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`gallery-thumb-btn ${idx === selectedImageIndex ? 'active' : ''}`}
                    onClick={() => setSelectedImageIndex(idx)}
                  >
                    <img src={imgUrl} alt={`${product.name} view ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}

            {/* Main Stage Image with Zoom */}
            <div
              className="gallery-main-stage"
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              onMouseMove={handleMouseMove}
            >
              <img
                src={activeImage}
                alt={product.name}
                className="gallery-display-img"
                style={{
                  transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                  transform: isZoomed ? 'scale(1.75)' : 'scale(1)',
                }}
              />

              {product.discountPercent && product.discountPercent > 0 && (
                <div className="gallery-discount-badge">
                  {product.discountPercent}% OFF
                </div>
              )}

              {/* Wishlist button */}
              <button
                type="button"
                onClick={handleWishlistToggle}
                className={`gallery-wishlist-btn ${isFavorited ? 'active' : ''}`}
                aria-label={isFavorited ? 'Remove from wishlist' : 'Save to wishlist'}
              >
                <Heart size={20} fill={isFavorited ? '#ef4444' : 'none'} color={isFavorited ? '#ef4444' : '#64748b'} />
              </button>
            </div>
          </div>

          <div className="gallery-hint">
            <Info size={13} /> Hover over image to inspect ultra-high resolution details
          </div>
        </div>

        {/* ── RIGHT: PRODUCT DETAILS & BUY BOX ── */}
        <div className="product-info-col">
          {/* Brand & Category */}
          <div className="product-brand-row">
            <span className="product-brand-link">{product.brand || 'SkyNav Verified'}</span>
            <span className="verified-badge">
              <CheckCircle2 size={13} color="#10b981" /> Verified Drone Stock
            </span>
          </div>

          {/* Title */}
          <h1 className="product-details-title">{product.name}</h1>

          {/* Ratings & Reviews */}
          <div className="product-rating-row">
            <div className="rating-pill">
              <StarRating rating={product.rating} size={15} />
              <span className="rating-num">{product.rating}</span>
            </div>
            <a href="#reviews" onClick={() => setActiveTab('reviews')} className="reviews-link">
              {product.reviewCount} customer reviews
            </a>
            <span className="rating-dot">•</span>
            <span className="in-stock-badge">
              <Check size={13} /> In Stock ({product.stockCount} units ready for takeoff)
            </span>
          </div>

          <div className="details-divider" />

          {/* ── Price Block ── */}
          <div className="product-price-block">
            <div className="price-primary-row">
              <span className="price-large">₹{product.price.toLocaleString('en-IN')}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <>
                  <span className="mrp-strikethrough">₹{product.originalPrice.toLocaleString('en-IN')}</span>
                  <span className="discount-chip">{product.discountPercent}% OFF</span>
                </>
              )}
            </div>
            {savings > 0 && (
              <div className="savings-highlight">
                You save: <strong>₹{savings.toLocaleString('en-IN')}</strong> ({product.discountPercent}% off MRP)
              </div>
            )}
            <div className="tax-inclusive-subtext">Inclusive of all taxes • Zero flight congestion surcharge</div>
          </div>

          {/* ── Drone Delivery Location Availability Card ── */}
          <div className="drone-delivery-box">
            <div className="drone-delivery-header">
              <div className="drone-box-icon">
                <Zap size={18} fill="#0ea5e9" color="#0ea5e9" />
              </div>
              <div>
                <div className="drone-box-title">
                  Autonomous Air Delivery: <strong>~{product.estimatedDeliveryMins} Minutes</strong>
                </div>
                <div className="drone-box-address">
                  <MapPin size={13} color="var(--accent-blue)" />
                  <span>
                    Delivering to: <strong>{defaultAddress ? `${defaultAddress.label} (${defaultAddress.street})` : 'Default Address'}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="drone-box-meta-grid">
              <div className="meta-item">
                <span className="meta-label">Payload Class:</span>
                <span className="meta-val">AeroLight ({product.weightGrams}g)</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Drop Method:</span>
                <span className="meta-val">{defaultAddress?.dropZoneType || 'Backyard Lawn'} Precision Sonar</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Flight Guarantee:</span>
                <span className="meta-val" style={{ color: '#059669', fontWeight: 800 }}>Free over ₹500</span>
              </div>
            </div>
          </div>

          {/* ── Quantity & Primary Buy Actions ── */}
          <div className="product-buy-section">
            <div className="quantity-select-row">
              <span className="qty-label">Quantity:</span>
              <div className="qty-stepper-box">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="qty-btn"
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  <Minus size={15} />
                </button>
                <span className="qty-value">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(product.stockCount, q + 1))}
                  className="qty-btn"
                  disabled={quantity >= product.stockCount}
                  aria-label="Increase quantity"
                >
                  <Plus size={15} />
                </button>
              </div>
              <div className="subtotal-calc-display">
                Subtotal: <strong>₹{(product.price * quantity).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="action-buttons-row">
              <Button
                variant="primary"
                size="lg"
                onClick={handleAddToCart}
                leftIcon={<ShoppingBag size={18} />}
                className="add-cart-primary-btn"
              >
                Add to Basket
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={handleBuyNow}
                leftIcon={<Zap size={18} fill="#0ea5e9" color="#0ea5e9" />}
                className="buy-now-btn"
              >
                Buy Now (Instant Flight)
              </Button>
            </div>

            <div className="secondary-action-links">
              <button type="button" onClick={handleWishlistToggle} className="secondary-action-btn">
                <Heart size={16} fill={isFavorited ? '#ef4444' : 'none'} color={isFavorited ? '#ef4444' : 'currentColor'} />
                <span>{isFavorited ? 'In Your Wishlist' : 'Add to Wishlist'}</span>
              </button>
              <button type="button" onClick={handleShare} className="secondary-action-btn">
                <Share2 size={16} />
                <span>Share Product</span>
              </button>
            </div>
          </div>

          {/* ── Key Highlights ── */}
          {product.features && product.features.length > 0 && (
            <div className="product-highlights-box">
              <h4 className="highlights-title">Key Highlights:</h4>
              <ul className="highlights-list">
                {product.features.map((feat, idx) => (
                  <li key={idx}>
                    <CheckCircle2 size={15} color="#0ea5e9" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          TABS: SPECS / REVIEWS / SAFETY / RETURNS
      ══════════════════════════════════════════ */}
      <div className="product-tabs-wrapper" id="reviews">
        <div className="product-tabs-header">
          <button
            type="button"
            className={`tab-header-btn ${activeTab === 'desc' ? 'active' : ''}`}
            onClick={() => setActiveTab('desc')}
          >
            Product Overview
          </button>
          <button
            type="button"
            className={`tab-header-btn ${activeTab === 'specs' ? 'active' : ''}`}
            onClick={() => setActiveTab('specs')}
          >
            Technical Specifications
          </button>
          <button
            type="button"
            className={`tab-header-btn ${activeTab === 'safety' ? 'active' : ''}`}
            onClick={() => setActiveTab('safety')}
          >
            Flight & Container Safety
          </button>
          <button
            type="button"
            className={`tab-header-btn ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            Customer Reviews ({product.reviewCount})
          </button>
        </div>

        <div className="product-tab-content-card">
          {/* Tab 1: Overview */}
          {activeTab === 'desc' && (
            <div className="tab-pane-content">
              <h3>Product Overview</h3>
              <p style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                {product.description}
              </p>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                Every item is pre-weighed, inspected, and balanced according to commercial autonomous quadcopter payload standards. Packaged in shock-proof, weather-sealed capsules to ensure factory freshness upon touchdown.
              </p>
            </div>
          )}

          {/* Tab 2: Specifications */}
          {activeTab === 'specs' && (
            <div className="tab-pane-content">
              <h3>Technical Specifications</h3>
              <table className="ecom-specs-table">
                <tbody>
                  <tr>
                    <th>Category</th>
                    <td>{product.category}</td>
                  </tr>
                  {product.brand && (
                    <tr>
                      <th>Brand</th>
                      <td>{product.brand}</td>
                    </tr>
                  )}
                  {product.subCategory && (
                    <tr>
                      <th>Sub-Category</th>
                      <td>{product.subCategory}</td>
                    </tr>
                  )}
                  <tr>
                    <th>Item Dimensions</th>
                    <td>{product.dimensions || 'Standard Aero Safe Packaging'}</td>
                  </tr>
                  <tr>
                    <th>Payload Weight</th>
                    <td>{product.weightGrams} grams ({ (product.weightGrams / 1000).toFixed(2) } kg)</td>
                  </tr>
                  <tr>
                    <th>Drone Flight Corridor</th>
                    <td>Commercial Class II Autonomous Airspace</td>
                  </tr>
                  {product.specifications && Object.entries(product.specifications).map(([k, v]) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: Drone Safety */}
          {activeTab === 'safety' && (
            <div className="tab-pane-content">
              <h3>Autonomous Flight & Cargo Integrity</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={{ padding: '1.25rem', background: '#f0f9ff', borderRadius: 'var(--radius-lg)', border: '1px solid #bae6fd' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#0369a1' }}>Aerodynamic Capsule Seal</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Cargo compartments maintain structural rigidity against crosswinds up to 35 knots, keeping fragile containers secure.
                  </p>
                </div>
                <div style={{ padding: '1.25rem', background: '#ecfdf5', borderRadius: 'var(--radius-lg)', border: '1px solid #a7f3d0' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#047857' }}>Active Thermal Lock</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Hot meals are kept at 65°C+ while refrigerated pharmaceuticals are held in sub-zero phase-change chilling holsters.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Verified Customer Reviews */}
          {activeTab === 'reviews' && (
            <div className="tab-pane-content">
              <div className="reviews-summary-row">
                <div className="overall-rating-card">
                  <div className="rating-huge">{product.rating}</div>
                  <StarRating rating={product.rating} size={20} />
                  <div className="rating-total-sub">{product.reviewCount} Verified Drone Deliveries</div>
                </div>

                <div className="rating-breakdown-bars">
                  {[
                    { stars: 5, pct: 85 },
                    { stars: 4, pct: 11 },
                    { stars: 3, pct: 3 },
                    { stars: 2, pct: 1 },
                    { stars: 1, pct: 0 },
                  ].map(b => (
                    <div key={b.stars} className="rating-bar-row">
                      <span className="bar-label">{b.stars} ★</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${b.pct}%` }} />
                      </div>
                      <span className="bar-pct">{b.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews List */}
              <div className="reviews-list-container">
                {product.customerReviews && product.customerReviews.length > 0 ? (
                  product.customerReviews.map(rev => (
                    <div key={rev.id} className="review-item-card">
                      <div className="review-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="review-author">{rev.author}</span>
                          {rev.verifiedPurchase && (
                            <span className="verified-purchase-tag">
                              <CheckCircle2 size={12} /> Verified Drone Flight
                            </span>
                          )}
                        </div>
                        <span className="review-date">{rev.date}</span>
                      </div>
                      <div className="review-stars-row">
                        <StarRating rating={rev.rating} size={14} />
                        <span className="review-title">{rev.title}</span>
                      </div>
                      <p className="review-comment-text">{rev.comment}</p>
                      <div className="review-helpful-count">
                        {rev.helpfulCount} customers found this helpful
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No customer reviews yet. Be the first to order and review this product!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          RELATED PRODUCTS CAROUSEL
      ══════════════════════════════════════════ */}
      {relatedProducts.length > 0 && (
        <section className="ecom-section related-products-section">
          <div className="section-title-row">
            <div>
              <span className="section-pre-label">Related Products</span>
              <h2 className="section-main-title">Frequently Ordered Together</h2>
            </div>
          </div>
          <div className="products-grid">
            {relatedProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Auth Modal for Guests */}
      <AuthRequiredModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        action={modalAction}
      />
    </div>
  );
};
