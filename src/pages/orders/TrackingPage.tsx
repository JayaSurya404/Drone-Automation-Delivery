import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { useNotifications } from '../../context/NotificationContext';
import { CustomerOrder } from '../../types/order';
import { LiveTrackingState } from '../../types/tracking';
import { realtimeDeliveryService } from '../../services/realtimeDeliveryService';
import { api } from '../../services/api';
import { DroneLiveMap } from '../../components/map/DroneLiveMap';
import { DeliveryOtpCard } from '../../components/orders/DeliveryOtpCard';
import { OrderTimeline } from '../../components/orders/OrderTimeline';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { StarRating } from '../../components/common/StarRating';
import { Skeleton } from '../../components/common/Skeleton';
import {
  ArrowLeft,
  Clock,
  Navigation,
  MapPin,
  Wifi,
  WifiOff,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Sparkles,
  Lock,
  Package,
} from 'lucide-react';
import confetti from 'canvas-confetti';

function getStatusMessage(status: string): { headline: string; sub: string; icon: string } {
  switch (status) {
    case 'Order Placed':
      return { headline: 'Order received', sub: 'Your order is being confirmed.', icon: '📋' };
    case 'Order Confirmed':
      return { headline: 'Order confirmed', sub: 'Preparing your items at the hub.', icon: '✅' };
    case 'Preparing':
      return { headline: 'Getting ready', sub: 'Your items are being loaded and sealed.', icon: '📦' };
    case 'Drone Assigned':
      return { headline: 'Drone assigned', sub: 'Your delivery drone is ready on the launchpad.', icon: '🚁' };
    case 'Drone Launched':
      return { headline: 'Drone launched!', sub: 'Your order has departed the hub.', icon: '🚀' };
    case 'Out for Delivery':
      return { headline: 'In-flight to you', sub: 'Your delivery is flying to you right now.', icon: '⚡' };
    case 'Near Destination':
      return { headline: 'Almost there!', sub: 'Your drone is approaching your area.', icon: '📡' };
    case 'Arriving':
      return { headline: 'Arriving now', sub: 'Your drone is descending to your location.', icon: '🎯' };
    case 'Delivered':
      return { headline: 'Delivered! 🎉', sub: 'Your package has landed safely.', icon: '✅' };
    default:
      return { headline: status, sub: 'Tracking your delivery.', icon: '🚁' };
  }
}

