import { ApiClient } from '@skynav/api-client';
import { storage } from './storage';
import { CustomerUser, LoginPayload, RegisterPayload } from '../types/auth';
import { Product, ProductReview } from '../types/product';
import { CustomerAddress, AddressLabel, GeofenceCheckResult } from '../types/address';
import { CustomerOrder, CustomerOrderStatus } from '../types/order';
import { CustomerNotification } from '../types/notification';
import { FAQItem, SupportTicket, SupportTicketCategory } from '../types/support';
import { LiveTrackingState } from '../types/tracking';
import { NoFlyZone, DropZoneSafetyEvaluation } from '../types/airspace';

export const customerApiClient = new ApiClient({
  baseUrl: '',
  clientType: 'customer',
});

const API_BASE_URL = '/api';

/**
 * Dedicated error indicating API down / gateway failure (e.g. 502/503/504 or network outage)
 */
export class ApiDownError extends Error {
  public readonly isApiDown = true;
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 502) {
    super(message);
    this.name = 'ApiDownError';
    this.statusCode = statusCode;
  }
}

/**
 * Defensive array unwrapper:
 * Handles:
 * - Direct array: `[T, ...]`
 * - Paginated object: `{ orders: [T, ...], total: 10 }`, `{ products: [...] }`, `{ items: [...] }`
 * - Nested in NestJS data envelope: `{ success: true, data: { orders: [...] } }`
 * - Non-array or empty: returns `[]`
 */
export function ensureArray<T = any>(data: any, preferredKey?: string): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];

  if (typeof data === 'object') {
    const payload = data.success === true && data.data !== undefined ? data.data : data;
    if (Array.isArray(payload)) return payload as T[];

    if (payload && typeof payload === 'object') {
      if (preferredKey && Array.isArray(payload[preferredKey])) {
        return payload[preferredKey] as T[];
      }
      const candidates = [
        'orders',
        'products',
        'items',
        'drones',
        'deliveries',
        'addresses',
        'categories',
        'notifications',
        'reviews',
        'zones',
        'faqs',
        'tickets',
        'users',
      ];
      for (const key of candidates) {
        if (Array.isArray(payload[key])) {
          return payload[key] as T[];
        }
      }
    }
  }

  return [];
}

/**
 * Normalizes backend product summary/detail representations into the customer Product shape
 */
export function normalizeProduct(p: any): Product {
  if (!p) {
    return {
      id: 'prod-unknown',
      name: 'Unknown Product',
      category: 'Tech & Cables',
      description: '',
      price: 0,
      rating: 4.8,
      reviewCount: 0,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      isDroneEligible: true,
      maxPayloadKg: 2.5,
      estimatedDeliveryMins: 12,
      inStock: true,
      stockCount: 10,
      weightGrams: 500,
    };
  }

  const primaryImg =
    p.image ||
    p.primaryImageUrl ||
    p.thumbnailUrl ||
    (Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : (Array.isArray(p.images) && typeof p.images[0] === 'string' ? p.images[0] : null)) ||
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500';

  const imgList: string[] = Array.isArray(p.images)
    ? p.images.map((im: any) => (typeof im === 'string' ? im : im?.url || primaryImg))
    : [primaryImg];

  return {
    id: p.id || p.slug || 'prod-unknown',
    name: p.name || 'Autonomous Pod Product',
    slug: p.slug || p.id,
    brand: p.brand,
    sku: p.sku,
    category: (p.categoryName || p.category || 'Tech & Cables') as any,
    category_id: p.categoryId || p.category_id,
    subCategory: p.subCategory,
    description: p.description || '',
    shortDescription: p.shortDescription || p.description?.slice(0, 100) || '',
    tagline: p.tagline,
    price: Number(p.price ?? p.basePrice ?? 0),
    originalPrice: Number(p.originalPrice ?? (p.price ? p.price * 1.15 : 0)),
    discountPercent: Number(p.discountPercent ?? 0),
    currency: p.currency || 'INR',
    rating: Number(p.rating || 4.8),
    reviewCount: Number(p.reviewCount || p.reviewsCount || 24),
    image: primaryImg,
    thumbnailUrl: primaryImg,
    images: imgList,
    isDroneEligible: p.isDroneEligible !== false,
    maxPayloadKg: Number(p.maxPayloadKg || 2.5),
    estimatedDeliveryMins: Number(p.estimatedDeliveryMins || 12),
    inStock: p.isInStock !== undefined ? Boolean(p.isInStock) : (p.inStock !== false),
    stockCount: Number(p.stockCount ?? 25),
    stockStatus: p.stockStatus || 'IN_STOCK',
    badge: p.badge || (p.isInStock ? 'Fast Air ETA' : undefined),
    features: Array.isArray(p.features) ? p.features : ['Autonomous Drone Delivery Eligible', 'GPS Real-Time Tracking'],
    specifications: p.specifications,
    flightSpecs: p.flightSpecs,
    dimensions: p.dimensions,
    weight: p.weight,
    weightGrams: Number(p.weightGrams || p.weightG || 500),
  };
}

