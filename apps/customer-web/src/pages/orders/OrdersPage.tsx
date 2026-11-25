import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../../context/OrderContext';
import { CustomerOrder } from '../../types/order';
import { OrderCard } from '../../components/orders/OrderCard';
import { Modal } from '../../components/common/Modal';
import { StarRating } from '../../components/common/StarRating';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Input } from '../../components/common/Input';
import { Package, Search, Filter, Star, Sparkles } from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const { orders, rateOrder } = useOrders();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Pending' | 'Delivered' | 'Cancelled'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Rating Modal state
  const [ratingOrder, setRatingOrder] = useState<CustomerOrder | null>(null);
  const [stars, setStars] = useState<number>(5);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  const handleOpenRating = (order: CustomerOrder) => {
    setRatingOrder(order);
    setStars(5);
    setFeedback('');
  };

  const handleSaveRating = async () => {
    if (!ratingOrder) return;
    setIsSubmittingRating(true);
    try {
      await rateOrder(ratingOrder.id, stars, feedback);
      setRatingOrder(null);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    // Tab filtering
    if (activeTab === 'Active') {
      const isAct =
        order.status !== 'Delivered' &&
        order.status !== 'Cancelled' &&
        order.status !== 'Delivery Failed';
      if (!isAct) return false;
    } else if (activeTab === 'Pending') {
      if (order.status !== 'Order Placed' && order.status !== 'Order Confirmed' && order.status !== 'Preparing')
        return false;
    } else if (activeTab === 'Delivered') {
      if (order.status !== 'Delivered') return false;
    } else if (activeTab === 'Cancelled') {
      if (order.status !== 'Cancelled' && order.status !== 'Delivery Failed') return false;
    }

    // Search query filtering (by Order ID or item title)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesId = order.id.toLowerCase().includes(q);
      const matchesItem = order.items.some((i) => i.product.name.toLowerCase().includes(q));
      if (!matchesId && !matchesItem) return false;
    }

    return true;
  });

  return (
    <div className="main-content">
      {/* Header */}
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div className="section-label">📦 Order History</div>
        <h1 style={{ margin: '0.25rem 0 0.4rem', letterSpacing: '-0.03em' }}>My Drone Deliveries</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
          Track active flights, view completed deliveries, and rate your experiences.
        </p>
      </div>

      {/* Filter Tabs & Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Premium Pill Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: 'var(--radius-full)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {(['All', 'Active', 'Pending', 'Delivered', 'Cancelled'] as const).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.45rem 1.05rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.845rem',
                  fontWeight: isSelected ? 700 : 600,
                  background: isSelected ? '#ffffff' : 'transparent',
                  color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ flex: '1 1 260px', maxWidth: '360px' }}>
          <Input
            placeholder="Search by Order ID or item name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={16} />}
            style={{ marginBottom: 0 }}
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Package size={36} />}
          title="No Orders Found"
          description={
            searchQuery
              ? `No orders matching "${searchQuery}".`
              : "You haven't placed any orders in this category yet."
          }
          actionText="Place an Order"
          onAction={() => navigate('/products')}
        />
      ) : (
        <div>
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onRate={(o) => handleOpenRating(o)}
            />
          ))}
        </div>
      )}

      {/* Rating & Feedback Modal (Section 41) */}
      <Modal
        isOpen={!!ratingOrder}
        onClose={() => setRatingOrder(null)}
        title="Rate Your Drone Delivery Experience"
      >
        {ratingOrder && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              How was your automated drop-off for Order <strong>#{ratingOrder.id}</strong>?
            </p>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <StarRating
                  rating={stars}
                  interactive
                  onRatingChange={(newStars) => setStars(newStars)}
                  size={32}
                />
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {stars === 5 ? 'Exceptional Landing 🚀' : stars === 4 ? 'Great Flight ⚡' : stars === 3 ? 'Average Drop' : 'Needs Improvement'}
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Optional Flight & Delivery Feedback</label>
              <textarea
                rows={3}
                className="form-control"
                placeholder="e.g. Prompt landing right in the center of the lawn pad, package was blazing hot!"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setRatingOrder(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={isSubmittingRating}
                onClick={handleSaveRating}
              >
                Submit Delivery Review
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
