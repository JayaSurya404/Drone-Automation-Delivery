import React from 'react';
import { CustomerOrderStatus } from '../../types/order';
import { Drone3DVisual } from '../common/Drone3DVisual';
import { Package, CheckCircle2, ShieldCheck, Navigation, Clock, AlertTriangle } from 'lucide-react';

interface Delivery3DStatusProps {
  status: CustomerOrderStatus;
  size?: number;
}

export const Delivery3DStatus: React.FC<Delivery3DStatusProps> = ({
  status,
  size = 220,
}) => {
  if (status === 'Delivered') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 12px 30px rgba(16, 185, 129, 0.35)',
            marginBottom: '1.25rem',
            animation: 'modalPop 0.4s ease forwards',
          }}
        >
          <CheckCircle2 size={48} />
        </div>
        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Package Safely Delivered
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem', maxWidth: '280px' }}>
          Autonomous tether released smoothly onto your marked landing target.
        </p>
      </div>
    );
  }

  if (status === 'Cancelled' || status === 'Delivery Failed') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            margin: '0 auto 1rem',
          }}
        >
          <AlertTriangle size={40} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Flight Mission {status}</h3>
      </div>
    );
  }

  if (status === 'Order Placed' || status === 'Order Confirmed' || status === 'Preparing') {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            border: '2px solid rgba(14, 165, 233, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0284c7',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 20px rgba(2, 132, 199, 0.15)',
          }}
        >
          <Package size={40} />
        </div>
        <h4 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Loading Cargo Compartment</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
          Payload balancing and RFID seal verification at SkyHub Central.
        </p>
      </div>
    );
  }

  // Active in-flight states: Drone Assigned, Drone Launched, Out for Delivery, Near Destination, Arriving
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Drone3DVisual size={size} hasCargo={true} status="flying" />
    </div>
  );
};
