import React from 'react';
import { MapPin, Crosshair, MessageSquare, Zap, CreditCard, CheckSquare, Check } from 'lucide-react';

interface CheckoutStepperProps {
  currentStep: number;
  totalSteps?: number;
  onStepClick?: (step: number) => void;
}

const STEPS = [
  { step: 1, label: 'Address', icon: <MapPin size={16} /> },
  { step: 2, label: 'GPS Pin', icon: <Crosshair size={16} /> },
  { step: 3, label: 'Drop Notes', icon: <MessageSquare size={16} /> },
  { step: 4, label: 'Speed', icon: <Zap size={16} /> },
  { step: 5, label: 'Payment', icon: <CreditCard size={16} /> },
  { step: 6, label: 'Review', icon: <CheckSquare size={16} /> },
];

export const CheckoutStepper: React.FC<CheckoutStepperProps> = ({
  currentStep,
  onStepClick,
}) => {
  const progressPercent = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="stepper-track" role="navigation" aria-label="Checkout Progress">
      <div className="stepper-line">
        <div
          className="stepper-line-progress"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {STEPS.map((s) => {
        const isCompleted = currentStep > s.step;
        const isActive = currentStep === s.step;

        return (
          <div
            key={s.step}
            className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            onClick={() => {
              if (isCompleted && onStepClick) {
                onStepClick(s.step);
              }
            }}
          >
            <div className="step-circle">
              {isCompleted ? <Check size={18} /> : s.icon}
            </div>
            <div className="step-label">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
};
