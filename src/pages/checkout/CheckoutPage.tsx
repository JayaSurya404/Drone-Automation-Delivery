import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAddresses } from '../../context/AddressContext';
import { useOrders } from '../../context/OrderContext';
import { useNotifications } from '../../context/NotificationContext';
import { CustomerAddress } from '../../types/address';
import { DeliverySpeedOption, PaymentMethod, CustomerOrder } from '../../types/order';
import { CheckoutStepper } from '../../components/checkout/CheckoutStepper';
import { AddressStep } from '../../components/checkout/AddressStep';
import { LocationStep } from '../../components/checkout/LocationStep';
import { InstructionsStep } from '../../components/checkout/InstructionsStep';
import { DeliveryOptionStep } from '../../components/checkout/DeliveryOptionStep';
import { PaymentStep } from '../../components/checkout/PaymentStep';
import { ReviewStep } from '../../components/checkout/ReviewStep';
import { Button } from '../../components/common/Button';
import { CheckCircle2, Navigation, Package, ArrowRight, ShoppingBag, Sparkles, KeyRound } from 'lucide-react';
import confetti from 'canvas-confetti';

export const CheckoutPage: React.FC = () => {
  const { items, subtotal, deliveryFee, tax, discount, total, clearCart } = useCart();
  const { selectedAddress, setSelectedAddress } = useAddresses();
  const { createOrder } = useOrders();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [address, setAddress] = useState<CustomerAddress | null>(selectedAddress);
  const [lat, setLat] = useState<number>(selectedAddress?.latitude || 37.7749);
  const [lng, setLng] = useState<number>(selectedAddress?.longitude || -122.4194);
  const [dropZoneType, setDropZoneType] = useState<string>(selectedAddress?.dropZoneType || 'Lawn');
  const [instructions, setInstructions] = useState<string>(selectedAddress?.instructions || '');
  const [speedOption, setSpeedOption] = useState<DeliverySpeedOption>('express');
  const [scheduledTime, setScheduledTime] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Credit Card');

  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<CustomerOrder | null>(null);

  // If cart is empty and no confirmed order yet, redirect to products
  if (items.length === 0 && !confirmedOrder) {
    navigate('/products');
    return null;
  }

  const handlePlaceOrder = async () => {
    if (!address) return;
    setIsPlacingOrder(true);

    try {
      const order = await createOrder({
        customerId: address.customerId,
        items,
        subtotal,
        deliveryFee,
        tax,
        discount,
        total,
        paymentMethod,
        paymentStatus: 'Paid',
        deliverySpeed: speedOption,
        scheduledTime,
        deliveryAddress: {
          ...address,
          latitude: lat,
          longitude: lng,
          dropZoneType: dropZoneType as any,
          instructions,
        },
        deliveryInstructions: instructions,
        dropZoneType,
        estimatedDeliveryTime: speedOption === 'express' ? '8 - 12 mins' : '15 - 20 mins',
      });

      // Clear cart
      clearCart();
      setConfirmedOrder(order);

      // Trigger celebration confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00e5ff', '#6366f1', '#10b981', '#ffffff'],
      });

      showToast('Order Placed Successfully! 🚀', `Drone mission #${order.id} scheduled.`, 'success');
    } catch (err: any) {
      alert(err.message || 'Failed to place order.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Section 24: Order Confirmation Screen
  if (confirmedOrder) {
    return (
      <div className="main-content" style={{ maxWidth: '720px', padding: '2rem 1rem' }}>
        <div
          className="card glass-panel"
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--accent-cyan)',
            boxShadow: '0 0 40px var(--accent-cyan-glow)',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-indigo) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: '#050a14',
              boxShadow: '0 0 30px var(--accent-cyan-glow)',
            }}
          >
            <CheckCircle2 size={40} />
          </div>

          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            Order Placed Successfully! 🎉
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '480px', margin: '0 auto 2rem' }}>
            Your autonomous flight mission has been initialized at SkyHub Central. An electric delivery drone is being prepared for air transit.
          </p>

          {/* Confirmation Details Card */}
          <div
            style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              textAlign: 'left',
              marginBottom: '2rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.25rem',
              fontSize: '0.875rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Order Reference</span>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--accent-cyan)' }}>
                #{confirmedOrder.id}
              </strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Est. Drone Flight Time</span>
              <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>
                ~{confirmedOrder.estimatedDeliveryTime}
              </strong>
            </div>

            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Handover OTP</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <KeyRound size={16} color="var(--accent-cyan)" />
                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', color: 'var(--accent-cyan)' }}>
                  {confirmedOrder.deliveryOtp}
                </strong>
              </div>
            </div>

            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Total Paid</span>
              <strong style={{ fontSize: '1.1rem' }}>
                ${confirmedOrder.total.toFixed(2)} ({confirmedOrder.paymentMethod})
              </strong>
            </div>
          </div>

          {/* Destination Preview */}
          <div
            style={{
              background: 'rgba(0, 229, 255, 0.05)',
              border: '1px solid rgba(0, 229, 255, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              textAlign: 'left',
              marginBottom: '2rem',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '0.2rem' }}>
              📍 Delivery Landing Zone ({confirmedOrder.dropZoneType || 'Lawn'}):
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              {confirmedOrder.deliveryAddress.building}, {confirmedOrder.deliveryAddress.street}, {confirmedOrder.deliveryAddress.city}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate(`/tracking/${confirmedOrder.id}`)}
              leftIcon={<Navigation size={18} />}
            >
              Track Order Live
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate(`/orders/${confirmedOrder.id}`)}
              leftIcon={<Package size={18} />}
            >
              View Order Details
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate('/products')}
              leftIcon={<ShoppingBag size={18} />}
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ maxWidth: '960px' }}>
      {/* Checkout Stepper Progress */}
      <CheckoutStepper
        currentStep={currentStep}
        onStepClick={(step) => setCurrentStep(step)}
      />

      {/* Stepper Content */}
      <div className="card glass-panel" style={{ padding: '2rem' }}>
        {currentStep === 1 && (
          <AddressStep
            selectedAddress={address}
            onSelectAddress={(addr) => {
              setAddress(addr);
              setSelectedAddress(addr);
              setLat(addr.latitude);
              setLng(addr.longitude);
              if (addr.dropZoneType) setDropZoneType(addr.dropZoneType);
            }}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && address && (
          <LocationStep
            address={address}
            onLocationConfirmed={(newLat, newLng, zone) => {
              setLat(newLat);
              setLng(newLng);
              setDropZoneType(zone);
              setCurrentStep(3);
            }}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <InstructionsStep
            initialInstructions={instructions}
            onInstructionsConfirmed={(inst) => {
              setInstructions(inst);
              setCurrentStep(4);
            }}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <DeliveryOptionStep
            onSpeedConfirmed={(speed, time) => {
              setSpeedOption(speed);
              setScheduledTime(time);
              setCurrentStep(5);
            }}
            onBack={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 5 && (
          <PaymentStep
            onPaymentConfirmed={(method) => {
              setPaymentMethod(method);
              setCurrentStep(6);
            }}
            onBack={() => setCurrentStep(4)}
          />
        )}

        {currentStep === 6 && address && (
          <ReviewStep
            address={address}
            latitude={lat}
            longitude={lng}
            dropZoneType={dropZoneType}
            instructions={instructions}
            deliverySpeed={speedOption}
            scheduledTime={scheduledTime}
            paymentMethod={paymentMethod}
            onPlaceOrder={handlePlaceOrder}
            onBack={() => setCurrentStep(5)}
            isPlacingOrder={isPlacingOrder}
          />
        )}
      </div>
    </div>
  );
};
