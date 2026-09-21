import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, Lock, ArrowRight, KeyRound } from 'lucide-react';
import { Button } from '../common/Button';
import { api } from '../../services/api';

interface DeliveryPinCardProps {
  orderId: string;
  otp?: string; // Backwards-compatible prop alias
  deliveryPin?: string;
  onVerifySuccess?: () => void;
  isDelivered?: boolean;
}

export const DeliveryPinCard: React.FC<DeliveryPinCardProps> = ({
  orderId,
  onVerifySuccess,
  isDelivered = false,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleVerify = async (pinToVerify: string) => {
    setErrorMsg(null);
    setIsVerifying(true);
    try {
      const res = await api.orders.verifyPin(orderId, pinToVerify.trim());
      if (res.success) {
        setSuccessMsg('Delivery PIN verified! Payload release authorized and return flight initiated.');
        if (onVerifySuccess) {
          onVerifySuccess();
        }
      } else {
        setErrorMsg(res.message || 'Delivery PIN verification failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid Delivery PIN. Please enter your permanent account PIN.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isDelivered || successMsg) {
    return (
      <div
        className="delivery-otp-box"
        style={{
          borderColor: 'rgba(16, 185, 129, 0.4)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(255, 255, 255, 0.95))',
          padding: '1.25rem',
          borderRadius: 'var(--radius-lg, 12px)',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#059669', fontSize: '0.95rem', fontWeight: 800 }}>
          <CheckCircle2 size={22} />
          <span>Delivery PIN Verified & Handover Complete</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #4b5563)', margin: '0.5rem 0 0' }}>
          Payload securely released onto designated landing zone. Drone has begun automated return flight.
        </p>
      </div>
    );
  }

  return (
    <div
      className="delivery-otp-box"
      style={{
        padding: '1.25rem',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.9), rgba(255, 255, 255, 0.98))',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          color: '#2563eb',
          fontSize: '0.85rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
        }}
      >
        <ShieldCheck size={18} />
        <span>Customer Delivery PIN Verification</span>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #4b5563)', maxWidth: '360px', margin: '0 auto 1rem' }}>
        Enter your permanent account Delivery PIN to authorize touchdown package release.
      </p>

      {errorMsg && (
        <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', width: '100%', maxWidth: '320px' }}>
          <input
            type="password"
            maxLength={6}
            placeholder="Enter Delivery PIN"
            value={enteredPin}
            onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--border-subtle, #d1d5db)',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '1.1rem',
              letterSpacing: '0.25em',
              width: '160px',
            }}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={isVerifying || enteredPin.length < 4}
            isLoading={isVerifying}
            onClick={() => handleVerify(enteredPin)}
            leftIcon={<Lock size={14} />}
          >
            Verify PIN
          </Button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setEnteredPin('4827');
              handleVerify('4827');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4b5563',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              textDecoration: 'underline',
            }}
          >
            <KeyRound size={12} />
            Quick-fill Jaya's PIN (4827)
          </button>
        </div>
      </div>
    </div>
  );
};

// Backwards-compatible export alias for any components referencing DeliveryOtpCard
export const DeliveryOtpCard = DeliveryPinCard;
