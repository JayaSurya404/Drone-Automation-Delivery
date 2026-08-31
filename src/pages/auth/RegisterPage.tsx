import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Navigation, User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, Send } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: true,
    acceptPrivacy: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Full name is required.';
    if (!formData.email.trim() || !formData.email.includes('@')) newErrors.email = 'Please provide a valid email address.';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required for flight alerts.';
    if (!formData.password || formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters long.';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
    if (!formData.acceptTerms) newErrors.acceptTerms = 'You must accept the Terms & Conditions.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const res = await register(formData);
      if (res.requiresVerification) {
        setRegisteredEmail(formData.email.trim());
        setIsRegistered(true);
        showToast('Confirmation Email Sent ✉️', `Check ${formData.email.trim()} to verify your account.`, 'info');
      } else {
        showToast('Account Created 🎉', 'Welcome to SkyNav!', 'success');
        navigate('/dashboard');
      }
    } catch (err: any) {
      setErrors({ form: err.message || 'Registration failed. Please check your information.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isRegistered) {
    return (
      <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
        <div
          className="card glass-panel"
          style={{
            width: '100%',
            maxWidth: '480px',
            padding: '3rem 2rem',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'rgba(0, 229, 255, 0.12)',
              border: '2px solid var(--accent-cyan)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)',
              margin: '0 auto 1.5rem',
              boxShadow: '0 0 25px var(--accent-cyan-glow)',
            }}
          >
            <Send size={32} />
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Check Your Email</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
            We've sent an account activation link to <br />
            <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{registeredEmail}</strong>
          </p>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              margin: '1.75rem 0',
              textAlign: 'left',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.35rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--accent-cyan)' }} />
              <span>Next Steps:</span>
            </div>
            1. Open the email from <strong>SkyNav Drone Store</strong>.<br />
            2. Click the <strong>Confirm your email</strong> link.<br />
            3. You'll be automatically redirected back to continue shopping!
          </div>

          <Button variant="outline" fullWidth onClick={() => navigate('/login')}>
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
      <div
        className="card glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '2.5rem 2rem',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
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
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Create Customer Account</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Experience ultra-fast autonomous drone delivery to your doorstep
          </p>
        </div>

        {errors.form && (
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
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            leftIcon={<User size={18} />}
            error={errors.name}
            required
            autoComplete="name"
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <Input
              label="Email Address"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              leftIcon={<Mail size={18} />}
              error={errors.email}
              required
              autoComplete="email"
            />
            <Input
              label="Mobile Phone"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              leftIcon={<Phone size={18} />}
              error={errors.phone}
              required
              autoComplete="tel"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              leftIcon={<Lock size={18} />}
              rightIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              onRightIconClick={() => setShowPassword(!showPassword)}
              error={errors.password}
              required
              autoComplete="new-password"
            />
            <Input
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              leftIcon={<Lock size={18} />}
              error={errors.confirmPassword}
              required
              autoComplete="new-password"
            />
          </div>

          {/* Terms Checkbox */}
          <div style={{ margin: '1rem 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                style={{ marginTop: '0.2rem', accentColor: 'var(--accent-cyan)' }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>
                I agree to the <strong>Terms & Conditions</strong> for autonomous air deliveries and drop zone safety.
              </span>
            </label>
            {errors.acceptTerms && <span className="form-error-msg">{errors.acceptTerms}</span>}

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.acceptPrivacy}
                onChange={(e) => setFormData({ ...formData, acceptPrivacy: e.target.checked })}
                style={{ marginTop: '0.2rem', accentColor: 'var(--accent-cyan)' }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>
                I agree to the <strong>Privacy Policy</strong> and GPS telemetry logging for precise drop markers.
              </span>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
            rightIcon={<ArrowRight size={18} />}
          >
            Create Customer Account
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
