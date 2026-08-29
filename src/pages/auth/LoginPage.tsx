import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Navigation, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';

export const LoginPage: React.FC = () => {
  const { login, pendingAction, clearPendingAction } = useAuth();
  const { refreshCart } = useCart();
  const { refreshWishlist } = useWishlist();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  // Fields initialized empty — NO hardcoded credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await login({ email: email.trim(), password, rememberMe });
      showToast('Welcome back!', `Signed in successfully as ${res.user.name || res.user.email}`, 'success');

      // Refresh customer carts and wishlists
      await Promise.all([refreshCart(), refreshWishlist()]);

      // Execute pending action if customer was trying to do something before signing in
      if (pendingAction) {
        if (pendingAction.type === 'add_to_cart' && pendingAction.productId) {
          try {
            await api.cart.addItem(pendingAction.productId, pendingAction.quantity || 1);
            showToast('Added to Cart! 🛒', `${pendingAction.productName || 'Product'} has been added to your cart.`, 'success');
            await refreshCart();
          } catch (err) {
            console.error('Failed to execute pending cart addition:', err);
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
            console.error('Failed to execute pending wishlist addition:', err);
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

      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.requiresVerification) {
        navigate('/verify-account', { state: { email: err.email || email.trim() } });
      } else {
        setError(err.message || 'Invalid email or password. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
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
          position: 'relative',
        }}
      >
        {/* Header Icon & Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-indigo) 100%)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              margin: '0 auto 1rem',
              boxShadow: '0 0 25px var(--accent-cyan-glow)',
            }}
          >
            <Navigation size={28} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Customer Portal Sign In</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Access active drone tracking, express orders, and saved addresses
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              color: '#ef4444',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Input
            label="Customer Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={18} />}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={18} />}
            rightIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            onRightIconClick={() => setShowPassword(!showPassword)}
            required
            autoComplete="current-password"
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: 'var(--accent-cyan)' }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>Remember me</span>
            </label>

            <Link
              to="/forgot-password"
              style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}
            >
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight size={18} />}
          >
            Sign In to Customer Portal
          </Button>
        </form>

        {/* Register Link */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Don't have a customer account?{' '}
          <Link to="/register" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
};