/**
 * Maps backend OrderStatus enum strings to customer frontend status labels
 */
export function mapOrderStatus(status: string | undefined): CustomerOrderStatus {
  switch (status) {
    case 'CREATED':
    case 'Order Placed':
      return 'Order Placed';
    case 'CONFIRMED':
    case 'Order Confirmed':
      return 'Order Confirmed';
    case 'PREPARING':
    case 'Preparing':
      return 'Preparing';
    case 'DISPATCHED':
    case 'Drone Assigned':
    case 'Drone Launched':
      return 'Drone Launched';
    case 'IN_TRANSIT':
    case 'Out for Delivery':
      return 'Out for Delivery';
    case 'DELIVERED':
    case 'Delivered':
      return 'Delivered';
    case 'CANCELLED':
    case 'Cancelled':
      return 'Cancelled';
    case 'FAILED':
    case 'Delivery Failed':
      return 'Delivery Failed';
    case 'Near Destination':
      return 'Near Destination';
    case 'Arriving':
      return 'Arriving';
    case 'Returning':
      return 'Returning';
    case 'Delayed':
      return 'Delayed';
    default:
      return 'Order Placed';
  }
}

/**
 * Normalizes backend CustomerAddress (or raw object) to frontend CustomerAddress model
 */
export function normalizeAddress(a: any): CustomerAddress {
  if (!a || typeof a !== 'object') {
    return {
      id: `addr-${Date.now()}`,
      customerId: '',
      name: 'Customer Address',
      label: 'Home',
      building: 'SkyNav Drop Zone',
      street: 'Kurumbapalayam Road',
      area: 'Coimbatore',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      postalCode: '641107',
      phone: '+91 98765 43210',
      isDefault: false,
      dropZoneType: 'Lawn',
      latitude: 11.1132,
      longitude: 77.0277,
    };
  }

  const rawLabel = String(a.label || a.recipientName || 'Home');
  const label: AddressLabel =
    rawLabel.toLowerCase().includes('office') || rawLabel.toLowerCase().includes('work')
      ? 'Office'
      : rawLabel.toLowerCase().includes('other')
      ? 'Other'
      : 'Home';

  const name = a.recipientName || a.name || 'Customer Address';
  const building = a.line1 || a.building || 'SkyNav Drop Zone';
  const street = a.line2 || a.street || 'Kurumbapalayam Road';
  const area = a.state || a.area || 'Coimbatore';
  const city = a.city || 'Coimbatore';
  const state = a.state || 'Tamil Nadu';
  const postalCode = a.postalCode || '641107';

  return {
    id: String(a.id || `addr-${Date.now()}`),
    customerId: String(a.userId || a.customerId || ''),
    name,
    label,
    building,
    street,
    area,
    city,
    state,
    postalCode,
    phone: a.phone || '+91 98765 43210',
    isDefault: Boolean(a.isDefault),
    dropZoneType: a.dropZoneType || 'Lawn',
    latitude: Number(a.latitude ?? a.lat ?? 11.1132),
    longitude: Number(a.longitude ?? a.lng ?? 77.0277),
  };
}

