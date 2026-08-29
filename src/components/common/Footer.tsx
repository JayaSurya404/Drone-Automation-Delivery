import React from 'react';
import { Link } from 'react-router-dom';
import { Plane, ShieldCheck, Zap, PhoneCall, Heart, Send, MapPin, Award, Lock } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="ecom-app-footer">
      {/* ── Top Trust Bar in Footer ── */}
      <div className="footer-trust-strip">
        <div className="footer-trust-inner">
          <div className="footer-trust-col">
            <ShieldCheck size={20} className="trust-strip-icon" />
            <div>
              <strong>FAA & EASA Compliant</strong>
              <span>Certified autonomous urban flight corridors</span>
            </div>
          </div>
          <div className="footer-trust-col">
            <Lock size={20} className="trust-strip-icon" />
            <div>
              <strong>100% Secure Checkout</strong>
              <span>256-bit encrypted payments</span>
            </div>
          </div>
          <div className="footer-trust-col">
            <Zap size={20} className="trust-strip-icon" />
            <div>
              <strong>10–20 Min Delivery</strong>
              <span>Direct aerial dispatch to landing zone</span>
            </div>
          </div>
          <div className="footer-trust-col">
            <PhoneCall size={20} className="trust-strip-icon" />
            <div>
              <strong>24/7 Ground Ops</strong>
              <span>Instant live support for all flights</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Multi-Column Footer ── */}
      <div className="footer-main-container">
        <div className="footer-columns-grid">
          {/* Col 1: Brand & Mission */}
          <div className="footer-col brand-col">
            <Link to="/dashboard" className="footer-brand-logo">
              <div className="brand-icon-box">
                <Plane size={20} />
              </div>
              <div className="brand-text-block">
                <span className="brand-name">SkyLink</span>
                <span className="brand-tagline">DRONE STORE</span>
              </div>
            </Link>
            <p className="footer-brand-desc">
              Next-generation autonomous electric drone delivery engineered for ultra-fast, whisper-quiet, and contactless transport of food, medicine, groceries, and tech essentials.
            </p>
            <div className="footer-flight-support-box">
              <div className="flight-support-label">Live Ground Control Helpline</div>
              <div className="flight-support-phone">
                <PhoneCall size={16} /> 1-800-SKY-DRONE
              </div>
              <span className="flight-support-sub">Toll-free 24/7 flight assistance</span>
            </div>
          </div>

          {/* Col 2: Shop Categories */}
          <div className="footer-col">
            <h4 className="footer-heading">Shop Marketplace</h4>
            <ul className="footer-links-list">
              <li><Link to="/products">All Products</Link></li>
              <li><Link to="/products?category=Medicine">Pharmacy & First Aid</Link></li>
              <li><Link to="/products?category=Food">Hot Gourmet Meals</Link></li>
              <li><Link to="/products?category=Groceries">Fresh Groceries & Coffee</Link></li>
              <li><Link to="/products?category=Electronics">Tech, GaN & Audio</Link></li>
              <li><Link to="/products?category=Documents">Secure Legal Courier</Link></li>
              <li><Link to="/products?deals=true">Lightning Deals & Discounts</Link></li>
            </ul>
          </div>

          {/* Col 3: Customer Care */}
          <div className="footer-col">
            <h4 className="footer-heading">Customer Care</h4>
            <ul className="footer-links-list">
              <li><Link to="/orders">Track Active Flight</Link></li>
              <li><Link to="/orders">Order History & Invoices</Link></li>
              <li><Link to="/addresses">Saved Drop Zones & Pads</Link></li>
              <li><Link to="/cart">Shopping Basket</Link></li>
              <li><Link to="/wishlist">Saved Favorites</Link></li>
              <li><Link to="/support">Help Center & FAQs</Link></li>
              <li><Link to="/support">Report Drop-off Issue</Link></li>
            </ul>
          </div>

          {/* Col 4: Drone Delivery Info */}
          <div className="footer-col">
            <h4 className="footer-heading">Drone Aviation</h4>
            <ul className="footer-links-list">
              <li><Link to="/support">How Drone Delivery Works</Link></li>
              <li><Link to="/support">Lawn & Rooftop Pad Setup</Link></li>
              <li><Link to="/support">Weather & Wind Safety Limits</Link></li>
              <li><Link to="/support">Zero-Carbon Electric Fleet</Link></li>
              <li><Link to="/support">Acoustic Noise Certification</Link></li>
              <li><Link to="/support">Flight Corridor Coverage Map</Link></li>
            </ul>
          </div>

          {/* Col 5: Account & Legal */}
          <div className="footer-col">
            <h4 className="footer-heading">Account & Trust</h4>
            <ul className="footer-links-list">
              <li><Link to="/profile">Customer Profile</Link></li>
              <li><Link to="/notifications">Notification Preferences</Link></li>
              <li><span className="footer-static-link">Terms of Drone Service</span></li>
              <li><span className="footer-static-link">Customer Privacy Policy</span></li>
              <li><span className="footer-static-link">FAA Flight Safety Notice</span></li>
              <li><span className="footer-static-link">Consumer Air Transport Rights</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Bottom Copyright Bar ── */}
      <div className="footer-bottom-bar">
        <div className="footer-bottom-inner">
          <div className="footer-copyright-text">
            &copy; {new Date().getFullYear()} SkyLink Autonomous Drone Delivery Inc. All rights reserved. (Customer Shopping Portal).
          </div>
          <div className="footer-bottom-badge">
            <span>Powered by 100% Clean Autonomous Aviation</span>
            <Heart size={14} fill="#ef4444" color="#ef4444" />
          </div>
        </div>
      </div>
    </footer>
  );
};
