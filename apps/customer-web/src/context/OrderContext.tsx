import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { CustomerOrder, CustomerOrderStatus } from '../types/order';
import { api } from '../services/api';
import { realtimeDeliveryService } from '../services/realtimeDeliveryService';
import { useAuth } from './AuthContext';

interface OrderContextType {
  orders: CustomerOrder[];
  activeOrder: CustomerOrder | null;
  isLoading: boolean;
  error: Error | null;
  fetchOrders: () => Promise<void>;
  getOrderById: (id: string) => Promise<CustomerOrder>;
  createOrder: (orderData: any) => Promise<CustomerOrder>;
  cancelOrder: (orderId: string, reason: string) => Promise<CustomerOrder>;
  rateOrder: (orderId: string, stars: number, feedback?: string) => Promise<any>;
  stats: {
    total: number;
    active: number;
    delivered: number;
    pending: number;
  };
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.orders.getAll();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch orders from backend:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Listen to milestone real-time events (deduplicated)
  useEffect(() => {
    const unsubscribe = realtimeDeliveryService.subscribe((event) => {
      if (event.type === 'DRONE_LOCATION_UPDATED' || event.type === 'DELIVERY_ETA_UPDATED') {
        return;
      }

      if (event.status) {
        setOrders((prev) => {
          const index = prev.findIndex((o) => o.id === event.orderId);
          if (index === -1) return prev;

          const currentOrder = prev[index];
          if (currentOrder.status === event.status && event.type !== 'DELIVERY_COMPLETED') {
            return prev;
          }

          const updated = [...prev];
          const order = { ...currentOrder };
          order.status = event.status as CustomerOrderStatus;
          order.isCancellable = order.status === 'Order Placed' || order.status === 'Order Confirmed';
          order.updatedAt = new Date().toISOString();

          const timelineIndex = order.timeline.findIndex((t) => t.status === event.status);
          if (timelineIndex !== -1) {
            order.timeline = order.timeline.map((entry, idx) => ({
              ...entry,
              completed: idx <= timelineIndex,
              timestamp: idx === timelineIndex ? 'Just now' : entry.timestamp,
            }));
          }

          if (event.status === 'Delivered') {
            order.completedAt = new Date().toISOString();
          }

          updated[index] = order;
          return updated;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const getOrderById = useCallback(async (id: string): Promise<CustomerOrder> => {
    return api.orders.getById(id);
  }, []);

  const createOrder = useCallback(async (orderData: any): Promise<CustomerOrder> => {
    setIsLoading(true);
    try {
      const newOrder = await api.orders.create(orderData);
      setOrders((prev) => [newOrder, ...prev]);
      return newOrder;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelOrder = useCallback(async (orderId: string, reason: string): Promise<CustomerOrder> => {
    setIsLoading(true);
    try {
      const updated = await api.orders.cancel(orderId, reason);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      return updated;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rateOrder = useCallback(async (orderId: string, stars: number, feedback?: string): Promise<any> => {
    const res = await api.orders.rate(orderId, stars, feedback);
    await fetchOrders();
    return res;
  }, [fetchOrders]);

  const activeOrder = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    return (
      list.find(
        (o) =>
          o.status !== 'Delivered' &&
          o.status !== 'Cancelled' &&
          o.status !== 'Delivery Failed'
      ) || null
    );
  }, [orders]);

  const stats = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    return {
      total: list.length,
      active: list.filter(
        (o) =>
          o.status !== 'Delivered' &&
          o.status !== 'Cancelled' &&
          o.status !== 'Delivery Failed'
      ).length,
      delivered: list.filter((o) => o.status === 'Delivered').length,
      pending: list.filter(
        (o) => o.status === 'Order Placed' || o.status === 'Order Confirmed' || o.status === 'Preparing'
      ).length,
    };
  }, [orders]);

  return (
    <OrderContext.Provider
      value={{
        orders,
        activeOrder,
        isLoading,
        error,
        fetchOrders,
        getOrderById,
        createOrder,
        cancelOrder,
        rateOrder,
        stats,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = (): OrderContextType => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};
