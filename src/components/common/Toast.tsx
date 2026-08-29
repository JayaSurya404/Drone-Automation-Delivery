import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} color="#10b981" />;
      case 'warning':
        return <AlertTriangle size={20} color="#f59e0b" />;
      case 'error':
        return <XCircle size={20} color="#ef4444" />;
      default:
        return <Info size={20} color="#00e5ff" />;
    }
  };

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <div className="toast-icon">{getIcon(toast.type)}</div>
          <div className="toast-content" style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.15rem' }}>
              {toast.title}
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              {toast.message}
            </div>
            {toast.actionUrl && (
              <Link
                to={toast.actionUrl}
                onClick={() => dismissToast(toast.id)}
                style={{
                  display: 'inline-block',
                  marginTop: '0.35rem',
                  fontSize: '0.8rem',
                  color: 'var(--accent-cyan)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                View Details &rarr;
              </Link>
            )}
          </div>
          <button
            onClick={() => dismissToast(toast.id)}
            style={{ color: 'var(--text-tertiary)', padding: '0.2rem' }}
            aria-label="Dismiss toast"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
