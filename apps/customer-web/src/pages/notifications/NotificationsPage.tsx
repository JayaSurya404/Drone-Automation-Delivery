import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationCategory } from '../../types/notification';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Bell,
  CheckCheck,
  Trash2,
  Zap,
  Package,
  ShieldCheck,
  Info,
  Tag,
  Clock,
  ArrowRight,
  Sliders,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filtered = notifications.filter((n) => (filter === 'unread' ? !n.read : true));

  // Group notifications into Today vs Earlier (Section 39)
  const isToday = (dateString: string) => {
    const d = new Date(dateString);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const todayNotifications = filtered.filter((n) => isToday(n.createdAt));
  const earlierNotifications = filtered.filter((n) => !isToday(n.createdAt));

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'drone':
        return <Zap size={18} color="var(--accent-blue)" />;
      case 'order':
        return <Package size={18} color="#10b981" />;
      case 'security':
        return <ShieldCheck size={18} color="var(--accent-indigo)" />;
      case 'promo':
        return <Tag size={18} color="#f59e0b" />;
      default:
        return <Info size={18} color="var(--accent-blue)" />;
    }
  };

  const handleNotificationClick = (notif: any) => {
    markAsRead(notif.id);
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  const renderCard = (notif: any) => (
    <div
      key={notif.id}
      onClick={() => handleNotificationClick(notif)}
      className="card glass-panel-interactive"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        padding: '1.25rem',
        background: notif.read ? '#ffffff' : '#f0f9ff',
        borderLeft: notif.read ? '1px solid var(--border-default)' : '4px solid var(--accent-blue)',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: notif.read ? '#f8fafc' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: '1px solid var(--border-default)',
        }}
      >
        {getCategoryIcon(notif.category)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: notif.read ? 'var(--text-primary)' : 'var(--accent-blue)' }}>
            {notif.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            <Clock size={12} />
            <span>{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {notif.message}
        </p>

        {notif.actionUrl && (
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
            <span>Open Delivery View</span>
            <ArrowRight size={13} />
          </div>
        )}
      </div>

      {!notif.read && <span className="pulse-dot cyan" style={{ marginTop: '6px' }} />}
    </div>
  );

  return (
    <div className="main-content" style={{ maxWidth: '800px' }}>
      {/* Header */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h1>Notification Center</h1>
            {unreadCount > 0 && (
              <span className="badge badge-cyan" style={{ fontSize: '0.8rem' }}>
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="section-subtitle">
            Meaningful real-time milestones for your autonomous delivery flights.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <Link to="/profile">
            <Button variant="ghost" size="sm" leftIcon={<Sliders size={14} />}>
              Preferences
            </Button>
          </Link>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              leftIcon={<CheckCheck size={15} />}
            >
              Mark All Read
            </Button>
          )}

          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              leftIcon={<Trash2 size={15} />}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.85rem',
            fontWeight: 600,
            background: filter === 'all' ? 'var(--accent-blue)' : '#f1f5f9',
            color: filter === 'all' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          All ({notifications.length})
        </button>

        <button
          onClick={() => setFilter('unread')}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.85rem',
            fontWeight: 600,
            background: filter === 'unread' ? 'var(--accent-blue)' : '#f1f5f9',
            color: filter === 'unread' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Grouped Notifications List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell size={36} />}
          title="You're all caught up"
          description={filter === 'unread' ? 'No unread notifications.' : 'You have no notifications in your history.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {todayNotifications.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Today
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {todayNotifications.map(renderCard)}
              </div>
            </div>
          )}

          {earlierNotifications.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Earlier
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {earlierNotifications.map(renderCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
