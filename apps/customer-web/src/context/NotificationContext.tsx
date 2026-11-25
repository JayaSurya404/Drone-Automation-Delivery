import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { CustomerNotification } from '../types/notification';
import { api } from '../services/api';
import { realtimeDeliveryService } from '../services/realtimeDeliveryService';
import { useAuth } from './AuthContext';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  actionUrl?: string;
}

interface NotificationContextType {
  notifications: CustomerNotification[];
  unreadCount: number;
  toasts: ToastMessage[];
  showToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error', actionUrl?: string) => void;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const processedEventKeys = useRef<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }
    try {
      const data = await api.notifications.getAll();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const showToast = (
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'info',
    actionUrl?: string
  ) => {
    const toastId = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id: toastId, title, message, type, actionUrl }]);

    setTimeout(() => {
      dismissToast(toastId);
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Smart Real-Time Events Subscriber (Zero spam, only meaningful milestones)
  useEffect(() => {
    const unsubscribe = realtimeDeliveryService.subscribe((event) => {
      if (
        event.type === 'DRONE_LOCATION_UPDATED' ||
        event.type === 'DELIVERY_ETA_UPDATED'
      ) {
        return; // Silent update to live tracking UI only
      }

      const eventKey = `${event.orderId}_${event.type}`;
      if (processedEventKeys.current.has(eventKey)) {
        return;
      }
      processedEventKeys.current.add(eventKey);

      fetchNotifications();

      showToast(
        event.type === 'DELIVERY_COMPLETED' ? 'Package Delivered 🎉' : 'Delivery Update',
        event.message,
        event.type === 'DELIVERY_COMPLETED' ? 'success' : 'info',
        `/tracking/${event.orderId}`
      );
    });

    return () => {
      unsubscribe();
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await api.notifications.markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = async () => {
    await api.notifications.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = async () => {
    for (const n of notifications) {
      await api.notifications.clear(n.id);
    }
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        showToast,
        dismissToast,
        markAsRead,
        markAllAsRead,
        clearAll,
        fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
