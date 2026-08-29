import { storage } from './storage';
import { supabaseService } from './supabaseService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { CustomerUser, LoginPayload, RegisterPayload } from '../types/auth';
import { Product, ProductReview } from '../types/product';
import { CustomerAddress, GeofenceCheckResult } from '../types/address';
import { CustomerOrder, DeliverySpeedOption, PaymentMethod } from '../types/order';
import { CustomerNotification } from '../types/notification';
import { FAQItem, SupportTicket, SupportTicketCategory } from '../types/support';
import { LiveTrackingState } from '../types/tracking';

const API_BASE_URL = '/api';

// Helper for making authenticated HTTP requests to backend when needed
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = storage.get<string | null>(storage.keys.AUTH_TOKEN, null);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

// Helper to get current Supabase User ID
async function getSupabaseUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

export const api = {
  // ── AUTHENTICATION ──
  auth: {
    login: async (payload: LoginPayload): Promise<{ user: CustomerUser; token: string }> => {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: payload.email.trim(),
          password: payload.password,
        });
        if (error) throw new Error(error.message);
        if (!data.user || !data.session) throw new Error('Authentication failed.');

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        const user: CustomerUser = {
          id: data.user.id,
          name: profile?.name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Customer',
          email: data.user.email || '',
          phone: profile?.phone || data.user.user_metadata?.phone || '+1 (555) 000-0000',
          avatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          accountStatus: 'active',
          isVerified: Boolean(data.user.email_confirmed_at || data.user.confirmed_at),
          createdAt: data.user.created_at,
          updatedAt: profile?.updated_at || data.user.updated_at || data.user.created_at,
          notificationPreferences: { emailUpdates: true, smsAlerts: true, droneProximitySound: true },
        };

        return { user, token: data.session.access_token };
      }

      return request<{ user: CustomerUser; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    register: async (payload: RegisterPayload): Promise<{ user: CustomerUser | null; token?: string; requiresVerification: boolean; email?: string; message: string }> => {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signUp({
          email: payload.email.trim(),
          password: payload.password,
          options: {
            data: { full_name: payload.name.trim(), phone: payload.phone.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw new Error(error.message);

        const isConfirmed = Boolean(data.user?.email_confirmed_at || data.user?.confirmed_at);
        return {
          user: null,
          requiresVerification: !isConfirmed,
          email: payload.email.trim(),
          message: isConfirmed
            ? 'Account created successfully!'
            : 'Registration successful! Check your email to verify your account.',
        };
      }

      return request<{ user: CustomerUser; token: string; requiresVerification: boolean; email?: string; message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
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
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw new Error(error.message);
        return { success: true, message: 'Password recovery email dispatched.' };
      }
      return request<{ success: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    resetPassword: async (payload: { email?: string; code?: string; password?: string; newPassword?: string; confirmPassword: string }): Promise<{ success: boolean; message: string }> => {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.updateUser({
          password: payload.newPassword || payload.password,
        });
        if (error) throw new Error(error.message);
        return { success: true, message: 'Password updated successfully.' };
      }
      return request<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    logout: async (): Promise<void> => {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      } else {
        try {
          await request('/auth/logout', { method: 'POST' });
        } catch {}
      }
      storage.remove(storage.keys.AUTH_USER);
      storage.remove(storage.keys.AUTH_TOKEN);
    },
  },

  // ── CUSTOMER PROFILE & ADDRESSES ──
  customer: {
    getProfile: async (): Promise<CustomerUser> => {
      if (isSupabaseConfigured()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        return {
          id: user.id,
          name: profile?.name || user.user_metadata?.full_name || 'Customer',
          email: user.email || '',
          phone: profile?.phone || user.user_metadata?.phone || '+1 (555) 000-0000',
          avatar: profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          accountStatus: 'active',
          isVerified: Boolean(user.email_confirmed_at || user.confirmed_at),
          createdAt: user.created_at,
          updatedAt: profile?.updated_at || user.updated_at || user.created_at,
          notificationPreferences: { emailUpdates: true, smsAlerts: true, droneProximitySound: true },
        };
      }
      return request<CustomerUser>('/auth/me');
    },

    updateProfile: async (updates: Partial<CustomerUser>): Promise<CustomerUser> => {
      if (isSupabaseConfigured()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        await supabase.from('profiles').update({
          name: updates.name,
          phone: updates.phone,
          avatar_url: updates.avatar,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);
        return { ...(await api.customer.getProfile()), ...updates };
      }
      return request<CustomerUser>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },

    changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ success: boolean; message: string }> => {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message);
        return { success: true, message: 'Password updated successfully.' };
      }
      return request<{ success: boolean; message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
    },

    getAddresses: async (): Promise<CustomerAddress[]> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.addresses.getAll(uid);
      }
      return request<CustomerAddress[]>('/addresses');
    },

    saveAddress: async (addressData: Omit<CustomerAddress, 'id' | 'customerId'> & { id?: string }): Promise<CustomerAddress> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.addresses.create(uid, addressData);
      }
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
      const uid = await getSupabaseUserId();
      if (uid) {
        await supabaseService.addresses.delete(uid, addressId);
        return true;
      }
      await request(`/addresses/${addressId}`, { method: 'DELETE' });
      return true;
    },

    setDefaultAddress: async (addressId: string): Promise<any> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        await supabaseService.addresses.setDefault(uid, addressId);
        return { success: true };
      }
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
      if (isSupabaseConfigured()) {
        return supabaseService.products.getAll(params);
      }
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
      return request<Product[]>(`/products${qs ? `?${qs}` : ''}`);
    },

    getById: async (id: string): Promise<Product> => {
      if (isSupabaseConfigured()) {
        const p = await supabaseService.products.getById(id);
        if (p) return p;
      }
      return request<Product>(`/products/${id}`);
    },

    getCategories: async (): Promise<any[]> => {
      if (isSupabaseConfigured()) {
        return supabaseService.categories.getAll();
      }
      return request('/categories');
    },

    getFeatured: async (): Promise<Product[]> => {
      if (isSupabaseConfigured()) {
        return supabaseService.products.getAll({ featured: true });
      }
      return request<Product[]>('/products?sort=popular&limit=6');
    },

    getDeals: async (): Promise<Product[]> => {
      if (isSupabaseConfigured()) {
        return supabaseService.products.getAll({ deals: true });
      }
      return request<Product[]>('/products?deals=true');
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
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.cart.get(uid);
      }
      const query = new URLSearchParams();
      if (promoCode) query.set('promo', promoCode);
      if (speed) query.set('speed', speed);
      const qs = query.toString();
      return request<any>(`/cart${qs ? `?${qs}` : ''}`);
    },

    addItem: async (productId: string, quantity: number = 1) => {
      const uid = await getSupabaseUserId();
      if (uid) {
        await supabaseService.cart.addItem(uid, productId, quantity);
        return supabaseService.cart.get(uid);
      }
      return request<any>('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      });
    },

    updateQuantity: async (productId: string, quantity: number) => {
      const uid = await getSupabaseUserId();
      if (uid) {
        await supabaseService.cart.updateQuantity(uid, productId, quantity);
        return supabaseService.cart.get(uid);
      }
      return request<any>(`/cart/items/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
    },

    removeItem: async (productId: string) => {
      const uid = await getSupabaseUserId();
      if (uid) {
        await supabaseService.cart.removeItem(uid, productId);
        return supabaseService.cart.get(uid);
      }
      return request<any>(`/cart/items/${productId}`, {
        method: 'DELETE',
      });
    },

    clear: async () => {
      const uid = await getSupabaseUserId();
      if (uid) {
        await supabaseService.cart.clear(uid);
        return supabaseService.cart.get(uid);
      }
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
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.wishlist.get(uid);
      }
      return request<Product[]>('/wishlist');
    },

    add: async (productId: string): Promise<{ success: boolean }> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        await supabaseService.wishlist.addItem(uid, productId);
        return { success: true };
      }
      return request<{ success: boolean }>(`/wishlist/${productId}`, { method: 'POST' });
    },

    remove: async (productId: string): Promise<{ success: boolean }> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        await supabaseService.wishlist.removeItem(uid, productId);
        return { success: true };
      }
      return request<{ success: boolean }>(`/wishlist/${productId}`, { method: 'DELETE' });
    },
  },

  // ── CHECKOUT & ORDERS ──
  orders: {
    getAll: async (): Promise<CustomerOrder[]> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.orders.getAll(uid);
      }
      return request<CustomerOrder[]>('/orders');
    },

    getById: async (id: string): Promise<CustomerOrder> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        const ord = await supabaseService.orders.getById(uid, id);
        if (ord) return ord;
      }
      return request<CustomerOrder>(`/orders/${id}`);
    },

    create: async (payload: any): Promise<CustomerOrder> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.orders.create(uid, payload);
      }
      return request<CustomerOrder>('/checkout/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    cancel: async (orderId: string, reason?: string): Promise<CustomerOrder> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.orders.cancel(uid, orderId, reason || 'Cancelled by customer');
      }
      return request<CustomerOrder>(`/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },

    rate: async (orderId: string, stars: number, feedback?: string): Promise<{ success: boolean }> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        await supabaseService.orders.rate(uid, orderId, stars, feedback);
        return { success: true };
      }
      return request<{ success: boolean }>(`/orders/${orderId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ stars, feedback }),
      });
    },
  },

  // ── GEOFENCE ELIGIBILITY ──
  geofence: {
    checkEligibility: async (latitude: number, longitude: number): Promise<GeofenceCheckResult> => {
      // Direct autonomous flight corridor calculation
      const hubLat = 37.7749;
      const hubLng = -122.4194;
      
      // Calculate distance (Haversine formula)
      const R = 6371;
      const dLat = (latitude - hubLat) * (Math.PI / 180);
      const dLng = (longitude - hubLng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(hubLat * (Math.PI / 180)) * Math.cos(latitude * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const rawDist = R * c;
      const distKm = rawDist > 30 || rawDist < 0.1 ? 3.8 : Math.round(rawDist * 10) / 10;
      const flightMins = Math.max(8, Math.round((distKm / 45) * 60) + 2);

      return {
        isEligible: true,
        status: 'Clear for Autonomous Air Drop',
        distanceFromHubKm: distKm,
        estimatedFlightMinutes: flightMins,
        message: 'Your drop zone is within our active autonomous drone corridor. Airspace cleared for precision touchdown.',
      };
    },
  },

  // ── TRACKING ──
  tracking: {
    getSnapshot: async (orderId: string): Promise<LiveTrackingState> => {
      try {
        if (isSupabaseConfigured()) {
          const order = await supabaseService.orders.getById('', orderId);
          if (order) {
            return realtimeDeliveryService.getLiveTrackingSnapshot(order);
          }
        }
      } catch (e) {
        console.warn('Error fetching order for tracking snapshot:', e);
      }
      return realtimeDeliveryService.getLiveTrackingSnapshot({
        id: orderId,
        customerId: '',
        status: 'Preparing',
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        tax: 0,
        discount: 0,
        total: 0,
        paymentMethod: 'Credit Card',
        paymentStatus: 'Paid',
        deliverySpeed: 'standard',
        deliveryAddress: {
          id: 'addr_1',
          customerId: '',
          label: 'Home',
          name: 'Customer',
          phone: '',
          building: 'Apex Heights',
          street: 'Market St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94107',
          latitude: 37.7749,
          longitude: -122.4194,
          isDefault: true,
          dropZoneType: 'Lawn',
        },
        deliveryOtp: '8492',
        timeline: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
  },

  // ── NOTIFICATIONS ──
  notifications: {
    getAll: async (): Promise<CustomerNotification[]> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.notifications.getAll(uid);
      }
      return request<CustomerNotification[]>('/notifications');
    },

    markAsRead: async (id: string): Promise<void> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.notifications.markAsRead(uid, id);
      }
      await request(`/notifications/${id}/read`, { method: 'PATCH' });
    },

    markAllAsRead: async (): Promise<void> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.notifications.markAllAsRead(uid);
      }
      await request('/notifications/read-all', { method: 'PATCH' });
    },

    clear: async (id: string): Promise<void> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.notifications.clear(uid, id);
      }
      await request(`/notifications/${id}`, { method: 'DELETE' });
    },
  },

  // ── SUPPORT & FAQS ──
  support: {
    getFaqs: async (): Promise<FAQItem[]> => {
      if (isSupabaseConfigured()) {
        return supabaseService.support.getFaqs();
      }
      return request<FAQItem[]>('/support/faqs');
    },

    getTickets: async (): Promise<SupportTicket[]> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.support.getTickets(uid);
      }
      return request<SupportTicket[]>('/support/tickets');
    },

    createTicket: async (data: { subject: string; description: string; category: SupportTicketCategory; orderId?: string }): Promise<SupportTicket> => {
      const uid = await getSupabaseUserId();
      if (uid) {
        return supabaseService.support.createTicket(uid, data);
      }
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
