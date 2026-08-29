import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerOrder } from '../../types/order';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { StarRating } from '../common/StarRating';
import { ChevronRight, Navigation, MapPin } from 'lucide-react';

interface OrderCardProps {
  order: CustomerOrder;
  onRate?: (order: CustomerOrder) => void;
  onReorder?: (order: CustomerOrder) => void;
}

function getStatusBadgeVariant(status: string): string {
  switch (status) {
    case 'Delivered': return 'success';
    case 'Out for Delivery':
    case 'Near Destination':
    case 'Arriving':
    case 'Drone Launched': return 'cyan';
    case 'Order Placed':
    case 'Order Confirmed':
    case 'Preparing':
    case 'Drone Assigned':
    case 'Drone Preparing': return 'indigo';
    case 'Cancelled':
    case 'Delivery Failed': return 'danger';
    case 'Delayed':
    case 'Returning': return 'warning';
    default: return 'cyan';
  }
}

function getProgressPercent(status: string): number {
  const steps = ['Order Placed','Order Confirmed','Preparing','Drone Assigned','Drone Launched','Out for Delivery','Near Destination','Arriving','Delivered'];
  const idx = steps.indexOf(status);
  if (idx < 0) return 0;
  return Math.round((idx / (steps.length - 1)) * 100);
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onRate }) => {
  const navigate = useNavigate();
  const isActive = order.status !== 'Delivered' && order.status !== 'Cancelled' && order.status !== 'Delivery Failed';
  const progress = getProgressPercent(order.status);
  const badgeVariant = getStatusBadgeVariant(order.status);

  return (
    <div
      className={`order-card${isActive ? ' active-order' : ''}`}
      style={{ cursor: 'pointer' }}
      onClick={() => navigate(`/orders/${order.id}`)}
    >
      {/* Progress bar — top accent for active orders */}
      {isActive && (
        <div className="order-card-progress">
          <div className="order-card-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div style={{ padding: '1.25rem' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Product images strip */}
            <div style={{ display: 'flex', gap: '-6px' }}>
              {order.items.slice(0, 3).map((item, idx) => (
                <img
                  key={idx}
                  src={item.product.image}
                  alt={item.product.name}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-md)',
                    objectFit: 'cover',
                    border: '2px solid #ffffff',
                    marginLeft: idx > 0 ? '-8px' : 0,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                />
              ))}
              {order.items.length > 3 && (
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  background: '#f1f5f9',
                  border: '2px solid #ffffff',
                  marginLeft: '-8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--text-tertiary)',
                }}>
                  +{order.items.length - 3}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '0.15rem' }}>
                {order.items[0].product.name}
                {order.items.length > 1 && (
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.8rem' }}>
                    {' '}+{order.items.length - 1} more
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                #{order.id} · {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            <Badge variant={badgeVariant as any}>
              {isActive && <span className="pulse-dot cyan" style={{ marginRight: '4px', display: 'inline-block' }} />}
              {order.status}
            </Badge>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              ${order.total.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Delivery address + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)', minWidth: 0 }}>
            <MapPin size={13} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {order.deliveryAddress.building}, {order.deliveryAddress.street}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {order.status === 'Delivered' && !order.rating && onRate && (
              <Button variant="outline" size="sm" onClick={() => onRate(order)}>
                Rate ⭐
              </Button>
            )}
            {order.status === 'Delivered' && order.rating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#d97706' }}>
                <StarRating rating={order.rating.stars} size={14} />
              </div>
            )}
            {isActive && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/tracking/${order.id}`)}
                leftIcon={<Navigation size={13} />}
              >
                Track Live
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/orders/${order.id}`)}
              rightIcon={<ChevronRight size={13} />}
            >
              Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
