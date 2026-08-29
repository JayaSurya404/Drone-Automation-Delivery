import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useNotifications } from '../../context/NotificationContext';
import { ProductCard } from '../../components/products/ProductCard';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';

export const WishlistPage: React.FC = () => {
  const { wishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const handleMoveAllToCart = () => {
    if (wishlist.length === 0) return;
    wishlist.forEach(product => {
      addToCart(product, 1);
    });
    showToast('Moved to Basket', `All ${wishlist.length} saved items added to your drone basket.`, 'success');
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div className="section-label">
            <Heart size={14} fill="#0ea5e9" color="#0ea5e9" /> Saved Items
          </div>
          <h1 style={{ margin: '0.25rem 0 0.35rem', letterSpacing: '-0.03em' }}>
            My Wishlist ({wishlist.length})
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Products you've saved for fast one-tap drone dispatch.
          </p>
        </div>

        {wishlist.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={clearWishlist}
              leftIcon={<Trash2 size={15} color="var(--danger)" />}
            >
              Clear All
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleMoveAllToCart}
              leftIcon={<ShoppingBag size={15} />}
            >
              Add All to Basket
            </Button>
          </div>
        )}
      </div>

      {/* Wishlist Grid or Empty State */}
      {wishlist.length === 0 ? (
        <EmptyState
          icon={<Heart size={36} color="var(--accent-blue)" />}
          title="Your Wishlist is Empty"
          description="Explore our rapid drone delivery marketplace and tap the heart icon on any product to save it here for fast one-click ordering."
          actionText="Discover Products"
          onAction={() => navigate('/products')}
        />
      ) : (
        <div>
          <div className="products-grid">
            {wishlist.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Bottom Callout */}
          <div
            style={{
              marginTop: '3rem',
              padding: '1.75rem 2rem',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #eef2ff 100%)',
              border: '1px solid rgba(14,165,233,0.2)',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.25rem',
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
                🚁 Ready for lightning 15-minute delivery?
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                All items in your wishlist are pre-stocked at local air corridors for immediate flight release.
              </p>
            </div>
            <Button variant="primary" onClick={() => navigate('/cart')} rightIcon={<ArrowRight size={16} />}>
              Go to Basket
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
