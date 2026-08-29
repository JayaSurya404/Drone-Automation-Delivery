import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ShoppingBag, Package, Heart, Radio, User } from 'lucide-react';
import { useOrders } from '../../context/OrderContext';
import { useWishlist } from '../../context/WishlistContext';

export const MobileNav: React.FC = () => {
  const { activeOrder } = useOrders();
  const { wishlistCount } = useWishlist();

  const items = [
    { to: '/', icon: <Home size={20} />, label: 'Home' },
    { to: '/products', icon: <ShoppingBag size={20} />, label: 'Shop' },
    {
      to: activeOrder ? `/tracking/${activeOrder.id}` : '/wishlist',
      icon: activeOrder ? <Radio size={20} /> : <Heart size={20} />,
      label: activeOrder ? 'Live Drone' : 'Wishlist',
      isTrack: !!activeOrder,
      badge: !activeOrder && wishlistCount > 0 ? wishlistCount : undefined,
    },
    { to: '/orders', icon: <Package size={20} />, label: 'Orders' },
    { to: '/profile', icon: <User size={20} />, label: 'Account' },
  ];

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <div className="mobile-nav-inner">
        {items.map(({ to, icon, label, isTrack, badge }) => (
          <NavLink
            key={to + label}
            to={to}
            className={({ isActive }) =>
              `mobile-nav-item${isActive && isTrack ? ' track-active' : isActive ? ' active' : ''}`
            }
            aria-label={label}
          >
            {({ isActive }) => (
              <>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    transition: 'transform var(--transition-spring)',
                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  {icon}
                  {isTrack && activeOrder && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-3px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#0ea5e9',
                        border: '2px solid white',
                      }}
                    />
                  )}
                  {badge && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-8px',
                        background: '#ef4444',
                        color: '#ffffff',
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        padding: '0.05rem 0.3rem',
                        borderRadius: '9999px',
                        lineHeight: 1.2,
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
