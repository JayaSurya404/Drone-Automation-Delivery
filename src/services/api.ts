import { storage } from './storage';
import { CustomerUser, LoginPayload, RegisterPayload } from '../types/auth';
import { Product, ProductCategory } from '../types/product';
import { CustomerAddress, GeofenceCheckResult } from '../types/address';
import { CustomerOrder, CustomerOrderStatus } from '../types/order';
import { CustomerNotification } from '../types/notification';
import { FAQItem, SupportTicket, SupportTicketCategory } from '../types/support';
import {
  INITIAL_ADDRESSES,
  INITIAL_FAQS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_TICKETS,
  INITIAL_USER,
} from './mockData';
import { realtimeDeliveryService } from './realtimeDeliveryService';

// Helper to simulate realistic API latency
const delay = (ms: number = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  auth: {
    login: async (payload: LoginPayload): Promise<{ user: CustomerUser; token: string }> => {
      await delay(300);
      if (!payload.email || !payload.password) {
        throw new Error('Please provide both email and password.');
      }
      if (payload.password.length < 6) {
        throw new Error('Invalid credentials. Password must be at least 6 characters.');
      }

      // Check if user is disabled or unverified in demo
      const user: CustomerUser = {
        ...INITIAL_USER,
        email: payload.email,
      };

      const token = `jwt_skylink_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      storage.set(storage.keys.AUTH_USER, user);
      storage.set(storage.keys.AUTH_TOKEN, token);

      return { user, token };
    },

    register: async (payload: RegisterPayload): Promise<{ user: CustomerUser; requiresVerification: boolean }> => {
      await delay(350);
      if (!payload.name || !payload.email || !payload.phone || !payload.password) {
        throw new Error('Please fill all required fields.');
      }
      if (payload.password !== payload.confirmPassword) {
        throw new Error('Passwords do not match.');
      }
      if (!payload.acceptTerms) {
        throw new Error('You must accept the Terms & Conditions.');
      }

      const newUser: CustomerUser = {
        id: `cust_${Math.floor(100000 + Math.random() * 900000)}`,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        isVerified: false,
        accountStatus: 'pending_verification',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      storage.set(storage.keys.AUTH_USER, newUser);
      return { user: newUser, requiresVerification: true };
    },

    verifyAccount: async (otp: string): Promise<{ success: boolean; user: CustomerUser }> => {
      await delay(300);
      if (otp.length !== 6) {
        throw new Error('Please enter a valid 6-digit verification code.');
      }

      const user = storage.get<CustomerUser>(storage.keys.AUTH_USER, INITIAL_USER);
      const verifiedUser: CustomerUser = {
        ...user,
        isVerified: true,
        accountStatus: 'active',
        updatedAt: new Date().toISOString(),
      };

      storage.set(storage.keys.AUTH_USER, verifiedUser);
      storage.set(storage.keys.AUTH_TOKEN, `jwt_skylink_verified_${Date.now()}`);
      return { success: true, user: verifiedUser };
    },

    forgotPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
      await delay(300);
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid customer email address.');
      }
      return {
        success: true,
        message: 'A 6-digit reset code has been sent to your registered email address.',
      };
    },

    resetPassword: async (password: string, confirm: string): Promise<{ success: boolean }> => {
      await delay(300);
      if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }
      if (password !== confirm) {
        throw new Error('Passwords do not match.');
      }
      return { success: true };
    },

    logout: async (): Promise<void> => {
      storage.remove(storage.keys.AUTH_USER);
      storage.remove(storage.keys.AUTH_TOKEN);
    },
  },

  customer: {
    getProfile: async (): Promise<CustomerUser> => {
      await delay(150);
      return storage.get<CustomerUser>(storage.keys.AUTH_USER, INITIAL_USER);
    },

    updateProfile: async (updates: Partial<CustomerUser>): Promise<CustomerUser> => {
      await delay(250);
      const current = storage.get<CustomerUser>(storage.keys.AUTH_USER, INITIAL_USER);
      const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
      storage.set(storage.keys.AUTH_USER, updated);
      return updated;
    },

    getAddresses: async (): Promise<CustomerAddress[]> => {
      await delay(150);
      return storage.get<CustomerAddress[]>(storage.keys.ADDRESSES, INITIAL_ADDRESSES);
    },

    saveAddress: async (addressData: Omit<CustomerAddress, 'id' | 'customerId'> & { id?: string }): Promise<CustomerAddress> => {
      await delay(250);
      const addresses = storage.get<CustomerAddress[]>(storage.keys.ADDRESSES, INITIAL_ADDRESSES);
      const user = storage.get<CustomerUser>(storage.keys.AUTH_USER, INITIAL_USER);

      if (addressData.isDefault) {
        addresses.forEach((a) => (a.isDefault = false));
      }

      let savedAddress: CustomerAddress;

      if (addressData.id) {
        const index = addresses.findIndex((a) => a.id === addressData.id);
        savedAddress = {
          ...addresses[index],
          ...addressData,
          customerId: user.id,
          id: addressData.id,
        };
        addresses[index] = savedAddress;
      } else {
        savedAddress = {
          ...addressData,
          id: `addr_${Date.now()}`,
          customerId: user.id,
          isDefault: addressData.isDefault || addresses.length === 0,
        };
        addresses.push(savedAddress);
      }

      storage.set(storage.keys.ADDRESSES, addresses);
      return savedAddress;
    },

    deleteAddress: async (id: string): Promise<void> => {
      await delay(200);
      const addresses = storage.get<CustomerAddress[]>(storage.keys.ADDRESSES, INITIAL_ADDRESSES);
      const filtered = addresses.filter((a) => a.id !== id);
      storage.set(storage.keys.ADDRESSES, filtered);
    },
  },

  products: {
    getAll: async (params?: {
      category?: ProductCategory | 'All';
      search?: string;
      sortBy?: 'price-asc' | 'price-desc' | 'rating' | 'popular' | 'newest';
    }): Promise<Product[]> => {
      await delay(200);
      let products = [...INITIAL_PRODUCTS];

      if (params?.category && params.category !== 'All') {
        products = products.filter((p) => p.category === params.category);
      }

      if (params?.search && params.search.trim()) {
        const q = params.search.toLowerCase().trim();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        );
      }

      if (params?.sortBy) {
        switch (params.sortBy) {
          case 'price-asc':
            products.sort((a, b) => a.price - b.price);
            break;
          case 'price-desc':
            products.sort((a, b) => b.price - a.price);
            break;
          case 'rating':
            products.sort((a, b) => b.rating - a.rating);
            break;
          case 'popular':
            products.sort((a, b) => b.reviewCount - a.reviewCount);
            break;
          default:
            break;
        }
      }

      return products;
    },

    getById: async (id: string): Promise<Product> => {
      await delay(150);
      const product = INITIAL_PRODUCTS.find((p) => p.id === id);
      if (!product) throw new Error('Product not found or currently unavailable for drone delivery.');
      return product;
    },
  },

  delivery: {
    checkGeofence: async (latitude: number, longitude: number): Promise<GeofenceCheckResult> => {
      await delay(300);
      const hub = realtimeDeliveryService.getHubLocation();
      const dist = realtimeDeliveryService.calculateDistanceKm(
        hub.latitude,
        hub.longitude,
        latitude,
        longitude
      );

      // Max drone delivery operational radius is 15 km
      if (dist > 15.0) {
        return {
          isEligible: false,
          status: 'Not Eligible',
          distanceFromHubKm: dist,
          estimatedFlightMinutes: 0,
          message: `Location is ${dist} km from SkyHub Central (maximum safe drone delivery radius is 15 km).`,
        };
      }

      const flightMins = Math.max(7, Math.ceil(dist * 2.1));
      return {
        isEligible: true,
        status: 'Eligible',
        distanceFromHubKm: dist,
        estimatedFlightMinutes: flightMins,
        message: `Great! Drone delivery is available for this location (~${flightMins} min flight time).`,
      };
    },
  },

  orders: {
    getAll: async (): Promise<CustomerOrder[]> => {
      await delay(200);
      return storage.get<CustomerOrder[]>(storage.keys.ORDERS, INITIAL_ORDERS);
    },

    getById: async (orderId: string): Promise<CustomerOrder> => {
      await delay(150);
      const orders = storage.get<CustomerOrder[]>(storage.keys.ORDERS, INITIAL_ORDERS);
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error(`Order #${orderId} was not found.`);
      return order;
    },

    create: async (orderData: Omit<CustomerOrder, 'id' | 'createdAt' | 'updatedAt' | 'timeline' | 'deliveryOtp' | 'isCancellable' | 'status'>): Promise<CustomerOrder> => {
      await delay(400);
      const orders = storage.get<CustomerOrder[]>(storage.keys.ORDERS, INITIAL_ORDERS);
      const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
      const newId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;

      const newOrder: CustomerOrder = {
        ...orderData,
        id: newId,
        status: 'Order Placed',
        deliveryOtp: randomOtp,
        isCancellable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [
          {
            status: 'Order Placed',
            timestamp: 'Just now',
            description: 'Customer order placed successfully and payment secured.',
            completed: true,
          },
          {
            status: 'Order Confirmed',
            timestamp: 'Processing',
            description: 'Order confirmed and inventory locked at SkyHub Central.',
            completed: false,
          },
          {
            status: 'Preparing',
            timestamp: 'Pending',
            description: 'Items loaded and balanced inside AeroSafe cargo compartment.',
            completed: false,
          },
          {
            status: 'Drone Assigned',
            timestamp: 'Pending',
            description: 'Autonomous delivery drone assigned with verified air corridor.',
            completed: false,
          },
          {
            status: 'Drone Launched',
            timestamp: 'Pending',
            description: 'Drone departed launchpad and cruising at safe altitude.',
            completed: false,
          },
          {
            status: 'Out for Delivery',
            timestamp: 'Pending',
            description: 'In-flight en route to destination landing coordinates.',
            completed: false,
          },
          {
            status: 'Near Destination',
            timestamp: 'Pending',
            description: 'Drone enters terminal descent zone over customer coordinates.',
            completed: false,
          },
          {
            status: 'Arriving',
            timestamp: 'Pending',
            description: 'Precision sonar alignment over landing pad.',
            completed: false,
          },
          {
            status: 'Delivered',
            timestamp: 'Pending',
            description: 'Package safely released and customer OTP verified.',
            completed: false,
          },
        ],
      };

      const updatedOrders = [newOrder, ...orders];
      storage.set(storage.keys.ORDERS, updatedOrders);

      // Trigger automatic simulation progression
      setTimeout(() => {
        realtimeDeliveryService.startTrackingSimulation(newOrder, (newStatus) => {
          const currentOrders = storage.get<CustomerOrder[]>(storage.keys.ORDERS, updatedOrders);
          const idx = currentOrders.findIndex((o) => o.id === newId);
          if (idx !== -1) {
            currentOrders[idx].status = newStatus;
            currentOrders[idx].isCancellable = newStatus === 'Order Placed' || newStatus === 'Order Confirmed';
            storage.set(storage.keys.ORDERS, currentOrders);
          }
        });
      }, 2000);

      return newOrder;
    },

    cancel: async (orderId: string, reason: string): Promise<CustomerOrder> => {
      await delay(300);
      const orders = storage.get<CustomerOrder[]>(storage.keys.ORDERS, INITIAL_ORDERS);
      const index = orders.findIndex((o) => o.id === orderId);
      if (index === -1) throw new Error('Order not found.');

      if (!orders[index].isCancellable && orders[index].status !== 'Order Placed' && orders[index].status !== 'Order Confirmed' && orders[index].status !== 'Preparing') {
        throw new Error('This order cannot be cancelled as the delivery drone has already launched.');
      }

      realtimeDeliveryService.stopTrackingSimulation(orderId);

      orders[index].status = 'Cancelled';
      orders[index].isCancellable = false;
      orders[index].cancellationReason = reason;
      orders[index].paymentStatus = 'Refunded';
      orders[index].updatedAt = new Date().toISOString();

      storage.set(storage.keys.ORDERS, orders);
      return orders[index];
    },

    rate: async (orderId: string, stars: number, feedback?: string): Promise<CustomerOrder> => {
      await delay(250);
      const orders = storage.get<CustomerOrder[]>(storage.keys.ORDERS, INITIAL_ORDERS);
      const index = orders.findIndex((o) => o.id === orderId);
      if (index === -1) throw new Error('Order not found.');

      orders[index].rating = {
        stars,
        feedback,
        submittedAt: new Date().toISOString(),
      };
      storage.set(storage.keys.ORDERS, orders);
      return orders[index];
    },

    getActiveDelivery: async (): Promise<CustomerOrder | null> => {
      await delay(100);
      const orders = storage.get<CustomerOrder[]>(storage.keys.ORDERS, INITIAL_ORDERS);
      const active = orders.find(
        (o) =>
          o.status !== 'Delivered' &&
          o.status !== 'Cancelled' &&
          o.status !== 'Delivery Failed'
      );
      return active || null;
    },
  },

  notifications: {
    getAll: async (): Promise<CustomerNotification[]> => {
      await delay(150);
      return storage.get<CustomerNotification[]>(storage.keys.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    },

    markAsRead: async (id: string): Promise<void> => {
      const notifs = storage.get<CustomerNotification[]>(storage.keys.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
      const updated = notifs.map((n) => (n.id === id ? { ...n, read: true } : n));
      storage.set(storage.keys.NOTIFICATIONS, updated);
    },

    markAllAsRead: async (): Promise<void> => {
      const notifs = storage.get<CustomerNotification[]>(storage.keys.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
      const updated = notifs.map((n) => ({ ...n, read: true }));
      storage.set(storage.keys.NOTIFICATIONS, updated);
    },

    clearAll: async (): Promise<void> => {
      storage.set(storage.keys.NOTIFICATIONS, []);
    },
  },

  support: {
    getFaqs: async (): Promise<FAQItem[]> => {
      await delay(150);
      return INITIAL_FAQS;
    },

    getTickets: async (): Promise<SupportTicket[]> => {
      await delay(150);
      return storage.get<SupportTicket[]>(storage.keys.SUPPORT_TICKETS, INITIAL_TICKETS);
    },

    createTicket: async (data: {
      orderId?: string;
      category: SupportTicketCategory;
      subject: string;
      description: string;
      attachmentName?: string;
    }): Promise<SupportTicket> => {
      await delay(300);
      const tickets = storage.get<SupportTicket[]>(storage.keys.SUPPORT_TICKETS, INITIAL_TICKETS);
      const user = storage.get<CustomerUser>(storage.keys.AUTH_USER, INITIAL_USER);

      const newTicket: SupportTicket = {
        id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: user.id,
        orderId: data.orderId,
        category: data.category,
        subject: data.subject || `${data.category} inquiry`,
        description: data.description,
        status: 'Open',
        priority: data.category.includes('delayed') || data.category.includes('Damaged') ? 'High' : 'Medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachmentName: data.attachmentName,
        messages: [
          {
            id: `msg_${Date.now()}`,
            sender: 'customer',
            senderName: user.name,
            message: data.description,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const updated = [newTicket, ...tickets];
      storage.set(storage.keys.SUPPORT_TICKETS, updated);
      return newTicket;
    },
  },
};
