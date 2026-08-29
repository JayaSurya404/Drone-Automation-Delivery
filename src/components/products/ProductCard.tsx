import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types/product';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import { Plus, Minus, Zap, Star, Heart, Check, ShoppingBag } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, updateQuantity, items } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useNotifications();

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
      `${product.name} ${added ? 'saved for fast drone ordering.' : 'removed from your favorites.'}`,
      'info'
    );
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
    showToast('Added to Basket', `${product.name} added to your drone delivery basket.`, 'success');
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
      className="ecom-product-card"
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
          <Heart size={17} fill={isFavorited ? '#ef4444' : 'none'} color={isFavorited ? '#ef4444' : '#64748b'} />
        </button>

        {/* Discount Badge */}
        {product.discountPercent && product.discountPercent > 0 && (
          <div className="product-discount-tag">
            {product.discountPercent}% OFF
          </div>
        )}

        {/* Drone Speed Pill on image */}
        {product.isDroneEligible && (
          <div className="product-drone-pill">
            <Zap size={11} fill="#0284c7" color="#0284c7" />
            <span>~{product.estimatedDeliveryMins}m by Air</span>
          </div>
        )}
      </div>

      {/* ── Product Info & Pricing ── */}
      <div className="product-card-details">
        {/* Category & Rating Row */}
        <div className="product-top-row">
          <span className="product-brand-tag">
            {product.brand || product.category}
          </span>
          <div className="product-rating-box">
            <Star size={12} fill="#f59e0b" color="#f59e0b" />
            <span className="rating-score">{product.rating}</span>
            <span className="rating-count">({product.reviewCount})</span>
          </div>
        </div>

        {/* Product Title */}
        <Link to={`/products/${product.id}`} className="product-title-link">
          <h3 className="product-title-text" title={product.name}>
            {product.name}
          </h3>
        </Link>

        {/* Price & Savings */}
        <div className="product-pricing-row">
          <div className="price-col">
            <div className="price-main-wrap">
              <span className="price-current">${product.price.toFixed(2)}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="price-mrp">${product.originalPrice.toFixed(2)}</span>
              )}
            </div>
            <div className="payload-subtext">
              Payload: {product.weightGrams}g
            </div>
          </div>

          {/* Quick Cart Actions */}
          <div className="product-cart-actions" onClick={e => e.stopPropagation()}>
            {isInCart ? (
              <div className="product-qty-stepper">
                <button
                  type="button"
                  onClick={handleDecrease}
                  className="stepper-btn"
                  aria-label="Decrease quantity"
                >
                  <Minus size={13} />
                </button>
                <span className="stepper-count">{quantity}</span>
                <button
                  type="button"
                  onClick={handleIncrease}
                  className="stepper-btn"
                  aria-label="Increase quantity"
                >
                  <Plus size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                className="add-to-cart-btn"
                aria-label={`Add ${product.name} to cart`}
              >
                <Plus size={15} />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
