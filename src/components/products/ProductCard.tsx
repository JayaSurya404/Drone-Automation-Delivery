import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Product } from '../../types/product';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import { Plus, Minus, Zap, Star, Heart, ShoppingBag } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  layout?: 'grid' | 'compact' | 'horizontal';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, layout = 'grid' }) => {
  const { addToCart, updateQuantity, items } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [isHovered, setIsHovered] = useState(false);
  const isFavorited = isInWishlist(product.id);

  const cartItem = items.find(i => i.product.id === product.id);
  const isInCart = !!cartItem;
  const quantity = cartItem?.quantity || 0;

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleWishlist(product);
    showToast(
      added ? 'Added to Wishlist' : 'Removed from Wishlist',
      `${product.name} ${added ? 'saved to your wishlist.' : 'removed.'}`,
      'info'
    );
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
    showToast('Added to Cart', `${product.name} added to your basket.`, 'success');
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isInCart) {
      addToCart(product, 1);
    }
    navigate('/checkout');
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(product.id, quantity + 1);
  };

  const handleDecrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(product.id, quantity - 1);
  };

  return (
    <div
      className={`ecom-product-card ${layout}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Image & Badges Container ── */}
      <div className="product-image-box">
        <Link to={`/products/${product.id}`} className="product-image-link">
          <img
            src={product.image}
            alt={product.name}
            className="product-main-image"
            style={{ transform: isHovered ? 'scale(1.06)' : 'scale(1)' }}
            loading="lazy"
          />
        </Link>

        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          className={`product-wishlist-btn ${isFavorited ? 'active' : ''}`}
          aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart
            size={16}
            fill={isFavorited ? '#ef4444' : 'none'}
            color={isFavorited ? '#ef4444' : '#64748b'}
          />
        </button>

        {/* Discount Badge on Image */}
        {product.discountPercent && product.discountPercent > 0 && (
          <div className="product-discount-tag">
            -{product.discountPercent}%
          </div>
        )}

        {/* Drone Speed Pill on Image */}
        {product.isDroneEligible && (
          <div className="product-drone-pill">
            <Zap size={11} fill="#0284c7" color="#0284c7" />
            <span>~{product.estimatedDeliveryMins}m Air ETA</span>
          </div>
        )}
      </div>

      {/* ── Product Info & Pricing ── */}
      <div className="product-card-details">
        {/* Brand / Category Tag */}
        <div className="product-card-category">
          <span>{product.brand || product.category}</span>
        </div>

        {/* Product Title */}
        <h3 className="product-card-title">
          <Link to={`/products/${product.id}`} title={product.name}>
            {product.name}
          </Link>
        </h3>

        {/* Star Rating & Reviews */}
        <div className="product-rating-row">
          <div className="rating-stars-wrap">
            <Star size={13} fill="#f59e0b" color="#f59e0b" />
            <span className="rating-score">{product.rating}</span>
          </div>
          <span className="rating-review-count">({product.reviewCount})</span>
        </div>

        {/* Price & Savings Display */}
        <div className="product-pricing-box">
          <div className="product-price-line">
            <span className="product-current-price">
              ${product.price.toFixed(2)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="product-original-price">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
          {product.discountPercent && product.discountPercent > 0 && (
            <span className="product-discount-pill">
              {product.discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Action Buttons: Add to Cart & Buy Now */}
        <div className="product-card-actions-row">
          {isInCart ? (
            <div className="product-qty-stepper" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={handleDecrease}
                className="stepper-btn minus"
                aria-label="Decrease quantity"
              >
                <Minus size={13} />
              </button>
              <span className="stepper-number">{quantity} in Cart</span>
              <button
                type="button"
                onClick={handleIncrease}
                className="stepper-btn plus"
                aria-label="Increase quantity"
              >
                <Plus size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              className="card-add-cart-btn"
              aria-label="Add to cart"
            >
              <ShoppingBag size={14} />
              <span>Add</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleBuyNow}
            className="card-buy-now-btn"
            aria-label="Buy Now with Instant Flight"
          >
            <Zap size={13} fill="#ffffff" color="#ffffff" />
            <span>Buy Now</span>
          </button>
        </div>

      </div>
    </div>
  );
};
