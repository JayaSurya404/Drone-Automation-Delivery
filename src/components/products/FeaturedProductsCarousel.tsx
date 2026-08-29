import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types/product';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import { AuthRequiredModal } from '../common/AuthRequiredModal';
import { Heart, Star, ChevronLeft, ChevronRight, ShoppingBag, Zap, Check } from 'lucide-react';
import { PendingAction } from '../../types/auth';

interface FeaturedProductsCarouselProps {
  products: Product[];
}

export const FeaturedProductsCarousel: React.FC<FeaturedProductsCarouselProps> = ({ products }) => {
  const { isAuthenticated, setPendingAction } = useAuth();
  const { addToCart, items } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { showToast } = useNotifications();

  // Curated list of featured products
  const featuredList = products.slice(0, 6);
  const [activeIndex, setActiveIndex] = useState(1);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<PendingAction | undefined>(undefined);

  if (featuredList.length === 0) return null;

  const total = featuredList.length;

  const handlePrev = () => {
    setActiveIndex(prev => (prev - 1 + total) % total);
  };

  const handleNext = () => {
    setActiveIndex(prev => (prev + 1) % total);
  };

  const handleWishlistClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
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
      `${product.name} ${added ? 'saved.' : 'removed.'}`,
      'info'
    );
  };

  const handleAddToCartClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      const action: PendingAction = {
        type: 'add_to_cart',
        productId: product.id,
        quantity: 1,
        productName: product.name,
        returnTo: window.location.pathname + window.location.search,
      };
      setModalAction(action);
      setPendingAction(action);
      setAuthModalOpen(true);
      return;
    }

    addToCart(product, 1);
    showToast('Added to Cart', `${product.name} added to your basket.`, 'success');
  };

  // Get previous, active, and next indices for 3-card stage
  const prevIndex = (activeIndex - 1 + total) % total;
  const nextIndex = (activeIndex + 1) % total;

  const visibleCards = [
    { product: featuredList[prevIndex], position: 'left', index: prevIndex },
    { product: featuredList[activeIndex], position: 'center', index: activeIndex },
    { product: featuredList[nextIndex], position: 'right', index: nextIndex },
  ];

  return (
    <>
      <section className="ecom-section featured-carousel-section">
        {/* ── Heading Row ── */}
        <div className="featured-section-header">
          <span className="featured-eyebrow">CURATED DISPATCH</span>
          <h2 className="featured-main-title">Featured Aerial Products</h2>
          <p className="featured-subtitle">
            Explore our most popular customer favorites, delivered in minutes straight to your lawn or roof.
          </p>
        </div>

        {/* ── 3D Carousel Stage ── */}
        <div className="featured-stage-container">
          {/* Left Arrow Button */}
          <button
            type="button"
            className="carousel-nav-btn prev-btn"
            onClick={handlePrev}
            aria-label="Previous product"
          >
            <ChevronLeft size={22} />
          </button>

          {/* 3D Cards Stage (Left, Center, Right) */}
          <div className="featured-stage-cards">
            {visibleCards.map(({ product, position, index }) => {
              const isCenter = position === 'center';
              const isFav = isInWishlist(product.id);
              const inCart = items.some(i => i.product.id === product.id);

              let badgeText = 'FEATURED';
              if (index === 0) badgeText = 'NEW';
              else if (index === 1) badgeText = 'BEST SELLER';
              else if (index === 2) badgeText = 'TRENDING';
              else if (index === 3) badgeText = 'POPULAR';
              else if (index === 4) badgeText = 'HOT MEAL';
              else if (index === 5) badgeText = 'EXPRESS';

              return (
                <div
                  key={`${product.id}-${position}`}
                  className={`featured-carousel-card card-${position}`}
                  onClick={() => {
                    if (!isCenter) setActiveIndex(index);
                  }}
                >
                  {/* Card Top: Badge + Wishlist */}
                  <div className="featured-card-top-row">
                    <span className={`featured-badge-pill ${isCenter ? 'active-badge' : ''}`}>
                      {badgeText}
                    </span>
                    <button
                      type="button"
                      className={`featured-heart-btn ${isFav ? 'active' : ''}`}
                      onClick={(e) => handleWishlistClick(e, product)}
                      aria-label="Wishlist"
                    >
                      <Heart
                        size={16}
                        fill={isFav ? '#ef4444' : 'none'}
                        color={isFav ? '#ef4444' : '#94a3b8'}
                      />
                    </button>
                  </div>

                  {/* Product Image */}
                  <div className="featured-card-img-wrap">
                    <Link
                      to={`/products/${product.id}`}
                      onClick={(e) => {
                        if (!isCenter) e.preventDefault();
                      }}
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="featured-stage-img"
                        loading="lazy"
                      />
                    </Link>
                  </div>

                  {/* Visual dots */}
                  <div className="featured-card-dots">
                    <span className={isCenter ? 'dot-active' : ''} />
                    <span />
                    <span />
                  </div>

                  {/* Product Information */}
                  <div className="featured-card-body">
                    <h3 className="featured-card-heading">
                      <Link to={`/products/${product.id}`}>{product.name}</Link>
                    </h3>
                    <p className="featured-card-desc">{product.description}</p>

                    {/* Rating & Speed Pill */}
                    <div className="featured-card-meta-line">
                      <div className="meta-stars">
                        <Star size={13} fill="#f59e0b" color="#f59e0b" />
                        <span className="rating-score">{product.rating}</span>
                        <span className="rating-count">({product.reviewCount})</span>
                      </div>
                      {product.isDroneEligible && (
                        <span className="featured-eta-badge">
                          <Zap size={10} fill="#0284c7" color="#0284c7" /> ~{product.estimatedDeliveryMins}m Air
                        </span>
                      )}
                    </div>

                    {/* Price & Add to Cart */}
                    <div className="featured-card-buy-row">
                      <div className="featured-price-group">
                        <span className="featured-curr-price">${product.price.toFixed(2)}</span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="featured-orig-price">${product.originalPrice.toFixed(2)}</span>
                        )}
                      </div>

                      {isCenter ? (
                        <button
                          type="button"
                          className="featured-center-add-btn"
                          onClick={(e) => handleAddToCartClick(e, product)}
                        >
                          {inCart ? (
                            <>
                              <Check size={14} /> Added
                            </>
                          ) : (
                            <>
                              <ShoppingBag size={14} /> Add to Cart
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="featured-side-cart-btn"
                          onClick={(e) => handleAddToCartClick(e, product)}
                          aria-label="Add to cart"
                        >
                          <ShoppingBag size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            className="carousel-nav-btn next-btn"
            onClick={handleNext}
            aria-label="Next product"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* ── Pagination Dots ── */}
        <div className="featured-carousel-pagination">
          {featuredList.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`carousel-pag-dot ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => setActiveIndex(idx)}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Auth Modal */}
      <AuthRequiredModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        action={modalAction}
      />
    </>
  );
};
