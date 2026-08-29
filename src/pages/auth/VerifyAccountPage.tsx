import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../../components/common/Button';
import { ShieldCheck, Mail, ArrowRight, RotateCw, Edit3 } from 'lucide-react';
import { api } from '../../services/api';

export const VerifyAccountPage: React.FC = () => {
  const { user, verifyAccount, resendVerification, pendingAction, clearPendingAction } = useAuth();
  const { refreshCart } = useCart();
  const { refreshWishlist } = useWishlist();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const emailFromState = (location.state as any)?.email;
  const targetEmail = emailFromState || user?.email || '';

  const [code, setCode] = useState<string>('');
  const [timer, setTimer] = useState<number>(45);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    try {
      await verifyAccount({ code: cleanCode, email: targetEmail });
      showToast('Account Verified! 🎉', 'Welcome to SkyLink Autonomous Drone Delivery.', 'success');

      await Promise.all([refreshCart(), refreshWishlist()]);

      // Execute pending customer action if one was preserved
      if (pendingAction) {
        if (pendingAction.type === 'add_to_cart' && pendingAction.productId) {
          try {
            await api.cart.addItem(pendingAction.productId, pendingAction.quantity || 1);
            showToast('Added to Cart! 🛒', `${pendingAction.productName || 'Product'} has been added to your cart.`, 'success');
            await refreshCart();
          } catch (err) {
            console.error('Failed to add pending cart item:', err);
          }
          clearPendingAction();
          navigate(pendingAction.returnTo || '/cart', { replace: true });
          return;
        }

        if (pendingAction.type === 'wishlist' && pendingAction.productId) {
          try {
            await api.wishlist.add(pendingAction.productId);
            showToast('Added to Wishlist! ❤️', `${pendingAction.productName || 'Product'} saved to your wishlist.`, 'success');
            await refreshWishlist();
          } catch (err) {
            console.error('Failed to add pending wishlist item:', err);
          }
          clearPendingAction();
          navigate(pendingAction.returnTo || '/wishlist', { replace: true });
          return;
        }

        if (pendingAction.type === 'buy_now' && pendingAction.productId) {
          try {
            await api.cart.addItem(pendingAction.productId, pendingAction.quantity || 1);
            await refreshCart();
          } catch (err) {
            console.error('Failed to execute buy now:', err);
          }
          clearPendingAction();
          navigate('/checkout', { replace: true });
          return;
        }

        if (pendingAction.returnTo) {
          const target = pendingAction.returnTo;
          clearPendingAction();
          navigate(target, { replace: true });
          return;
        }
      }

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    try {
      const res = await resendVerification({ email: targetEmail });
      setTimer(45);
      showToast('Code Resent', res.message || 'A new 6-digit verification code has been dispatched to your email.', 'info');
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div
        className="card glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '2.5rem 2rem',
          borderRadius: 'var(--radius-xl)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            background: 'rgba(0, 229, 255, 0.12)',
            border: '2px solid var(--accent-cyan)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 20px var(--accent-cyan-glow)',
          }}
        >
          <ShieldCheck size={32} />
        </div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Verify Your Email</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem', marginBottom: '1.5rem' }}>
          We've sent a 6-digit verification code to <br />
          <strong style={{ color: 'var(--text-primary)' }}>{targetEmail || 'your registered email'}</strong>
        </p>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              color: '#ef4444',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              6-Digit Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="form-control"
              style={{
                textAlign: 'center',
                letterSpacing: '0.45em',
                fontSize: '1.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
              }}
              required
              autoFocus
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            disabled={code.trim().length !== 6}
            rightIcon={<ArrowRight size={18} />}
          >
            Verify & Activate Account
          </Button>
        </form>

        <div style={{ marginTop: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <div>
            {timer > 0 ? (
              <span>Didn't receive code? Resend in <strong>{timer}s</strong></span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                style={{
                  color: 'var(--accent-cyan)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <RotateCw size={14} className={isResending ? 'spin' : ''} />
                <span>Resend Verification Code</span>
              </button>
            )}
          </div>

          <div>
            <Link
              to="/register"
              style={{
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                textDecoration: 'underline',
              }}
            >
              <Edit3 size={13} />
              <span>Change email address</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
