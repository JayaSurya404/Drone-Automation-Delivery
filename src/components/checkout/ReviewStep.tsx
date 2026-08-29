import React from 'react';
import { CustomerAddress } from '../../types/address';
import { DeliverySpeedOption, PaymentMethod } from '../../types/order';
import { useCart } from '../../context/CartContext';
import { Button } from '../common/Button';
import { MapPin, Crosshair, MessageSquare, Zap, CreditCard, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ReviewStepProps {
  address: CustomerAddress;
  latitude: number;
  longitude: number;
  dropZoneType: string;
  instructions: string;
  deliverySpeed: DeliverySpeedOption;
  scheduledTime?: string;
  paymentMethod: PaymentMethod;
  onPlaceOrder: () => void;
  onBack: () => void;
  isPlacingOrder: boolean;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  address,
  latitude,
  longitude,
  dropZoneType,
  instructions,
  deliverySpeed,
  scheduledTime,
  paymentMethod,
  onPlaceOrder,
  onBack,
  isPlacingOrder,
}) => {
  const { items, subtotal, deliveryFee, tax, discount, total } = useCart();

  return (
    <div>
      <div className="card-header" style={{ border: 'none', paddingBottom: '0.5rem' }}>
        <div>
          <h3 className="card-title">6. Review Order & Confirm Flight Mission</h3>
          <p className="section-subtitle">
            Verify your delivery parameters before dispatching the autonomous aircraft.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
        {/* Delivery Destination Summary */}
        <div className="card glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--accent-cyan)' }}>
            <MapPin size={18} />
            <span>Delivery Destination</span>
          </div>

          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {address.name}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {address.building}, {address.street}
          </div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-tertiary)' }}>
            {address.city}, {address.state} {address.postalCode}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
            📞 {address.phone}
          </div>

          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.825rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 600 }}>
              <Crosshair size={14} />
              <span>Target Drop Zone: {dropZoneType}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
              GPS: {latitude.toFixed(4)}° N, {Math.abs(longitude).toFixed(4)}° W
            </div>
          </div>
        </div>

        {/* Flight & Instructions Summary */}
        <div className="card glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--accent-cyan)' }}>
            <Zap size={18} />
            <span>Flight & Payment</span>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Speed Priority</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', textTransform: 'capitalize' }}>
              {deliverySpeed} Drone Delivery
              {scheduledTime && ` (${scheduledTime})`}
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Payment Method</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{paymentMethod}</div>
          </div>

          {instructions && (
            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <MessageSquare size={13} />
                <span>Drop Notes:</span>
              </div>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                "{instructions}"
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Itemized Products List */}
      <div className="card glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>Items in Drone Compartment ({items.length})</h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((item) => (
            <div
              key={item.product.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.product.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    Qty: {item.quantity} × ${item.product.price.toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-display)' }}>
                ${(item.product.price * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="ghost" onClick={onBack} disabled={isPlacingOrder}>
          &larr; Back
        </Button>

        <Button
          variant="primary"
          size="lg"
          isLoading={isPlacingOrder}
          onClick={onPlaceOrder}
          leftIcon={<Zap size={18} />}
        >
          Authorize & Place Order (${total.toFixed(2)})
        </Button>
      </div>
    </div>
  );
};
