import React, { useState } from 'react';
import { PaymentMethod } from '../../types/order';
import { useCart } from '../../context/CartContext';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { CreditCard, Wallet, Smartphone, Landmark, ShieldCheck, Lock } from 'lucide-react';

interface PaymentStepProps {
  onPaymentConfirmed: (method: PaymentMethod) => void;
  onBack: () => void;
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'Credit Card', label: 'Credit Card', icon: <CreditCard size={22} />, desc: 'Visa, Mastercard, Amex' },
  { id: 'UPI', label: 'Instant UPI', icon: <Smartphone size={22} />, desc: 'GPay, PhonePe, Paytm' },
  { id: 'Wallet', label: 'Digital Wallet', icon: <Wallet size={22} />, desc: 'Apple Pay, Google Wallet' },
  { id: 'Debit Card', label: 'Debit Card', icon: <CreditCard size={22} />, desc: 'Bank ATM / Debit Cards' },
  { id: 'Net Banking', label: 'Net Banking', icon: <Landmark size={22} />, desc: 'All Major Banks' },
];

export const PaymentStep: React.FC<PaymentStepProps> = ({
  onPaymentConfirmed,
  onBack,
}) => {
  const { total } = useCart();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Credit Card');
  const [cardData, setCardData] = useState({
    cardNumber: '•••• •••• •••• 4242',
    cardHolder: 'Alex Mercer',
    expiry: '12/28',
    cvv: '•••',
  });
  const [upiId, setUpiId] = useState<string>('alex.mercer@oksbi');

  const handleNext = () => {
    onPaymentConfirmed(selectedMethod);
  };

  return (
    <div>
      <div className="card-header" style={{ border: 'none', paddingBottom: '0.5rem' }}>
        <div>
          <h3 className="card-title">5. Secure Payment Interface</h3>
          <p className="section-subtitle">
            All transactions are processed through tokenized 256-bit encrypted gateways.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>
          <ShieldCheck size={16} />
          <span>PCI-DSS Level 1 Compliant</span>
        </div>
      </div>

      {/* Methods Grid */}
      <div className="payment-methods-grid" style={{ marginTop: '1rem' }}>
        {PAYMENT_METHODS.map((pm) => {
          const isSelected = selectedMethod === pm.id;

          return (
            <div
              key={pm.id}
              className={`payment-method-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedMethod(pm.id)}
            >
              <div style={{ color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                {pm.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                {pm.label}
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
                {pm.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Method Input Mock Frame */}
      {selectedMethod === 'Credit Card' || selectedMethod === 'Debit Card' ? (
        <div className="card glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Card Information</span>
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <span>🔒 256-Bit SSL</span>
            </div>
          </div>

          <Input
            label="Card Number"
            placeholder="4242 •••• •••• 4242"
            value={cardData.cardNumber}
            onChange={(e) => setCardData({ ...cardData, cardNumber: e.target.value })}
            leftIcon={<CreditCard size={18} />}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
            <Input
              label="Cardholder Name"
              value={cardData.cardHolder}
              onChange={(e) => setCardData({ ...cardData, cardHolder: e.target.value })}
            />
            <Input
              label="Expiry"
              placeholder="MM/YY"
              value={cardData.expiry}
              onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
            />
            <Input
              label="CVV"
              placeholder="123"
              type="password"
              maxLength={4}
              value={cardData.cvv}
              onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
            />
          </div>
        </div>
      ) : selectedMethod === 'UPI' ? (
        <div className="card glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>
            Instant UPI Payment
          </span>
          <Input
            label="Virtual Payment Address (VPA / UPI ID)"
            placeholder="e.g. yourname@okhdfcbank"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            leftIcon={<Smartphone size={18} />}
            hint="You will receive an instant approval ping on your UPI app."
          />
        </div>
      ) : (
        <div className="card glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>
          <Wallet size={32} color="var(--accent-cyan)" style={{ margin: '0 auto 0.5rem' }} />
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Seamless 1-Tap Authorization</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Clicking Continue will open your default digital wallet for biometric authentication.
          </p>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="ghost" onClick={onBack}>
          &larr; Back
        </Button>

        <Button variant="primary" size="lg" onClick={handleNext}>
          Review Order (${total.toFixed(2)}) &rarr;
        </Button>
      </div>
    </div>
  );
};
