import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAddress } from '../../context/AddressContext';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Product } from '../../types/product';
import { storage } from '../../services/storage';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Zap,
  Tag,
  ShieldCheck,
  Plane,
  Heart,
  MapPin,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';

const SAVED_FOR_LATER_KEY = 'skynav_saved_for_later';

export const CartPage: React.FC = () => {
  const {
    items,
    updateQuantity,
    removeFromCart,
    clearCart,
    addToCart,
    subtotal,
    deliveryFee,
    tax,
    discount,
    total,
    appliedPromo,
    applyPromoCode,
    removePromoCode,
    totalWeightGrams,
  } = useCart();

  const { addToWishlist } = useWishlist();
  const { showToast } = useNotifications();
  const { defaultAddress } = useAddress();
  const navigate = useNavigate();

  const [savedForLater, setSavedForLater] = useState<Product[]>(() => {
    return storage.get<Product[]>(SAVED_FOR_LATER_KEY, []);
  });

  const [promoInput, setPromoInput] = useState<string>('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Free delivery threshold (₹500)
  const FREE_DELIVERY_THRESHOLD = 500;
  const amountNeededForFree = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const freeDeliveryProgress = Math.min(100, Math.round((subtotal / FREE_DELIVERY_THRESHOLD) * 100));

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    const res = await applyPromoCode(promoInput.trim());
    setPromoMessage({ text: res.message, isError: !res.success });
    if (res.success) {
      setPromoInput('');
      showToast('Promo Code Applied!', res.message, 'success');
    }
  };

  const handleSaveForLater = (product: Product) => {
    removeFromCart(product.id);
    const updated = [product, ...savedForLater.filter(p => p.id !== product.id)];
    setSavedForLater(updated);
    storage.set(SAVED_FOR_LATER_KEY, updated);
    showToast('Saved for Later', `${product.name} moved to saved items.`, 'info');
  };

  const handleMoveToCart = (product: Product) => {
    addToCart(product, 1);
    const updated = savedForLater.filter(p => p.id !== product.id);
    setSavedForLater(updated);
    storage.set(SAVED_FOR_LATER_KEY, updated);
    showToast('Moved to Basket', `${product.name} added back to your cart.`, 'success');
  };

  const handleRemoveSaved = (productId: string) => {
    const updated = savedForLater.filter(p => p.id !== productId);
    setSavedForLater(updated);
    storage.set(SAVED_FOR_LATER_KEY, updated);
  };

  if (items.length === 0 && savedForLater.length === 0) {
    return (
      <div className="main-content">
        <EmptyState
          icon={<ShoppingBag size={42} color="var(--accent-blue)" />}
          title="Your Shopping Basket is Empty"
          description="You haven't loaded any drone delivery items into your basket yet. Explore our rapid marketplace to order fresh food, medicine, and tech."
          actionText="Start Shopping"
          onAction={() => navigate('/products')}
        />
      </div>
    );
  }

  return (
    <div className="main-content ecom-cart-page">
      {/* ── Header ── */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div className="section-label">
            <ShoppingBag size={14} color="#0ea5e9" /> Aerial Delivery Basket
          </div>
          <h1 style={{ margin: '0.2rem 0 0.35rem', letterSpacing: '-0.03em' }}>
            Shopping Cart ({items.length} {items.length === 1 ? 'item' : 'items'})
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Total payload weight: <strong>{totalWeightGrams}g</strong> • Ready for autonomous dispatch.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            style={{ fontSize: '0.85rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            <Trash2 size={15} /> Clear Basket
          </button>
        )}
      </div>

      {/* ── Cart Layout: Items on Left + Order Summary on Right ── */}
      <div className="ecom-cart-layout">

        {/* ── LEFT: CART ITEMS & SAVED FOR LATER ── */}
        <div className="cart-items-column">

          {/* Delivery Location Preview Strip */}
          <div className="cart-address-banner">
            <div className="banner-left-info">
              <MapPin size={18} color="var(--accent-blue)" />
              <div>
                <span className="banner-title">Delivering by Drone to:</span>
                <span className="banner-addr">
                  <strong>{defaultAddress?.label || 'Home'}</strong> - {defaultAddress?.building}, {defaultAddress?.street}
                </span>
              </div>
            </div>
            <Link to="/addresses" className="banner-change-link">
              Change
            </Link>
          </div>

          {/* Free Delivery Progress Bar */}
          <div className="free-delivery-progress-card">
            <div className="progress-header">
              {amountNeededForFree > 0 ? (
                <span>
                  Add <strong style={{ color: 'var(--accent-blue)' }}>₹{amountNeededForFree.toLocaleString('en-IN')}</strong> more for <strong>FREE Drone Express Delivery</strong>!
                </span>
              ) : (
                <span style={{ color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={16} /> You've unlocked FREE Drone Express Air Drop!
                </span>
              )}
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${freeDeliveryProgress}%` }} />
            </div>
          </div>

          {/* Cart Item Cards */}
          {items.length > 0 ? (
            <div className="cart-items-list">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="cart-item-card">
                  {/* Image */}
                  <Link to={`/products/${product.id}`} className="cart-item-img-link">
                    <img src={product.image} alt={product.name} className="cart-item-img" />
                  </Link>

                  {/* Details */}
                  <div className="cart-item-info">
                    <div className="item-category-row">
                      <span className="item-cat-badge">{product.brand || product.category}</span>
                      <span className="item-eta-pill">
                        <Zap size={11} fill="#0ea5e9" color="#0ea5e9" /> ~{product.estimatedDeliveryMins}m by Air
                      </span>
                    </div>

                    <Link to={`/products/${product.id}`} className="item-title-link">
                      <h3 className="item-title">{product.name}</h3>
                    </Link>

                    <div className="item-price-row">
                      <span className="item-unit-price">₹{product.price.toLocaleString('en-IN')}</span>
                      {product.originalPrice && (
                        <span className="item-mrp">₹{product.originalPrice.toLocaleString('en-IN')}</span>
                      )}
                      <span className="item-weight-tag">{product.weightGrams * quantity}g payload</span>
                    </div>

                    {/* Stepper + Actions */}
                    <div className="item-actions-row">
                      <div className="cart-stepper">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                          className="cart-stepper-btn"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="cart-stepper-val">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                          className="cart-stepper-btn"
                          disabled={quantity >= product.stockCount}
                          aria-label="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <div className="item-link-actions">
                        <button
                          type="button"
                          onClick={() => handleSaveForLater(product)}
                          className="cart-link-btn"
                        >
                          <Heart size={14} /> Save for later
                        </button>
                        <span className="action-sep">|</span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(product.id)}
                          className="cart-link-btn danger"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Item Subtotal Right */}
                  <div className="item-total-col">
                    <span className="item-subtotal-price">₹{(product.price * quantity).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '2.5rem', background: '#ffffff', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-default)', textAlign: 'center', marginBottom: '2rem' }}>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem' }}>No active items in your basket.</p>
              <Button variant="primary" size="sm" onClick={() => navigate('/products')}>
                Discover Products
              </Button>
            </div>
          )}

          {/* ── SAVED FOR LATER SECTION ── */}
          {savedForLater.length > 0 && (
            <div className="saved-for-later-section">
              <div className="saved-section-header">
                <Heart size={16} fill="#0ea5e9" color="#0ea5e9" />
                <h3>Saved for Later ({savedForLater.length} items)</h3>
              </div>

              <div className="saved-items-grid">
                {savedForLater.map(product => (
                  <div key={product.id} className="saved-item-card">
                    <img src={product.image} alt={product.name} className="saved-img" />
                    <div className="saved-info">
                      <div className="saved-name">{product.name}</div>
                      <div className="saved-price">₹{product.price.toLocaleString('en-IN')}</div>
                      <div className="saved-actions">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleMoveToCart(product)}
                        >
                          Move to Basket
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSaved(product.id)}
                          className="saved-remove-btn"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: ORDER SUMMARY CARD ── */}
        <div className="cart-summary-column">
          <div className="order-summary-card">
            <h3 className="summary-title">Order Summary</h3>

            {/* Coupon Code Box */}
            <form onSubmit={handleApplyPromo} className="promo-code-box">
              <div className="promo-input-group">
                <Tag size={16} className="promo-icon" />
                <input
                  type="text"
                  placeholder="Enter Promo Code (e.g. DRONEFAST)"
                  value={promoInput}
                  onChange={e => setPromoInput(e.target.value)}
                  className="promo-input"
                />
                <button type="submit" className="promo-apply-btn">Apply</button>
              </div>
              {promoMessage && (
                <div className={`promo-feedback ${promoMessage.isError ? 'error' : 'success'}`}>
                  {promoMessage.text}
                </div>
              )}
              {appliedPromo && (
                <div className="applied-promo-pill">
                  <span>Code: <strong>{appliedPromo}</strong> applied</span>
                  <button type="button" onClick={removePromoCode} className="remove-promo-btn">Remove</button>
                </div>
              )}
            </form>

            {/* Price Line Items */}
            <div className="summary-breakdown">
              <div className="breakdown-row">
                <span className="row-label">Items Subtotal ({items.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
                <span className="row-val">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              {discount > 0 && (
                <div className="breakdown-row discount-row">
                  <span className="row-label">Instant Coupon Savings</span>
                  <span className="row-val">-₹{discount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="breakdown-row">
                <span className="row-label">
                  Autonomous Air Flight Dispatch
                  {deliveryFee === 0 && <span className="free-tag">FREE</span>}
                </span>
                <span className="row-val">
                  {deliveryFee === 0 ? '₹0' : `₹${deliveryFee.toLocaleString('en-IN')}`}
                </span>
              </div>

              <div className="breakdown-row">
                <span className="row-label">Estimated Taxes & Airport Fees (5% GST)</span>
                <span className="row-val">₹{tax.toLocaleString('en-IN')}</span>
              </div>

              <div className="summary-divider" />

              <div className="breakdown-row total-row">
                <span className="total-label">Total Amount</span>
                <span className="total-val">₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Checkout Action */}
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/checkout')}
              disabled={items.length === 0}
              rightIcon={<ArrowRight size={18} />}
              className="checkout-primary-btn"
            >
              Proceed to Checkout
            </Button>

            {/* Trust Badges */}
            <div className="cart-trust-badges">
              <div className="trust-item">
                <ShieldCheck size={16} color="#10b981" />
                <span>Encrypted 256-Bit Payment</span>
              </div>
              <div className="trust-item">
                <Zap size={16} color="#0ea5e9" />
                <span>Guaranteed 15-Min Touchdown</span>
              </div>
              <div className="trust-item">
                <CheckCircle2 size={16} color="#6366f1" />
                <span>Contactless Precision Sonar</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
