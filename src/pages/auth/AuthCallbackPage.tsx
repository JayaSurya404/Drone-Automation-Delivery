import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { api } from '../../services/api';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { pendingAction, clearPendingAction } = useAuth();
  const { refreshCart } = useCart();
  const { refreshWishlist } = useWishlist();
  const { showToast } = useNotifications();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!session) {
          // Wait briefly for Supabase to parse hash tokens
          const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (newSession?.user) {
              await processVerifiedSession();
              authListener.subscription.unsubscribe();
            }
          });

          setTimeout(() => {
            if (status === 'loading') {
              setStatus('error');
              setErrorMessage('Verification link is expired or invalid. Please sign in or request a new link.');
            }
          }, 4000);
          return;
        }

        await processVerifiedSession();
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'Failed to verify email session.');
      }
    };

    const processVerifiedSession = async () => {
      setStatus('success');
      showToast('Email Verified! 🎉', 'Welcome to SkyNav Autonomous Drone Delivery.', 'success');

      // Execute pending action if customer was adding an item
      if (pendingAction) {
        if (pendingAction.type === 'add_to_cart' && pendingAction.productId) {
          try {
            await api.cart.addItem(pendingAction.productId, pendingAction.quantity || 1);
            await refreshCart();
            showToast('Added to Cart! 🛒', `${pendingAction.productName || 'Product'} added to your cart.`, 'success');
          } catch (err) {
            console.error('Failed to execute pending cart addition:', err);
          }
          const returnTarget = pendingAction.returnTo || '/cart';
          clearPendingAction();
          navigate(returnTarget, { replace: true });
          return;
        }

        if (pendingAction.type === 'wishlist' && pendingAction.productId) {
          try {
            await api.wishlist.add(pendingAction.productId);
            await refreshWishlist();
            showToast('Saved to Wishlist! ❤️', `${pendingAction.productName || 'Product'} saved.`, 'success');
          } catch (err) {
            console.error('Failed to execute pending wishlist item:', err);
          }
          const returnTarget = pendingAction.returnTo || '/wishlist';
          clearPendingAction();
          navigate(returnTarget, { replace: true });
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
    };

    handleAuthCallback();
  }, [navigate, pendingAction, clearPendingAction, refreshCart, refreshWishlist, showToast, status]);

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
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
        {status === 'loading' && (
          <div>
            <Loader2 size={48} className="spin" style={{ color: 'var(--accent-cyan)', margin: '0 auto 1.25rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Verifying Your Account...</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Confirming your email with SkyNav. You will be redirected shortly.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <CheckCircle2 size={48} style={{ color: 'var(--accent-emerald)', margin: '0 auto 1.25rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Email Verified! 🎉</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Redirecting you to the SkyNav Drone Store...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1.25rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Verification Link Expired</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
              {errorMessage}
            </p>
            <Button variant="primary" fullWidth onClick={() => navigate('/login')}>
              Go to Sign In
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