/**
 * Normalizes backend order summary/detail representations into the customer CustomerOrder shape
 */
export function normalizeOrder(o: any): CustomerOrder {
  if (!o) {
    return {
      id: 'ord-unknown',
      customerId: 'cust-unknown',
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      tax: 0,
      discount: 0,
      total: 0,
      paymentMethod: 'Credit Card',
      paymentStatus: 'Paid',
      status: 'Order Placed',
      deliverySpeed: 'express',
      deliveryAddress: {
        id: 'addr-default',
        customerId: 'cust-1',
        label: 'Home',
        name: 'Customer',
        phone: '+91 98765 43210',
        building: 'Tech Corridor Block 4',
        street: 'Kalapatti Main Road',
        area: 'Civil Aerodrome Post',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        postalCode: '641048',
        latitude: 11.1132,
        longitude: 77.0277,
        isDefault: true,
      },
      deliveryOtp: '301606',
      isCancellable: true,
      estimatedDeliveryTime: '15 mins',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
  }

  const shipping =
    typeof o.shippingAddress === 'string'
      ? (() => {
          try {
            return JSON.parse(o.shippingAddress);
          } catch {
            return {};
          }
        })()
      : (o.shippingAddress || o.deliveryAddress || {});

  const status = mapOrderStatus(o.status);
  const items = Array.isArray(o.items) && o.items.length > 0
    ? o.items.map((it: any) => ({
        id: it.id || it.productId || 'item-unknown',
        productId: it.productId || it.id,
        quantity: Number(it.quantity || 1),
        price: Number(it.unitPrice ?? it.price ?? 0),
        product: it.product
          ? normalizeProduct(it.product)
          : normalizeProduct({
              id: it.productId,
              name: it.productName || 'Package Pod Item',
              price: Number(it.unitPrice ?? it.price ?? 0),
              image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150',
            }),
      }))
    : [
        {
          id: `item-${o.id || 'default'}`,
          productId: 'prod-express',
          quantity: Number(o.itemCount || 1),
          price: Number(o.totalAmount || o.total || 0),
          product: normalizeProduct({
            id: 'prod-express',
            name: 'Autonomous Delivery Package',
            price: Number(o.totalAmount || o.total || 0),
            image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150',
          }),
        },
      ];

  const total = Number(o.totalAmount ?? o.total ?? 0);
  const subtotal = Number(o.subtotal ?? (total > 0 ? Math.round(total * 0.85) : 0));
  const deliveryFee = Number(o.deliveryFee ?? 49);
  const tax = Number(o.taxAmount ?? o.tax ?? (total > 0 ? Math.round(total * 0.1) : 0));
  const discount = Number(o.discountAmount ?? o.discount ?? 0);

  const timeline =
    Array.isArray(o.timeline) && o.timeline.length > 0
      ? o.timeline
      : [
          {
            status: 'Order Placed',
            timestamp: o.createdAt || 'Just now',
            description: 'Order confirmed and verified',
            completed: true,
          },
          {
            status: 'Preparing',
            timestamp: 'Hub fulfillment',
            description: 'Package packaged and safety-sealed',
            completed: ['Preparing', 'Drone Assigned', 'Drone Launched', 'Out for Delivery', 'Near Destination', 'Arriving', 'Delivered'].includes(status),
          },
          {
            status: 'Drone Launched',
            timestamp: 'Air corridor',
            description: 'Drone airborne on authorized corridor',
            completed: ['Drone Launched', 'Out for Delivery', 'Near Destination', 'Arriving', 'Delivered'].includes(status),
          },
          {
            status: 'Out for Delivery',
            timestamp: 'Air transit',
            description: 'Approaching designated drop zone',
            completed: ['Out for Delivery', 'Near Destination', 'Arriving', 'Delivered'].includes(status),
          },
          {
            status: 'Delivered',
            timestamp: o.completedAt || 'Pending',
            description: 'Handover code confirmed at drop point',
            completed: status === 'Delivered',
          },
        ];

  return {
    id: o.id || 'ord-unknown',
    customerId: o.userId || o.customerId || 'cust-1',
    items,
    subtotal,
    deliveryFee,
    tax,
    discount,
    total,
    paymentMethod: o.paymentMethod || 'Credit Card',
    paymentStatus: o.paymentStatus || 'Paid',
    status,
    deliverySpeed: o.deliverySpeed || 'express',
    scheduledTime: o.scheduledTime || o.deliverySlot,
    deliveryAddress: {
      id: shipping.id || o.addressId || 'addr-default',
      customerId: o.userId || 'cust-1',
      label: (['Home', 'Office', 'Other'].includes(shipping.label) ? shipping.label : 'Home') as any,
      name: shipping.name || shipping.recipientName || shipping.fullName || 'Customer',
      phone: shipping.phone || '+91 98765 43210',
      building: shipping.building || shipping.line1 || shipping.addressLine1 || 'Tech Corridor Block 4',
      street: shipping.street || shipping.line2 || shipping.addressLine2 || 'Kalapatti Main Road',
      area: shipping.area || 'Coimbatore Hub Zone',
      city: shipping.city || 'Coimbatore',
      state: shipping.state || 'Tamil Nadu',
      postalCode: shipping.postalCode || '641048',
      latitude: Number(shipping.latitude || 11.1132),
      longitude: Number(shipping.longitude || 77.0277),
      isDefault: true,
      dropZoneType: shipping.dropZoneType || o.dropZoneType || 'Lawn',
      clearanceRadiusMeters: shipping.clearanceRadiusMeters || 3.5,
      instructions: shipping.instructions || o.deliveryInstructions || '',
    },
    deliveryInstructions: o.deliveryInstructions || shipping.instructions,
    dropZoneType: o.dropZoneType || shipping.dropZoneType,
    deliveryOtp: o.deliveryOtp || o.verificationCode || '301606',
    isCancellable: ['Order Placed', 'Order Confirmed', 'Preparing'].includes(status),
    estimatedDeliveryTime: o.estimatedDeliveryTime || (status === 'Delivered' ? 'Completed' : '12 mins'),
    estimatedArrivalTimestamp: o.estimatedArrivalTimestamp,
    createdAt: o.createdAt || new Date().toISOString(),
    updatedAt: o.updatedAt || new Date().toISOString(),
    completedAt: o.completedAt,
    timeline,
    rating: o.rating,
    cancellationReason: o.cancellationReason || o.cancelReason,
  };
}

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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (_err: any) {
    throw new ApiDownError(
      'SkyNav delivery services are temporarily unreachable. Please check your connection or try again shortly.',
      502
    );
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new ApiDownError(
      `SkyNav delivery gateway is temporarily unavailable (${response.status}). Operations will resume automatically shortly.`,
      response.status
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error?.message || data.error || data.message || `Request failed with status ${response.status}`
    );
  }

  if (data && typeof data === 'object' && 'data' in data && data.success === true) {
    return data.data as T;
  }

  return data as T;
}

