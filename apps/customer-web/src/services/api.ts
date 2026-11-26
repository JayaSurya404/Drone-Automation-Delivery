import { ApiClient } from '@skynav/api-client';
import { storage } from './storage';
import { CustomerUser, LoginPayload, RegisterPayload } from '../types/auth';
import { Product, ProductReview } from '../types/product';
import { CustomerAddress, GeofenceCheckResult } from '../types/address';
import { CustomerOrder } from '../types/order';
import { CustomerNotification } from '../types/notification';
import { FAQItem, SupportTicket, SupportTicketCategory } from '../types/support';
import { LiveTrackingState } from '../types/tracking';
import { NoFlyZone, DropZoneSafetyEvaluation } from '../types/airspace';

export const customerApiClient = new ApiClient({
  baseUrl: '',
  clientType: 'customer',
});

const API_BASE_URL = '/api';

// Helper for making authenticated HTTP requests to backend when needed
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = customerApiClient.getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-app': 'customer',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    const cleanToken = typeof token === 'string' ? token.replace(/^"+|"+$/g, '') : token;
    headers['Authorization'] = `Bearer ${cleanToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || data.error || data.message || `Request failed with status ${response.status}`);
  }

  if (data && typeof data === 'object' && 'data' in data && data.success === true) {
    return data.data as T;
  }

  return data as T;
}

export const api = {
  // ── AUTHENTICATION ──
  auth: {
    login: async (payload: LoginPayload): Promise<{ user: CustomerUser; token: string }> => {
      const res = await customerApiClient.login({
        email: payload.email.trim(),
        password: payload.password,
      });

      const u = res.user;
      const user: CustomerUser = {
        id: u.id,
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email.split('@')[0],
        email: u.email,
        phone: '+91 98765 43210',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        accountStatus: 'active',
        isVerified: u.isEmailVerified,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notificationPreferences: { emailUpdates: true, smsAlerts: true, droneProximitySound: true },
      };

      return { user, token: res.accessToken };
    },

    getProfile: async (): Promise<CustomerUser> => {
      return request<CustomerUser>('/auth/me');
    },

    register: async (payload: RegisterPayload): Promise<{ user: CustomerUser | null; token?: string; requiresVerification: boolean; email?: string; message: string; deliveryPin?: string }> => {
      const res = await customerApiClient.register({
        email: payload.email.trim(),
        password: payload.password,
        firstName: payload.name.trim().split(' ')[0] || 'Customer',
        lastName: payload.name.trim().split(' ').slice(1).join(' ') || undefined,
      });

      const u = res.user;
      const user: CustomerUser = {
        id: u.id,
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email.split('@')[0],
        email: u.email,
        phone: payload.phone || '+91 98765 43210',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        accountStatus: 'active',
        isVerified: u.isEmailVerified,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notificationPreferences: { emailUpdates: true, smsAlerts: true, droneProximitySound: true },
      };

      return {
        user,
        token: res.accessToken,
        requiresVerification: !u.isEmailVerified,
        email: u.email,
        message: 'Account created successfully!',
      };
    },

    verifyAccount: async (payload: { code: string; email?: string }): Promise<{ success: boolean; user: CustomerUser; token: string; message: string }> => {
      return request<{ success: boolean; user: CustomerUser; token: string; message: string }>('/auth/verify-account', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    resendVerification: async (payload: { email?: string }): Promise<{ success: boolean; message: string }> => {
      return request<{ success: boolean; message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    forgotPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
      return request<{ success: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    resetPassword: async (payload: { email?: string; code?: string; password?: string; newPassword?: string; confirmPassword: string }): Promise<{ success: boolean; message: string }> => {
      return request<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    logout: async (): Promise<void> => {
      try {
        await customerApiClient.logout();
      } catch {
        // Ignore logout network errors
      }
      storage.remove(storage.keys.AUTH_USER);
      storage.remove(storage.keys.AUTH_TOKEN);
    },
  },

  // ── CUSTOMER PROFILE & ADDRESSES ──
  customer: {
    getProfile: async (): Promise<CustomerUser> => {
      return request<CustomerUser>('/auth/me');
    },

    updateProfile: async (updates: Partial<CustomerUser>): Promise<CustomerUser> => {
      return request<CustomerUser>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },

    changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ success: boolean; message: string }> => {
      return request<{ success: boolean; message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
    },

    updateDeliveryPin: async (deliveryPin: string): Promise<{ success: boolean; message: string }> => {
      return request<{ success: boolean; message: string }>('/auth/delivery-pin', {
        method: 'PUT',
        body: JSON.stringify({ deliveryPin }),
      });
    },

    getAddresses: async (): Promise<CustomerAddress[]> => {
      return request<CustomerAddress[]>('/addresses');
    },

    saveAddress: async (addressData: Omit<CustomerAddress, 'id' | 'customerId'> & { id?: string }): Promise<CustomerAddress> => {
      if (addressData.id) {
        return request<CustomerAddress>(`/addresses/${addressData.id}`, {
          method: 'PUT',
          body: JSON.stringify(addressData),
        });
      }
      return request<CustomerAddress>('/addresses', {
        method: 'POST',
        body: JSON.stringify(addressData),
      });
    },

    deleteAddress: async (addressId: string): Promise<boolean> => {
      await request(`/addresses/${addressId}`, { method: 'DELETE' });
      return true;
    },

    setDefaultAddress: async (addressId: string): Promise<any> => {
      return request<CustomerAddress>(`/addresses/${addressId}/default`, { method: 'PATCH' });
    },
  },

  // ── PRODUCTS & CATEGORIES ──
  products: {
    getAll: async (params?: {
      category?: string;
      search?: string;
      minPrice?: number;
      maxPrice?: number;
      rating?: number;
      droneOnly?: boolean;
      deals?: boolean;
      sort?: string;
      maxSpeed?: number;
    }): Promise<Product[]> => {
      const query = new URLSearchParams();
      if (params?.category) query.set('category', params.category);
      if (params?.search) query.set('search', params.search);
      if (params?.minPrice !== undefined) query.set('minPrice', params.minPrice.toString());
      if (params?.maxPrice !== undefined) query.set('maxPrice', params.maxPrice.toString());
      if (params?.rating !== undefined) query.set('rating', params.rating.toString());
      if (params?.droneOnly) query.set('droneOnly', 'true');
      if (params?.deals) query.set('deals', 'true');
      if (params?.sort) query.set('sort', params.sort);

      const qs = query.toString();
      const res = await request<any>(`/products${qs ? `?${qs}` : ''}`);
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.products)) return res.products;
      if (res && Array.isArray(res.items)) return res.items;
      return [];
    },

    getById: async (id: string): Promise<Product> => {
      return request<Product>(`/products/${id}`);
    },

    getCategories: async (): Promise<any[]> => {
      return request('/categories');
    },

    getFeatured: async (): Promise<Product[]> => {
      const res = await request<any>('/products?sort=popular&limit=6');
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.products)) return res.products;
      return [];
    },

    getDeals: async (): Promise<Product[]> => {
      const res = await request<any>('/products?deals=true');
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.products)) return res.products;
      return [];
    },

    getReviews: async (productId: string): Promise<ProductReview[]> => {
      return request<ProductReview[]>(`/reviews/${productId}`);
    },

    submitReview: async (productId: string, data: { rating: number; title: string; comment: string; orderId?: string }): Promise<{ success: boolean }> => {
      return request<{ success: boolean }>(`/reviews/${productId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  // ── CART ──
  cart: {
    get: async (promoCode?: string | null, speed?: string) => {
      const query = new URLSearchParams();
      if (promoCode) query.set('promo', promoCode);
      if (speed) query.set('speed', speed);
      const qs = query.toString();
      return request<any>(`/cart${qs ? `?${qs}` : ''}`);
    },

    addItem: async (productId: string, quantity: number = 1) => {
      return request<any>('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      });
    },

    updateQuantity: async (productId: string, quantity: number) => {
      return request<any>(`/cart/items/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
    },

    removeItem: async (productId: string) => {
      return request<any>(`/cart/items/${productId}`, {
        method: 'DELETE',
      });
    },

    clear: async () => {
      return request<any>('/cart', {
        method: 'DELETE',
      });
    },

    applyPromo: async (code: string) => {
      return request<{ success: boolean; message: string; cart: any }>('/cart/promo', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },
  },

  // ── WISHLIST ──
  wishlist: {
    get: async (): Promise<Product[]> => {
      return request<Product[]>('/wishlist');
    },

    add: async (productId: string): Promise<{ success: boolean }> => {
      return request<{ success: boolean }>(`/wishlist/${productId}`, { method: 'POST' });
    },

    remove: async (productId: string): Promise<{ success: boolean }> => {
      return request<{ success: boolean }>(`/wishlist/${productId}`, { method: 'DELETE' });
    },
  },

  // ── CHECKOUT & ORDERS ──
  orders: {
    getAll: async (): Promise<CustomerOrder[]> => {
      return request<CustomerOrder[]>('/orders');
    },

    getById: async (id: string): Promise<CustomerOrder> => {
      return request<CustomerOrder>(`/orders/${id}`);
    },

    create: async (payload: any): Promise<CustomerOrder> => {
      return request<CustomerOrder>('/checkout/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    cancel: async (orderId: string, reason?: string): Promise<CustomerOrder> => {
      return request<CustomerOrder>(`/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },

    rate: async (orderId: string, stars: number, feedback?: string): Promise<{ success: boolean }> => {
      return request<{ success: boolean }>(`/orders/${orderId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ stars, feedback }),
      });
    },

    verifyPin: async (orderId: string, deliveryPin: string): Promise<{ success: boolean; message: string; status: string }> => {
      return request<{ success: boolean; message: string; status: string }>(`/orders/${orderId}/verify-pin`, {
        method: 'POST',
        body: JSON.stringify({ deliveryPin }),
      });
    },

    verifyOtp: async (orderId: string, otp: string): Promise<{ success: boolean; message: string; status: string }> => {
      return request<{ success: boolean; message: string; status: string }>(`/orders/${orderId}/verify-pin`, {
        method: 'POST',
        body: JSON.stringify({ deliveryPin: otp }),
      });
    },
  },

  // ── AIRSPACE & NO-FLY ZONES ──
  airspace: {
    getZones: async (): Promise<{ zones: NoFlyZone[]; hubs: any[]; metadata: any }> => {
      return request<{ zones: NoFlyZone[]; hubs: any[]; metadata: any }>('/airspace/zones');
    },

    validate: async (latitude: number, longitude: number, clearanceRadiusMeters: number = 3.5): Promise<DropZoneSafetyEvaluation> => {
      return request<DropZoneSafetyEvaluation>('/airspace/validate', {
        method: 'POST',
        body: JSON.stringify({ latitude, longitude, clearanceRadiusMeters }),
      });
    },
  },

  // ── GEOFENCE ELIGIBILITY ──
  geofence: {
    checkEligibility: async (latitude: number, longitude: number, clearanceRadiusMeters: number = 3.5): Promise<GeofenceCheckResult> => {
      return request<GeofenceCheckResult>('/checkout/eligibility', {
        method: 'POST',
        body: JSON.stringify({ latitude, longitude, clearanceRadiusMeters }),
      });
    },
  },

  // ── TRACKING ──
  tracking: {
    getSnapshot: async (orderId: string): Promise<LiveTrackingState> => {
      return request<LiveTrackingState>(`/tracking/${orderId}`);
    },
  },

  // ── NOTIFICATIONS ──
  notifications: {
    getAll: async (): Promise<CustomerNotification[]> => {
      return request<CustomerNotification[]>('/notifications');
    },

    markAsRead: async (id: string): Promise<void> => {
      await request(`/notifications/${id}/read`, { method: 'PATCH' });
    },

    markAllAsRead: async (): Promise<void> => {
      await request('/notifications/read-all', { method: 'PATCH' });
    },

    clear: async (id: string): Promise<void> => {
      await request(`/notifications/${id}`, { method: 'DELETE' });
    },
  },

  // ── SUPPORT & FAQS ──
  support: {
    getFaqs: async (): Promise<FAQItem[]> => {
      try {
        const res = await request<any>('/support/faqs');
        if (Array.isArray(res)) return res;
        if (res && Array.isArray(res.faqs)) return res.faqs;
        return [];
      } catch {
        return [
          {
            id: 'faq-1',
            question: 'How fast is autonomous drone delivery?',
            answer: 'Deliveries within Coimbatore hub operational corridors typically arrive within 10 to 25 minutes of order dispatch.',
            category: 'Drone Delivery',
          },
          {
            id: 'faq-2',
            question: 'What is the return-home battery safety margin?',
            answer: 'Every SkyNav drone enforces a mandatory 20% battery reserve returning to base. Missions are evaluated before takeoff.',
            category: 'Safety & Drop-off',
          },
          {
            id: 'faq-3',
            question: 'How do I accept delivery of my package?',
            answer: 'When the drone reaches your designated drop zone, provide your 6-digit delivery OTP or scan the secure delivery QR code.',
            category: 'Orders & Tracking',
          },
        ];
      }
    },

    getTickets: async (): Promise<SupportTicket[]> => {
      return request<SupportTicket[]>('/support/tickets');
    },

    createTicket: async (data: { subject: string; description: string; category: SupportTicketCategory; orderId?: string }): Promise<SupportTicket> => {
      return request<SupportTicket>('/support/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    addMessage: async (ticketId: string, message: string): Promise<void> => {
      await request(`/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    },
  },
};
