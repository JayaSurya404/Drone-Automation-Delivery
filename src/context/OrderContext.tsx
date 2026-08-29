import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { CustomerOrder, CustomerOrderStatus } from '../types/order';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { realtimeDeliveryService } from '../services/realtimeDeliveryService';
import { INITIAL_ORDERS } from '../services/mockData';

interface OrderContextType {
  orders: CustomerOrder[];
  activeOrder: CustomerOrder | null;
  isLoading: boolean;
  fetchOrders: () => Promise<void>;
  getOrderById: (id: string) => Promise<CustomerOrder>;
  createOrder: (orderData: Omit<CustomerOrder, 'id' | 'createdAt' | 'updatedAt' | 'timeline' | 'deliveryOtp' | 'isCancellable' | 'status'>) => Promise<CustomerOrder>;
  cancelOrder: (orderId: string, reason: string) => Promise<CustomerOrder>;
  rateOrder: (orderId: string, stars: number, feedback?: string) => Promise<CustomerOrder>;
  stats: {
    total: number;
    active: number;
    delivered: number;
    pending: number;
  };
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<CustomerOrder[]>(() => {
    return storage.get<CustomerOrder[]>(storage.keys.ORDERS, INITIAL_ORDERS);
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.orders.getAll();
      setOrders(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen to milestone real-time events ONLY (never re-render orders on silent GPS coordinates)
  useEffect(() => {
    const unsubscribe = realtimeDeliveryService.subscribe((event) => {
      // Ignore silent GPS/telemetry ticks
      if (event.type === 'DRONE_LOCATION_UPDATED' || event.type === 'DELIVERY_ETA_UPDATED') {
        return;
      }

      if (event.status) {
        setOrders((prev) => {
          const index = prev.findIndex((o) => o.id === event.orderId);
          if (index === -1) return prev;

          const currentOrder = prev[index];
          // Only update if status actually changed
          if (currentOrder.status === event.status && event.type !== 'DELIVERY_COMPLETED') {
            return prev;
          }

          const updated = [...prev];
          const order = { ...currentOrder };
          order.status = event.status as CustomerOrderStatus;
          order.isCancellable = order.status === 'Order Placed' || order.status === 'Order Confirmed';
          order.updatedAt = new Date().toISOString();

          // Update timeline entry
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
          storage.set(storage.keys.ORDERS, updated);
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

  const createOrder = useCallback(async (
    orderData: Omit<CustomerOrder, 'id' | 'createdAt' | 'updatedAt' | 'timeline' | 'deliveryOtp' | 'isCancellable' | 'status'>
  ): Promise<CustomerOrder> => {
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

  const rateOrder = useCallback(async (orderId: string, stars: number, feedback?: string): Promise<CustomerOrder> => {
    const updated = await api.orders.rate(orderId, stars, feedback);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    return updated;
  }, []);

  const activeOrder = useMemo(() => {
    return (
      orders.find(
        (o) =>
          o.status !== 'Delivered' &&
          o.status !== 'Cancelled' &&
          o.status !== 'Delivery Failed'
      ) || null
    );
  }, [orders]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      active: orders.filter(
        (o) =>
          o.status !== 'Delivered' &&
          o.status !== 'Cancelled' &&
          o.status !== 'Delivery Failed'
      ).length,
      delivered: orders.filter((o) => o.status === 'Delivered').length,
      pending: orders.filter(
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
