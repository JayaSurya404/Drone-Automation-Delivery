import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CustomerOrder } from '../../types/order';
import { Radio, Navigation, Clock, MapPin, ChevronRight, ShieldCheck } from 'lucide-react';
import { Button } from '../common/Button';

interface ActiveDeliveryCardProps {
  activeOrder: CustomerOrder | null;
}

export const ActiveDeliveryCard: React.FC<ActiveDeliveryCardProps> = ({ activeOrder }) => {
  const navigate = useNavigate();

  if (!activeOrder) {
    return (
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 21, 35, 0.7) 0%, rgba(22, 30, 49, 0.7) 100%)',
          border: '1px dashed var(--border-default)',
          textAlign: 'center',
          padding: '2.5rem 1.5rem',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            color: 'var(--accent-cyan)',
          }}
        >
          <Navigation size={24} />
        </div>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>You're not currently waiting for a delivery</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
          Explore our rapid drone marketplace. Order medicines, meals, groceries, or tech essentials delivered directly to your lawn or rooftop in minutes.
        </p>
        <Button variant="primary" onClick={() => navigate('/products')}>
          Place an Order
        </Button>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        background: 'linear-gradient(135deg, rgba(14, 25, 45, 0.9) 0%, rgba(19, 36, 68, 0.9) 100%)',
        border: '1px solid var(--accent-cyan)',
        boxShadow: '0 0 30px var(--accent-cyan-glow)',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '2rem',
      }}
    >
      {/* Background Decorative Flight Grid */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '300px',
          height: '100%',
          opacity: 0.1,
          backgroundImage: 'radial-gradient(circle, #00e5ff 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="pulse-dot cyan" />
            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-cyan)' }}>
              Active Drone Delivery In Progress
            </span>
          </div>

          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>
            Order #{activeOrder.id}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Flight Status
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00e676', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radio size={20} className="animate-spin" color="#00e676" />
              <span>{activeOrder.status}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Autonomous electric drone cruising along verified safe corridor.
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Estimated Arrival
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} color="var(--accent-cyan)" />
              <span className="text-gradient">{activeOrder.estimatedDeliveryTime}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              <MapPin size={14} color="var(--text-tertiary)" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeOrder.deliveryAddress.building}, {activeOrder.deliveryAddress.street}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <ShieldCheck size={16} color="#10b981" />
              <span>Handover OTP: <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{activeOrder.deliveryOtp}</strong></span>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate(`/tracking/${activeOrder.id}`)}
              rightIcon={<ChevronRight size={18} />}
            >
              Track Delivery Live
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
