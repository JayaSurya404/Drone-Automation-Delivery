import React from 'react';
import { Link } from 'react-router-dom';
import { Navigation, ShieldCheck, Zap, PhoneCall, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div>
          <div className="nav-brand" style={{ marginBottom: '0.85rem' }}>
            <div className="nav-brand-icon">
              <Navigation size={18} />
            </div>
            <div>
              <span className="text-gradient">SkyLink</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 500, marginLeft: '0.4rem', color: 'var(--text-secondary)' }}>
                Drone Delivery
              </span>
            </div>
          </div>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, maxWidth: '320px', color: 'var(--text-secondary)' }}>
            Autonomous electric drone delivery engineered for ultra-fast, safe, and whisper-quiet consumer transport of food, medicine, groceries, and urgent goods.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
            <div className="badge badge-cyan" style={{ fontSize: '0.75rem' }}>
              <ShieldCheck size={14} />
              <span>Safe Air Corridor Certified</span>
            </div>
            <div className="badge badge-success" style={{ fontSize: '0.75rem' }}>
              <Zap size={14} />
              <span>100% Electric Zero-Emission</span>
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Customer Portal</h4>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
            <li>
              <Link to="/products" style={{ color: 'var(--text-secondary)' }}>Browse Products</Link>
            </li>
            <li>
              <Link to="/orders" style={{ color: 'var(--text-secondary)' }}>Order History</Link>
            </li>
            <li>
              <Link to="/cart" style={{ color: 'var(--text-secondary)' }}>Shopping Cart</Link>
            </li>
            <li>
              <Link to="/addresses" style={{ color: 'var(--text-secondary)' }}>Delivery Addresses</Link>
            </li>
            <li>
              <Link to="/profile" style={{ color: 'var(--text-secondary)' }}>Account Settings</Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Support & Safety</h4>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
            <li>
              <Link to="/support" style={{ color: 'var(--text-secondary)' }}>Help Center & FAQs</Link>
            </li>
            <li>
              <Link to="/support" style={{ color: 'var(--text-secondary)' }}>Report Drop-off Issue</Link>
            </li>
            <li>
              <Link to="/support" style={{ color: 'var(--text-secondary)' }}>Landing Pad Guidelines</Link>
            </li>
            <li>
              <span style={{ color: 'var(--text-secondary)' }}>Terms of Service</span>
            </li>
            <li>
              <span style={{ color: 'var(--text-secondary)' }}>Privacy Policy</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Live Flight Support</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Need help with an active delivery drop-off? Our ground operations team is available 24/7.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.95rem' }}>
            <PhoneCall size={16} />
            <span>1-800-SKY-DRONE</span>
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            Average response time: &lt; 45 seconds
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div>
          &copy; {new Date().getFullYear()} SkyLink Autonomous Drone Delivery Inc. All rights reserved. (Customer Portal Only).
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span>Powered by Clean Autonomous Aviation</span>
          <Heart size={14} color="#ef4444" fill="#ef4444" />
        </div>
      </div>
    </footer>
  );
};
