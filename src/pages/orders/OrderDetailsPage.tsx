import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOrders } from '../../context/OrderContext';
import { useNotifications } from '../../context/NotificationContext';
import { CustomerOrder } from '../../types/order';
import { OrderTimeline } from '../../components/orders/OrderTimeline';
import { DeliveryOtpCard } from '../../components/orders/DeliveryOtpCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import {
  ArrowLeft,
  Navigation,
  Package,
  MapPin,
  CreditCard,
  Zap,
  ShieldCheck,
  Ban,
  HelpCircle,
  Clock,
  Printer,
  Crosshair,
} from 'lucide-react';

export const OrderDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getOrderById, cancelOrder } = useOrders();
  const { showToast } = useNotifications();

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('Ordered by mistake');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);

    getOrderById(id)
      .then((data) => {
        setOrder(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Order not found.');
        setIsLoading(false);
      });
  }, [id, getOrderById]);

  const handleConfirmCancel = async () => {
    if (!order) return;
    setIsCancelling(true);

    try {
      const updated = await cancelOrder(order.id, cancelReason);
      setOrder(updated);
      setIsCancelModalOpen(false);
      showToast('Order Cancelled', 'Your order was cancelled and a full refund has been initiated.', 'info');
    } catch (err: any) {
      alert(err.message || 'Cancellation failed.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="main-content">
        <Skeleton width={120} height={20} className="mb-4" />
        <Skeleton height={140} borderRadius="var(--radius-xl)" className="mb-4" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          <Skeleton height={300} borderRadius="var(--radius-lg)" />
          <Skeleton height={300} borderRadius="var(--radius-lg)" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="main-content" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h2>Order Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
          {error || `We couldn't locate order #${id}.`}
        </p>
        <Button variant="primary" onClick={() => navigate('/orders')}>
          Return to Orders
        </Button>
      </div>
    );
  }

  const isActive =
    order.status !== 'Delivered' &&
    order.status !== 'Cancelled' &&
    order.status !== 'Delivery Failed';

  return (
    <div className="main-content">
      {/* Back Link */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          to="/orders"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to All Orders</span>
        </Link>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="secondary" size="sm" onClick={handlePrintReceipt} leftIcon={<Printer size={14} />}>
            Print Receipt
          </Button>

          <Link to="/support" state={{ prefillOrderId: order.id }}>
            <Button variant="outline" size="sm" leftIcon={<HelpCircle size={14} />}>
              Report Issue
            </Button>
          </Link>
        </div>
      </div>

      {/* Header Card */}
      <div
        className="card glass-panel"
        style={{
          padding: '1.75rem',
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, rgba(14, 21, 37, 0.85) 0%, rgba(22, 34, 58, 0.85) 100%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                Order #{order.id}
              </h1>
              <Badge variant={order.status === 'Delivered' ? 'success' : order.status === 'Cancelled' ? 'danger' : 'cyan'}>
                {isActive && <span className="pulse-dot cyan" style={{ marginRight: '4px' }} />}
                {order.status}
              </Badge>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Placed on {new Date(order.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {isActive && (
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate(`/tracking/${order.id}`)}
                leftIcon={<Navigation size={18} />}
              >
                Track Live Drone Flight
              </Button>
            )}

            {order.isCancellable && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsCancelModalOpen(true)}
                leftIcon={<Ban size={14} />}
              >
                Cancel Order
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Details and Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '2rem' }}>
        {/* Left Column: Products & Payment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Handover OTP if active */}
          {isActive && <DeliveryOtpCard otp={order.deliveryOtp} orderId={order.id} />}

          {/* Itemized Products */}
          <div className="card glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={18} color="var(--accent-cyan)" />
              <span>Delivered Cargo Items ({order.items.length})</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {order.items.map((item) => (
                <div
                  key={item.product.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
                    />
                    <div>
                      <Link to={`/products/${item.product.id}`} style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        {item.product.name}
                      </Link>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                        Qty: {item.quantity} × ${item.product.price.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-display)' }}>
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment & Charges Breakdown */}
          <div className="card glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={18} color="var(--accent-cyan)" />
              <span>Payment Breakdown</span>
            </h3>

            <div className="summary-row">
              <span>Payment Method</span>
              <strong style={{ color: 'var(--text-primary)' }}>{order.paymentMethod}</strong>
            </div>

            <div className="summary-row">
              <span>Payment Status</span>
              <span className={`badge badge-${order.paymentStatus === 'Paid' ? 'success' : 'warning'}`}>
                {order.paymentStatus}
              </span>
            </div>

            <div className="summary-row">
              <span>Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>

            <div className="summary-row">
              <span>Drone Air Delivery Fee</span>
              <span>${order.deliveryFee.toFixed(2)}</span>
            </div>

            <div className="summary-row">
              <span>Taxes & Surcharges</span>
              <span>${order.tax.toFixed(2)}</span>
            </div>

            {order.discount > 0 && (
              <div className="summary-row" style={{ color: '#10b981' }}>
                <span>Discount Applied</span>
                <span>-${order.discount.toFixed(2)}</span>
              </div>
            )}

            <div className="summary-row total">
              <span>Total Paid</span>
              <span className="text-gradient" style={{ fontSize: '1.4rem' }}>
                ${order.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Address & Flight Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Destination Card */}
          <div className="card glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={18} color="var(--accent-cyan)" />
              <span>Drop-off Destination</span>
            </h3>

            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
              {order.deliveryAddress.name}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {order.deliveryAddress.building}, {order.deliveryAddress.street}
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-tertiary)' }}>
              {order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.postalCode}
            </div>

            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.825rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 600 }}>
                <Crosshair size={14} />
                <span>Target: {order.dropZoneType || 'Lawn Pad'}</span>
              </div>
              {order.deliveryInstructions && (
                <div style={{ marginTop: '0.4rem', color: 'var(--text-secondary)' }}>
                  <em>"{order.deliveryInstructions}"</em>
                </div>
              )}
            </div>
          </div>

          {/* Visual Flight Timeline (Section 11) */}
          <div className="card glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="var(--accent-cyan)" />
              <span>Order Flight Timeline</span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
              Real-time milestones from hub loading to customer landing.
            </p>

            <OrderTimeline timeline={order.timeline} currentStatus={order.status} />
          </div>
        </div>
      </div>

      {/* Cancellation Modal (Section 34) */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Drone Order"
      >
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Are you sure you want to cancel Order <strong>#{order.id}</strong>? Since the drone has not yet departed the launchpad, your order is eligible for an instant 100% refund.
          </p>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Please select a reason for cancellation:</label>
            <select
              className="form-control"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            >
              <option value="Ordered by mistake">Ordered by mistake</option>
              <option value="Need to change landing location">Need to change landing location</option>
              <option value="Found alternative item">Found alternative item</option>
              <option value="Delivery time no longer suitable">Delivery time no longer suitable</option>
              <option value="Other reason">Other reason</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setIsCancelModalOpen(false)} disabled={isCancelling}>
              Keep Order
            </Button>
            <Button
              variant="danger"
              isLoading={isCancelling}
              onClick={handleConfirmCancel}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
