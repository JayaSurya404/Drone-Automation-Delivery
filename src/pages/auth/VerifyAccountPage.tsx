import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../../components/common/Button';
import { ShieldCheck, Mail, ArrowRight, RotateCw } from 'lucide-react';

export const VerifyAccountPage: React.FC = () => {
  const { user, verifyAccount } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [otp, setOtp] = useState<string>('892410');
  const [timer, setTimer] = useState<number>(45);
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
    setIsLoading(true);

    try {
      await verifyAccount(otp);
      showToast('Account Verified! 🎉', 'Welcome to SkyLink Drone Delivery.', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    setTimer(60);
    showToast('Code Resent', 'A new 6-digit security code was dispatched to your email.', 'info');
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

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Verify Your Account</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem', marginBottom: '1.5rem' }}>
          We've sent a 6-digit verification code to <br />
          <strong style={{ color: 'var(--text-primary)' }}>{user?.email || 'your registered email'}</strong>
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
            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Enter 6-Digit Code (Demo: 892410)
            </label>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="form-control"
              style={{
                textAlign: 'center',
                letterSpacing: '0.4em',
                fontSize: '1.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
              }}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight size={18} />}
          >
            Verify & Go to Dashboard
          </Button>
        </form>

        <div style={{ marginTop: '1.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {timer > 0 ? (
            <span>Resend code in <strong>{timer}s</strong></span>
          ) : (
            <button
              onClick={handleResend}
              style={{ color: 'var(--accent-cyan)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RotateCw size={14} />
              <span>Resend Verification Code</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