export function normalizeCart(res: any, itemMap?: Map<string, string>): any {
  const cart = res?.cart ?? res ?? {};

  if (Array.isArray(cart.items) && itemMap) {
    for (const it of cart.items) {
      if (it.id) {
        itemMap.set(it.id, it.id);
        if (it.productId) itemMap.set(it.productId, it.id);
        if (it.product?.id) itemMap.set(it.product.id, it.id);
      }
    }
  }

  return {
    id: cart.id || 'cart-current',
    items: Array.isArray(cart.items)
      ? cart.items.map((it: any) => {
          const product = it.product
            ? normalizeProduct(it.product)
            : normalizeProduct({
                id: it.productId || it.id,
                name: it.productName || 'Cart Item',
                price: Number(it.unitPrice ?? it.price ?? 0),
                image: it.imageUrl || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150',
                inStock: it.isInStock ?? true,
              });
          return {
            ...it,
            id: it.id,
            product,
            quantity: Number(it.quantity || 1),
          };
        })
      : [],
    itemCount: Number(
      cart.itemCount ??
        (Array.isArray(cart.items)
          ? cart.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0)
          : 0)
    ),
    subtotal: Number(cart.subtotal ?? 0),
    deliveryFee: Number(cart.deliveryFee ?? 0),
    tax: Number(cart.tax ?? cart.taxAmount ?? 0),
    discount: Number(cart.discount ?? cart.discountAmount ?? 0),
    total: Number(cart.total ?? cart.totalAmount ?? 0),
    appliedPromo: cart.appliedPromo ?? null,
  };
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
      try {
        const res = await request<any>('/addresses');
        const list = ensureArray<any>(res, 'addresses');
        return list.map(normalizeAddress);
      } catch {
        return [];
      }
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
      if (params?.category && params.category !== 'All') query.set('category', params.category);
      if (params?.search) query.set('q', params.search);
      if (params?.minPrice !== undefined) query.set('minPrice', params.minPrice.toString());
      if (params?.maxPrice !== undefined) query.set('maxPrice', params.maxPrice.toString());

      if (params?.sort) {
        if (params.sort === 'price-asc' || params.sort === 'price_asc') query.set('sort', 'price_asc');
        else if (params.sort === 'price-desc' || params.sort === 'price_desc') query.set('sort', 'price_desc');
        else if (params.sort === 'name-asc' || params.sort === 'name_asc') query.set('sort', 'name_asc');
        else if (params.sort === 'newest') query.set('sort', 'newest');
        else if (['popular', 'relevance', 'rating', 'speed'].includes(params.sort)) query.set('sort', 'relevance');
      }

      const qs = query.toString();
      const res = await request<any>(`/products${qs ? `?${qs}` : ''}`);
      let list = ensureArray(res, 'products').map(normalizeProduct);

      if (params?.droneOnly) {
        list = list.filter((p) => p.isDroneEligible);
      }
      if (params?.deals) {
        list = list.filter((p) => (p.discountPercent ?? 0) > 0);
      }
      if (params?.rating !== undefined) {
        list = list.filter((p) => p.rating >= (params.rating ?? 0));
      }
      if (params?.maxSpeed && params.maxSpeed > 0) {
        list = list.filter((p) => p.estimatedDeliveryMins <= params.maxSpeed!);
      }
      if (params?.sort === 'speed') {
        list.sort((a, b) => a.estimatedDeliveryMins - b.estimatedDeliveryMins);
      } else if (params?.sort === 'rating') {
        list.sort((a, b) => b.rating - a.rating);
      }
      return list;
    },

    getById: async (id: string): Promise<Product> => {
      const res = await request<any>(`/products/${id}`);
      const raw = res?.product ?? res;
      return normalizeProduct(raw);
    },

    getCategories: async (): Promise<any[]> => {
      const res = await request<any>('/categories');
      return ensureArray(res, 'categories');
    },

    getFeatured: async (): Promise<Product[]> => {
      const res = await request<any>('/products?sort=relevance&pageSize=6');
      const list = ensureArray(res, 'products');
      return list.map(normalizeProduct);
    },

    getDeals: async (): Promise<Product[]> => {
      const res = await request<any>('/products?sort=newest&pageSize=20');
      const list = ensureArray(res, 'products').map(normalizeProduct);
      return list.filter((p) => (p.discountPercent ?? 0) > 0);
    },

    getReviews: async (productId: string): Promise<ProductReview[]> => {
      const res = await request<any>(`/reviews/${productId}`);
      return ensureArray<ProductReview>(res, 'reviews');
    },

    submitReview: async (productId: string, data: { rating: number; title: string; comment: string; orderId?: string }): Promise<{ success: boolean }> => {
      return request<{ success: boolean }>(`/reviews/${productId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  // ── CART ──
  cart: (() => {
    const cachedCartItemMap = new Map<string, string>();

    return {
      get: async (promoCode?: string | null, speed?: string) => {
        const query = new URLSearchParams();
        if (promoCode) query.set('promo', promoCode);
        if (speed) query.set('speed', speed);
        const qs = query.toString();
        const res = await request<any>(`/cart${qs ? `?${qs}` : ''}`);
        return normalizeCart(res, cachedCartItemMap);
      },

      addItem: async (productId: string, quantity: number = 1) => {
        await request<any>('/cart/items', {
          method: 'POST',
          body: JSON.stringify({ productId, quantity }),
        });
        return api.cart.get();
      },

      updateQuantity: async (itemIdOrProductId: string, quantity: number) => {
        if (quantity < 1) {
          return api.cart.removeItem(itemIdOrProductId);
        }
        let resolvedItemId = cachedCartItemMap.get(itemIdOrProductId) || itemIdOrProductId;
        if (!cachedCartItemMap.has(itemIdOrProductId)) {
          await api.cart.get();
          resolvedItemId = cachedCartItemMap.get(itemIdOrProductId) || itemIdOrProductId;
        }
        await request<any>(`/cart/items/${resolvedItemId}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity }),
        });
        return api.cart.get();
      },

      removeItem: async (itemIdOrProductId: string) => {
        let resolvedItemId = cachedCartItemMap.get(itemIdOrProductId) || itemIdOrProductId;
        if (!cachedCartItemMap.has(itemIdOrProductId)) {
          await api.cart.get();
          resolvedItemId = cachedCartItemMap.get(itemIdOrProductId) || itemIdOrProductId;
        }
        await request<any>(`/cart/items/${resolvedItemId}`, {
          method: 'DELETE',
        });
        cachedCartItemMap.delete(itemIdOrProductId);
        cachedCartItemMap.delete(resolvedItemId);
        return api.cart.get();
      },

      clear: async () => {
        await request<any>('/cart', {
          method: 'DELETE',
        });
        cachedCartItemMap.clear();
        return api.cart.get();
      },

      applyPromo: async (code: string) => {
        return request<{ success: boolean; message: string; cart: any }>('/cart/promo', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
      },
    };
  })(),

  // ── WISHLIST ──
  wishlist: {
    get: async (): Promise<Product[]> => {
      const res = await request<any>('/wishlist');
      const list = ensureArray(res, 'items');
      return list.map((item: any) => {
        if (item && item.product) {
          return normalizeProduct({ ...item.product, id: item.productId || item.product.id });
        }
        return normalizeProduct(item);
      });
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
      const res = await request<any>('/orders');
      const list = ensureArray(res, 'orders');
      return list.map(normalizeOrder);
    },

    getById: async (id: string): Promise<CustomerOrder> => {
      const res = await request<any>(`/orders/${id}`);
      const raw = res?.order ?? res;
      return normalizeOrder(raw);
    },

    create: async (payload: any): Promise<CustomerOrder> => {
      const checkoutBody = {
        addressId: payload.addressId || payload.deliveryAddress?.id,
        deliverySlot: payload.deliverySlot || payload.scheduledTime,
        paymentMethod:
          typeof payload.paymentMethod === 'object' && payload.paymentMethod?.type
            ? payload.paymentMethod
            : { type: 'SIMULATED' },
        latitude: payload.deliveryAddress?.latitude ?? payload.latitude,
        longitude: payload.deliveryAddress?.longitude ?? payload.longitude,
        clearanceRadiusMeters: payload.deliveryAddress?.clearanceRadiusMeters ?? payload.clearanceRadiusMeters,
      };
      const res = await request<any>('/checkout/orders', {
        method: 'POST',
        body: JSON.stringify(checkoutBody),
      });
      const raw = res?.order ?? res;
      return normalizeOrder({ ...raw, ...payload });
    },

    cancel: async (orderId: string, reason?: string): Promise<CustomerOrder> => {
      const res = await request<any>(`/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      const raw = res?.order ?? res;
      return normalizeOrder(raw);
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
      const res = await request<any>('/airspace/zones');
      return {
        zones: ensureArray(res?.zones ?? res, 'zones'),
        hubs: ensureArray(res?.hubs, 'hubs'),
        metadata: res?.metadata || {},
      };
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
      try {
        const res = await request<any>(`/tracking/${orderId}`);
        if (res && res.orderId) return res as LiveTrackingState;
      } catch {
        // Fallback to delivery by order
        try {
          const delivery = await request<any>(`/deliveries/by-order/${orderId}`);
          if (delivery?.id) {
            const tracking = await request<any>(`/deliveries/${delivery.id}/tracking`);
            if (tracking) {
              return {
                orderId,
                orderStatus: mapOrderStatus(delivery.status),
                hubLocation: {
                  name: delivery.hub?.name || 'SkyHub Kurumbapalayam',
                  latitude: delivery.hub?.lat || 11.1132,
                  longitude: delivery.hub?.lng || 77.0277,
                },
                destinationLocation: {
                  latitude: Number(delivery.dropLat || 11.1132),
                  longitude: Number(delivery.dropLng || 77.0277),
                  address: delivery.dropAddress || 'Customer Destination',
                },
                currentDroneLocation: {
                  latitude: tracking.currentLat ?? 11.1132,
                  longitude: tracking.currentLng ?? 77.0277,
                  altitudeMeters: tracking.altitudeMeters ?? 45,
                  speedKmh: tracking.speedMps ? Math.round(tracking.speedMps * 3.6) : 48,
                  bearing: tracking.headingDeg ?? 0,
                },
                flightRoute: Array.isArray(tracking.corridorWaypoints)
                  ? tracking.corridorWaypoints
                  : [
                      [11.1132, 77.0277],
                      [Number(delivery.dropLat || 11.1132), Number(delivery.dropLng || 77.0277)],
                    ],
                remainingDistanceKm: Number(tracking.remainingDistanceKm ?? 2.5),
                estimatedArrivalMins: Number(tracking.etaMinutes ?? 8),
                estimatedArrivalFormatted: `${Number(tracking.etaMinutes ?? 8)} mins`,
                droneAssignedName: tracking.drone?.name || 'SkyNav Drone',
                connectionStatus: 'connected',
                lastUpdated: new Date().toISOString(),
                isCompleted: delivery.status === 'DELIVERED',
                handoverOtp: delivery.verificationCode || '301606',
              };
            }
          }
        } catch {
          // Handled by TrackingPage fallback
        }
      }
      throw new Error('Tracking snapshot not available');
    },
  },

  // ── NOTIFICATIONS ──
  notifications: {
    getAll: async (): Promise<CustomerNotification[]> => {
      return [];
    },

    markAsRead: async (_id: string): Promise<void> => {},

    markAllAsRead: async (): Promise<void> => {},

    clear: async (_id: string): Promise<void> => {},
  },

  // ── SUPPORT & FAQS ──
  support: {
    getFaqs: async (): Promise<FAQItem[]> => {
      const defaultFaqs: FAQItem[] = [
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

      return defaultFaqs;
    },

    getTickets: async (): Promise<SupportTicket[]> => {
      return [];
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

if (typeof window !== 'undefined') {
  (window as any).api = api;
}
