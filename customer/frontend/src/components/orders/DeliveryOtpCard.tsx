import React, { useState } from 'react';
import { KeyRound, Copy, Check, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../common/Button';
import { api } from '../../services/api';

interface DeliveryOtpCardProps {
  otp: string;
  orderId: string;
  onVerifySuccess?: () => void;
  isDelivered?: boolean;
}

export const DeliveryOtpCard: React.FC<DeliveryOtpCardProps> = ({ otp, orderId, onVerifySuccess, isDelivered = false }) => {
  const [copied, setCopied] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(otp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (otpToVerify: string) => {
    setErrorMsg(null);
    setIsVerifying(true);
    try {
      const res = await api.orders.verifyOtp(orderId, otpToVerify.trim());
      if (res.success) {
        setSuccessMsg('OTP verified successfully! Delivery release confirmed.');
        if (onVerifySuccess) {
          onVerifySuccess();
        }
      } else {
        setErrorMsg(res.message || 'OTP verification failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please ensure code matches.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isDelivered || successMsg) {
    return (
      <div className="delivery-otp-box" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(255, 255, 255, 0.95))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#059669', fontSize: '0.9rem', fontWeight: 800 }}>
          <CheckCircle2 size={20} />
          <span>Handover Verification Completed</span>
        </div>
        <div className="delivery-otp-code" style={{ color: '#059669', letterSpacing: '0.15em' }}>{otp}</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
          Payload securely released and confirmed onto designated landing zone.
        </p>
      </div>
    );
  }

  return (
    <div className="delivery-otp-box">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <KeyRound size={18} />
        <span>Secure Handover Verification Code</span>
      </div>

      <div className="delivery-otp-code">{otp}</div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0 auto 1rem' }}>
        When the drone arrives over your landing pad, verify with this 4-digit code to release the package pod.
      </p>

      {errorMsg && (
        <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', width: '100%', maxWidth: '280px' }}>
          <input
            type="text"
            maxLength={4}
            placeholder="Enter 4-digit OTP"
            value={enteredOtp}
            onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '0.2em',
              width: '140px',
            }}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={isVerifying || enteredOtp.length !== 4}
            isLoading={isVerifying}
            onClick={() => handleVerify(enteredOtp)}
          >
            Verify
          </Button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            leftIcon={copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEnteredOtp(otp);
              handleVerify(otp);
            }}
            leftIcon={<ShieldCheck size={14} />}
          >
            Quick Verify
          </Button>
        </div>
      </div>
    </div>
  );
};
