import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from './Button';
import { ShoppingBag, Heart, Zap, ShieldCheck, Lock, X, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { PendingAction } from '../../types/auth';

interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  action?: PendingAction;
  title?: string;
  message?: string;
}

export const AuthRequiredModal: React.FC<AuthRequiredModalProps> = ({
  isOpen,
  onClose,
  action,
  title,
  message,
}) => {
  const navigate = useNavigate();
  const { setPendingAction } = useAuth();

  if (!isOpen) return null;

  const getActionDetails = () => {
    switch (action?.type) {
      case 'add_to_cart':
        return {
          icon: <ShoppingBag size={28} className="text-cyan-500" />,
          title: title || 'Sign in to Add to Cart',
          message: message || `Sign in or create an account to add ${action.productName ? `"${action.productName}"` : 'this product'} to your drone delivery cart.`,
          badge: 'Cart Action',
        };
      case 'wishlist':
        return {
          icon: <Heart size={28} className="text-rose-500" />,
          title: title || 'Sign in to Save to Wishlist',
          message: message || `Create an account or sign in to save ${action.productName ? `"${action.productName}"` : 'items'} to your personal wishlist.`,
          badge: 'Wishlist Action',
        };
      case 'buy_now':
        return {
          icon: <Zap size={28} className="text-amber-500" />,
          title: title || 'Sign in for Instant Buy',
          message: message || 'Sign in to proceed directly to rapid drone dispatch and payment checkout.',
          badge: 'Express Drone Buy',
        };
      default:
        return {
          icon: <Lock size={28} className="text-indigo-500" />,
          title: title || 'Sign In to Continue',
          message: message || 'Please sign in to your SkyLink account or create a new one to access this feature.',
          badge: 'Account Required',
        };
    }
  };

  const details = getActionDetails();

  const handleSignIn = () => {
    if (action) {
      setPendingAction(action);
    }
    onClose();
    navigate('/login');
  };

  const handleCreateAccount = () => {
    if (action) {
      setPendingAction(action);
    }
    onClose();
    navigate('/register');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#ffffff',
          borderRadius: '20px',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          position: 'relative',
          textAlign: 'center',
          color: '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          title="Close modal"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          }}
        >
          {details.icon}
        </div>

        {/* Badge */}
        <div
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            background: '#f1f5f9',
            color: '#475569',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}
        >
          {details.badge}
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: '#0f172a',
            margin: '0 0 0.5rem',
          }}
        >
          {details.title}
        </h3>

        {/* Message */}
        <p
          style={{
            fontSize: '0.925rem',
            color: '#64748b',
            lineHeight: 1.5,
            margin: '0 0 1.75rem',
          }}
        >
          {details.message}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSignIn}
            leftIcon={<LogIn size={18} />}
            rightIcon={<ArrowRight size={18} />}
          >
            Sign In to Continue
          </Button>

          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={handleCreateAccount}
            leftIcon={<UserPlus size={18} />}
          >
            Create Free Account
          </Button>
        </div>

        {/* Continue browsing */}
        <div style={{ marginTop: '1.25rem' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '0.25rem',
            }}
          >
            Continue browsing as guest
          </button>
        </div>
      </div>
    </div>
  );
};
