import React, { useState } from 'react';
import { KeyRound, Copy, Check, ShieldCheck } from 'lucide-react';
import { Button } from '../common/Button';

interface DeliveryOtpCardProps {
  otp: string;
  orderId: string;
}

export const DeliveryOtpCard: React.FC<DeliveryOtpCardProps> = ({ otp, orderId }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(otp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="delivery-otp-box">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <KeyRound size={18} />
        <span>Secure Handover Verification Code</span>
      </div>

      <div className="delivery-otp-code">{otp}</div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0 auto 1rem' }}>
        Once your autonomous delivery drone hovers over your landing pad, this 4-digit token will authenticate package release.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          leftIcon={copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
        >
          {copied ? 'Copied Code' : 'Copy OTP'}
        </Button>
      </div>
    </div>
  );
};