export const TrackingPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getOrderById, rateOrder } = useOrders();
  const { showToast } = useNotifications();

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [trackingState, setTrackingState] = useState<LiveTrackingState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);
  const [lastUpdatedSeconds, setLastUpdatedSeconds] = useState<number>(0);

  const [isRatingOpen, setIsRatingOpen] = useState<boolean>(false);
  const [stars, setStars] = useState<number>(5);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
  const [hasCelebrated, setHasCelebrated] = useState<boolean>(false);

  const isSimulatingRef = useRef<boolean>(false);

  // Load order and start simulation
  useEffect(() => {
    if (!orderId) return;
    let isMounted = true;
    setIsLoading(true);
    setIsUnauthorized(false);
    setError(null);

    getOrderById(orderId)
      .then(ord => {
        if (!isMounted) return;
        if (user && ord.customerId && ord.customerId !== user.id) {
          setIsUnauthorized(true);
          setIsLoading(false);
          return;
        }
        setOrder(ord);
        api.tracking.getSnapshot(ord.id)
          .then((snapshot: LiveTrackingState) => setTrackingState(snapshot))
          .catch(() => {
            const fallback = realtimeDeliveryService.getLiveTrackingSnapshot(ord);
            setTrackingState(fallback);
          })
          .finally(() => setIsLoading(false));

        if (ord.status !== 'Delivered' && ord.status !== 'Cancelled' && !isSimulatingRef.current) {
          isSimulatingRef.current = true;
          realtimeDeliveryService.connectToOrderStream(ord.id, ord.deliveryAddress?.latitude, ord.deliveryAddress?.longitude);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message || 'Order not found.');
          setIsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [orderId]);

  // Freshness counter
  useEffect(() => {
    const timer = setInterval(() => setLastUpdatedSeconds(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!orderId) return;
    const unsubscribe = realtimeDeliveryService.subscribe(event => {
      if (event.orderId === orderId) {
        setLastUpdatedSeconds(0);
        setOrder(prev => {
          if (!prev) return null;
          return { ...prev, status: (event.status as any) || prev.status };
        });

        if (event.location) {
          setTrackingState(prev => {
            if (!prev) return null;
            return {
              ...prev,
              orderStatus: event.status || prev.orderStatus,
              currentDroneLocation: {
                latitude: event.location!.latitude,
                longitude: event.location!.longitude,
                altitudeMeters: event.location!.altitudeMeters,
                speedKmh: event.location!.speedKmh,
                bearing: event.location!.bearing,
              },
              remainingDistanceKm: event.remainingDistanceKm ?? prev.remainingDistanceKm,
              estimatedArrivalMins: event.estimatedArrivalMins ?? prev.estimatedArrivalMins,
              estimatedArrivalFormatted: `${event.estimatedArrivalMins ?? prev.estimatedArrivalMins} mins`,
              lastUpdated: new Date().toISOString(),
              isCompleted: event.status === 'Delivered',
            };
          });
        }

        if ((event.type === 'DELIVERY_COMPLETED' || event.status === 'Delivered') && !hasCelebrated) {
          setHasCelebrated(true);
          confetti({ particleCount: 80, spread: 65, origin: { y: 0.6 }, colors: ['#0284c7', '#10b981', '#6366f1', '#f59e0b'] });
          setTimeout(() => setIsRatingOpen(true), 1500);
        }
      }
    });
    return () => unsubscribe();
  }, [orderId, hasCelebrated]);

  const handleSaveRating = async () => {
    if (!order) return;
    setIsSubmittingRating(true);
    try {
      await rateOrder(order.id, stars, feedback);
      showToast('Thank You!', 'Your delivery rating was submitted.', 'success');
      setIsRatingOpen(false);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="main-content">
        <Skeleton width={180} height={22} className="mb-4" />
        <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <Skeleton height={480} borderRadius="var(--radius-xl)" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }}>
          <Skeleton height={160} borderRadius="var(--radius-xl)" />
          <Skeleton height={160} borderRadius="var(--radius-xl)" />
        </div>
      </div>
    );
  }

  // ── Unauthorized ──
  if (isUnauthorized) {
    return (
      <div className="main-content" style={{ textAlign: 'center', padding: '5rem 1.5rem' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#ef4444' }}>
          <Lock size={34} />
        </div>
        <h2 style={{ marginBottom: '0.5rem' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', maxWidth: '360px', margin: '0 auto 1.75rem' }}>
          You don't have permission to view this delivery.
        </p>
        <Button variant="primary" onClick={() => navigate('/orders')}>Return to My Orders</Button>
      </div>
    );
  }

  // ── Error ──
  if (error || !order || !trackingState) {
    return (
      <div className="main-content" style={{ textAlign: 'center', padding: '5rem 1.5rem' }}>
        <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 1.25rem', display: 'block' }} />
        <h2 style={{ marginBottom: '0.5rem' }}>Couldn't Load Delivery</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', maxWidth: '360px', margin: '0 auto 1.75rem' }}>
          {error || 'Unable to load delivery information. Your order is safe.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => window.location.reload()}>Try Again</Button>
          <Button variant="secondary" onClick={() => navigate('/orders')}>View Orders</Button>
        </div>
      </div>
    );
  }

  const isPreFlight = ['Order Placed', 'Order Confirmed', 'Preparing'].includes(order.status);
  const isDelivered = order.status === 'Delivered';
  const statusInfo = getStatusMessage(order.status);

  return (
    <div className="main-content tracking-page">

      {/* ── Top nav bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Link
          to={`/orders/${order.id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}
        >
          <ArrowLeft size={16} />
          Order #{order.id}
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Connection indicator */}
          <div className={`tracking-connection-pill ${trackingState.connectionStatus === 'reconnecting' ? 'reconnecting' : 'connected'}`}>
            {trackingState.connectionStatus === 'reconnecting'
              ? <><WifiOff size={12} /> Reconnecting…</>
              : <><Wifi size={12} /> Live · {lastUpdatedSeconds === 0 ? 'Just now' : `${lastUpdatedSeconds}s ago`}</>
            }
          </div>

          <Link to="/support" state={{ prefillOrderId: order.id }}>
            <Button variant="secondary" size="sm" leftIcon={<HelpCircle size={14} />}>
              Support
            </Button>
          </Link>
        </div>
      </div>

      {/* ═══════════════════════════════════
          PRE-FLIGHT STATE
      ═══════════════════════════════════ */}
      {isPreFlight ? (
        <div style={{ textAlign: 'center', padding: 'clamp(2.5rem, 5vw, 4rem) 2rem', background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 60%, #eef2ff 100%)', borderRadius: 'var(--radius-2xl)', border: '1px solid rgba(14,165,233,0.15)', marginBottom: '1.5rem', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚁</div>
          <h2 style={{ fontSize: 'clamp(1.35rem, 2.5vw, 1.75rem)', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>
            {statusInfo.headline}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '400px', margin: '0 auto 1.75rem', lineHeight: 1.6 }}>
            Live GPS tracking will activate the moment your drone departs the launchpad.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem', background: '#f0f9ff', borderRadius: 'var(--radius-full)', border: '1px solid rgba(14,165,233,0.2)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
            <Clock size={15} />
            {statusInfo.sub}
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════
           CINEMATIC MAP HERO
        ═══════════════════════════════════ */
        <div className="tracking-map-hero">
          <div className="tracking-map-container">
            <DroneLiveMap
              droneLocation={trackingState.currentDroneLocation}
              hubLocation={trackingState.hubLocation}
              destinationLocation={trackingState.destinationLocation}
              flightRoute={trackingState.flightRoute}
              height="100%"
            />
          </div>

          {/* Floating: drone name badge */}
          <div className="tracking-hud-topleft">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.9)',
              borderRadius: 'var(--radius-full)',
              padding: '0.45rem 0.9rem',
              boxShadow: 'var(--shadow-md)',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}>
              <Navigation size={14} color="var(--accent-blue)" />
              {trackingState.droneAssignedName}
            </div>
          </div>

          {/* Floating: ETA panel at bottom */}
          <div className="tracking-hud-bottom">
            <div className="tracking-eta-panel">
              {/* Distance remaining */}
              <div className="tracking-stat-item">
                <div className="tracking-stat-value" style={{ color: 'var(--accent-blue)' }}>
                  {isDelivered ? '0.0' : trackingState.remainingDistanceKm} km
                </div>
                <div className="tracking-stat-label">Remaining</div>
              </div>

              <div className="tracking-eta-divider" />

              {/* ETA — center */}
              <div className="tracking-eta-primary">
                <div className="tracking-eta-number">
                  {isDelivered ? '✓' : trackingState.estimatedArrivalMins}
                </div>
                <div className="tracking-eta-label">
                  {isDelivered ? 'Delivered' : 'Min ETA'}
                </div>
              </div>

              <div className="tracking-eta-divider" />

              {/* Speed */}
              <div className="tracking-stat-item" style={{ textAlign: 'right' }}>
                <div className="tracking-stat-value" style={{ color: '#10b981' }}>
                  {isDelivered ? '0' : trackingState.currentDroneLocation.speedKmh} km/h
                </div>
                <div className="tracking-stat-label">Speed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          DELIVERED SUCCESS BANNER
      ═══════════════════════════════════ */}
      {isDelivered && (
        <div className="delivery-complete-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#059669' }}>
            <CheckCircle2 size={38} />
          </div>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900, marginBottom: '0.35rem', color: '#065f46', letterSpacing: '-0.03em' }}>
            Delivered! 🎉
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto 1.75rem', fontSize: '0.95rem' }}>
            Package safely released at your drop zone. Thank you for flying with SkyNav!
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" onClick={() => setIsRatingOpen(true)} leftIcon={<Sparkles size={17} />}>
              Rate Delivery
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/products')}>
              Order Again
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          STATUS MESSAGE (for active orders)
      ═══════════════════════════════════ */}
      {!isPreFlight && !isDelivered && (
        <div className="tracking-status-message">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.75rem' }}>{statusInfo.icon}</span>
            <div>
              <div className="tracking-status-text">{statusInfo.headline}</div>
              <div className="tracking-status-sub">{statusInfo.sub}</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          HUD METRICS + SIDEBAR
      ═══════════════════════════════════ */}
      {!isPreFlight && (
        <div className="tracking-info-grid">
          {/* Left: HUD metrics */}
          <div>
            <div className="hud-metrics-grid">
              <div className="hud-metric-card">
                <div className="hud-metric-label">ETA</div>
                <div className="hud-metric-value text-gradient">
                  {isDelivered ? '0 min' : trackingState.estimatedArrivalFormatted}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                  {isDelivered ? 'Landed' : 'Live Real-Time'}
                </div>
              </div>

              <div className="hud-metric-card">
                <div className="hud-metric-label">Distance</div>
                <div className="hud-metric-value" style={{ color: '#0284c7' }}>
                  {isDelivered ? '0.0 km' : `${trackingState.remainingDistanceKm} km`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                  Air Corridor
                </div>
              </div>

              <div className="hud-metric-card">
                <div className="hud-metric-label">Altitude</div>
                <div className="hud-metric-value" style={{ color: '#10b981' }}>
                  {isDelivered ? '0m' : `${trackingState.currentDroneLocation.altitudeMeters}m`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                  Cruising
                </div>
              </div>
            </div>

            {/* Destination */}
            <div className="card glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent-blue)', marginBottom: '0.75rem' }}>
                <MapPin size={16} />
                Drop-off Location
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {order.deliveryAddress.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                {order.deliveryAddress.building}, {order.deliveryAddress.street}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>
                {order.deliveryAddress.city}, {order.deliveryAddress.postalCode}
              </div>
              {order.deliveryInstructions && (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#f8faff', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', border: '1px solid var(--border-subtle)' }}>
                  "{order.deliveryInstructions}"
                </div>
              )}
            </div>

            {/* Order summary */}
            <div className="card glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                <Package size={16} color="var(--accent-blue)" />
                Your Order
              </div>
              {order.items.map(item => (
                <div key={item.product.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <img src={item.product.image} alt={item.product.name} style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border-subtle)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.product.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Qty: {item.quantity}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: OTP + Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <DeliveryOtpCard otp={trackingState.handoverOtp} orderId={order.id} />

            <div className="card glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>Flight Milestones</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                Real-time progression from hub to drop-off.
              </p>
              <OrderTimeline timeline={order.timeline} currentStatus={order.status} />
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      <Modal isOpen={isRatingOpen} onClose={() => setIsRatingOpen(false)} title="How was your delivery?">
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Rate the flight speed, precision, and landing for Order <strong>#{order.id}</strong>.
          </p>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <StarRating rating={stars} interactive onRatingChange={s => setStars(s)} size={32} />
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
              {stars === 5 ? 'Perfect Landing! 🚀' : stars === 4 ? 'Great Flight ⚡' : stars >= 3 ? 'Good Delivery' : 'Needs Improvement'}
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Optional Feedback</label>
            <textarea rows={3} className="form-control" placeholder="e.g. Smooth landing, right on time!" value={feedback} onChange={e => setFeedback(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setIsRatingOpen(false)}>Skip</Button>
            <Button variant="primary" isLoading={isSubmittingRating} onClick={handleSaveRating}>Submit Rating</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
