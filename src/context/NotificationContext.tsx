import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { CustomerNotification, NotificationCategory } from '../types/notification';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { realtimeDeliveryService } from '../services/realtimeDeliveryService';
import { INITIAL_NOTIFICATIONS } from '../services/mockData';

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
  const [notifications, setNotifications] = useState<CustomerNotification[]>(() => {
    return storage.get<CustomerNotification[]>(storage.keys.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const processedEventKeys = useRef<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    const data = await api.notifications.getAll();
    setNotifications(data);
  }, []);

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
      // 1. Silent events: GPS location, ETA ticks, and reconnect updates MUST NOT generate notifications
      if (
        event.type === 'DRONE_LOCATION_UPDATED' ||
        event.type === 'DELIVERY_ETA_UPDATED'
      ) {
        return; // Silent update to live tracking UI only
      }

      // 2. Deduplication check: prevent duplicate notifications for same order & milestone
      const eventKey = `${event.orderId}_${event.type}`;
      if (processedEventKeys.current.has(eventKey)) {
        return;
      }
      processedEventKeys.current.add(eventKey);

      // 3. Create single meaningful customer notification
      const newNotif: CustomerNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        customerId: 'cust_984210',
        orderId: event.orderId,
        title:
          event.type === 'DELIVERY_COMPLETED'
            ? 'Package Delivered 🎉'
            : event.type === 'DELIVERY_APPROACHING'
            ? 'Drone Arriving Soon 🚁'
            : event.type === 'DRONE_LAUNCHED'
            ? 'Drone In Flight 🚀'
            : event.type === 'DELIVERY_DELAYED'
            ? 'Flight Delayed'
            : 'Delivery Update',
        message: event.message,
        category: event.type === 'DELIVERY_COMPLETED' || event.type === 'DELIVERY_APPROACHING' ? 'drone' : 'order',
        read: false,
        createdAt: new Date().toISOString(),
        actionUrl: `/tracking/${event.orderId}`,
      };

      setNotifications((prev) => {
        const updated = [newNotif, ...prev];
        storage.set(storage.keys.NOTIFICATIONS, updated);
        return updated;
      });

      // Show high priority toast for milestone
      showToast(
        newNotif.title,
        newNotif.message,
        event.type === 'DELIVERY_COMPLETED' ? 'success' : event.type === 'DELIVERY_DELAYED' ? 'warning' : 'info',
        newNotif.actionUrl
      );
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const markAsRead = async (id: string) => {
    await api.notifications.markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = async () => {
    await api.notifications.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = async () => {
    await api.notifications.clearAll();
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
