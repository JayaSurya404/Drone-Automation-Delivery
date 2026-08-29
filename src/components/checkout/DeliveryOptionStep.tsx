import React, { useState } from 'react';
import { DeliverySpeedOption } from '../../types/order';
import { useCart } from '../../context/CartContext';
import { Button } from '../common/Button';
import { Zap, Clock, Calendar, CheckCircle2 } from 'lucide-react';

interface DeliveryOptionStepProps {
  onSpeedConfirmed: (speed: DeliverySpeedOption, scheduledTime?: string) => void;
  onBack: () => void;
}

export const DeliveryOptionStep: React.FC<DeliveryOptionStepProps> = ({
  onSpeedConfirmed,
  onBack,
}) => {
  const { deliverySpeed, setDeliverySpeed } = useCart();
  const [selectedSpeed, setSelectedSpeed] = useState<DeliverySpeedOption>(deliverySpeed);
  const [scheduledSlot, setScheduledSlot] = useState<string>('Today, 2:00 PM - 2:30 PM');

  const handleNext = () => {
    setDeliverySpeed(selectedSpeed);
    onSpeedConfirmed(selectedSpeed, selectedSpeed === 'scheduled' ? scheduledSlot : undefined);
  };

  return (
    <div>
      <div className="card-header" style={{ border: 'none', paddingBottom: '0.5rem' }}>
        <div>
          <h3 className="card-title">4. Select Delivery Option</h3>
          <p className="section-subtitle">
            Choose your preferred drone flight priority and transit window.
          </p>
        </div>
      </div>

      <div className="delivery-options-grid" style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        {/* Express Priority */}
        <div
          className={`delivery-option-card ${selectedSpeed === 'express' ? 'selected' : ''}`}
          onClick={() => setSelectedSpeed('express')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 229, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)',
              }}
            >
              <Zap size={24} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Express Priority Drone
                </span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(0, 229, 255, 0.15)', color: 'var(--accent-cyan)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                  Fastest
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Immediate launchpad queue bypass. Arrives in <strong>~8 - 12 minutes</strong>.
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>+$3.50</div>
            {selectedSpeed === 'express' && <CheckCircle2 size={18} color="var(--accent-cyan)" style={{ marginTop: '0.25rem' }} />}
          </div>
        </div>

        {/* Standard Drone */}
        <div
          className={`delivery-option-card ${selectedSpeed === 'standard' ? 'selected' : ''}`}
          onClick={() => setSelectedSpeed('standard')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <Clock size={24} />
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Standard Drone Air Transport
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Eco-optimized cruising flight. Arrives in <strong>~15 - 20 minutes</strong>.
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Free / $3.99</div>
            {selectedSpeed === 'standard' && <CheckCircle2 size={18} color="var(--accent-cyan)" style={{ marginTop: '0.25rem' }} />}
          </div>
        </div>

        {/* Scheduled Drone */}
        <div
          className={`delivery-option-card ${selectedSpeed === 'scheduled' ? 'selected' : ''}`}
          onClick={() => setSelectedSpeed('scheduled')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-indigo)',
              }}
            >
              <Calendar size={24} />
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Scheduled Flight Window
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Pick an exact time slot for drone departure and arrival.
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>$4.99</div>
            {selectedSpeed === 'scheduled' && <CheckCircle2 size={18} color="var(--accent-cyan)" style={{ marginTop: '0.25rem' }} />}
          </div>
        </div>
      </div>

      {/* Scheduled Selector */}
      {selectedSpeed === 'scheduled' && (
        <div className="card glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
          <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
            Select Preferred Drone Flight Window:
          </label>
          <select
            className="form-control"
            value={scheduledSlot}
            onChange={(e) => setScheduledSlot(e.target.value)}
          >
            <option value="Today, 2:00 PM - 2:30 PM">Today, 2:00 PM - 2:30 PM</option>
            <option value="Today, 3:30 PM - 4:00 PM">Today, 3:30 PM - 4:00 PM</option>
            <option value="Today, 5:00 PM - 5:30 PM">Today, 5:00 PM - 5:30 PM</option>
            <option value="Tomorrow, 10:00 AM - 10:30 AM">Tomorrow, 10:00 AM - 10:30 AM</option>
            <option value="Tomorrow, 1:00 PM - 1:30 PM">Tomorrow, 1:00 PM - 1:30 PM</option>
          </select>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="ghost" onClick={onBack}>
          &larr; Back
        </Button>

        <Button variant="primary" size="lg" onClick={handleNext}>
          Continue to Payment &rarr;
        </Button>
      </div>
    </div>
  );
};
