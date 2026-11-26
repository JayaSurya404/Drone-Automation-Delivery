import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureArray,
  normalizeProduct,
  normalizeOrder,
  normalizeAddress,
  normalizeCart,
  mapOrderStatus,
  ApiDownError,
} from './api';
import { extractData } from '../../../admin-web/src/services/mockDataStore';

describe('API Response Unwrapping & Normalization', () => {
  describe('ensureArray', () => {
    it('returns empty array on null or undefined or primitives', () => {
      assert.deepEqual(ensureArray(null), []);
      assert.deepEqual(ensureArray(undefined), []);
      assert.deepEqual(ensureArray(123), []);
      assert.deepEqual(ensureArray('string'), []);
      assert.deepEqual(ensureArray({}), []);
    });

    it('returns original array when input is already an array', () => {
      const input = [{ id: '1' }, { id: '2' }];
      assert.deepEqual(ensureArray(input), input);
    });

    it('unwraps raw paginated object with orders key', () => {
      const input = {
        orders: [{ id: 'ord-1' }, { id: 'ord-2' }],
        total: 2,
        page: 1,
        pageSize: 20,
      };
      assert.deepEqual(ensureArray(input, 'orders'), [{ id: 'ord-1' }, { id: 'ord-2' }]);
    });

    it('unwraps raw paginated object with products key', () => {
      const input = {
        products: [{ id: 'prod-1', name: 'GaN Charger' }],
        total: 1,
      };
      assert.deepEqual(ensureArray(input), [{ id: 'prod-1', name: 'GaN Charger' }]);
    });

    it('unwraps NestJS data envelope wrapping paginated orders', () => {
      const input = {
        success: true,
        data: {
          orders: [{ id: 'ord-100', totalAmount: '1299.00' }],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      };
      assert.deepEqual(ensureArray(input, 'orders'), [{ id: 'ord-100', totalAmount: '1299.00' }]);
    });

    it('unwraps NestJS data envelope wrapping direct array', () => {
      const input = {
        success: true,
        data: [{ id: 'cat-1', name: 'Electronics' }],
      };
      assert.deepEqual(ensureArray(input), [{ id: 'cat-1', name: 'Electronics' }]);
    });

    it('respects preferredKey over generic candidate order', () => {
      const input = {
        items: [{ id: 'generic-item' }],
        orders: [{ id: 'specific-order' }],
      };
      assert.deepEqual(ensureArray(input, 'orders'), [{ id: 'specific-order' }]);
      assert.deepEqual(ensureArray(input, 'items'), [{ id: 'generic-item' }]);
    });
  });

  describe('normalizeProduct', () => {
    it('handles null/undefined gracefully', () => {
      const result = normalizeProduct(null);
      assert.equal(result.id, 'prod-unknown');
      assert.equal(result.price, 0);
      assert.equal(result.inStock, true);
    });

    it('maps NestJS ProductSummaryView fields to Customer Web Product shape', () => {
      const summaryView = {
        id: 'prod-123',
        name: 'Coimbatore Drone Pod',
        slug: 'cbe-drone-pod',
        description: 'High speed aerial delivery package',
        price: 899,
        currency: 'INR',
        categoryId: 'cat-1',
        categoryName: 'Tech & Cables',
        primaryImageUrl: 'https://images.unsplash.com/cbe-drone.jpg',
        isInStock: true,
        createdAt: '2026-11-26T10:00:00.000Z',
      };

      const normalized = normalizeProduct(summaryView);
      assert.equal(normalized.id, 'prod-123');
      assert.equal(normalized.name, 'Coimbatore Drone Pod');
      assert.equal(normalized.price, 899);
      assert.equal(normalized.image, 'https://images.unsplash.com/cbe-drone.jpg');
      assert.equal(normalized.category, 'Tech & Cables');
      assert.equal(normalized.inStock, true);
      assert.ok(Array.isArray(normalized.images));
      assert.ok(normalized.images.length > 0);
    });
  });

  describe('mapOrderStatus', () => {
    it('maps backend statuses to consumer friendly statuses', () => {
      assert.equal(mapOrderStatus('CREATED'), 'Order Placed');
      assert.equal(mapOrderStatus('CONFIRMED'), 'Order Confirmed');
      assert.equal(mapOrderStatus('PREPARING'), 'Preparing');
      assert.equal(mapOrderStatus('DISPATCHED'), 'Drone Launched');
      assert.equal(mapOrderStatus('IN_TRANSIT'), 'Out for Delivery');
      assert.equal(mapOrderStatus('DELIVERED'), 'Delivered');
      assert.equal(mapOrderStatus('CANCELLED'), 'Cancelled');
      assert.equal(mapOrderStatus('FAILED'), 'Delivery Failed');
      assert.equal(mapOrderStatus('Out for Delivery'), 'Out for Delivery');
    });
  });

  describe('normalizeOrder', () => {
    it('handles null/undefined order gracefully', () => {
      const order = normalizeOrder(null);
      assert.equal(order.id, 'ord-unknown');
      assert.equal(order.status, 'Order Placed');
      assert.ok(Array.isArray(order.items));
      assert.ok(Array.isArray(order.timeline));
    });

    it('unwraps NestJS OrderSummaryView and produces compliant CustomerOrder', () => {
      const backendOrder = {
        id: 'cbe-ord-456',
        orderNumber: 'ORD-2026-1126-001',
        status: 'DISPATCHED',
        totalAmount: '1402.92',
        currency: 'INR',
        itemCount: 2,
        createdAt: '2026-11-26T12:00:00.000Z',
        shippingAddress: {
          line1: 'Kalapatti Main Road',
          city: 'Coimbatore',
          state: 'Tamil Nadu',
          postalCode: '641048',
          latitude: 11.1132,
          longitude: 77.0277,
        },
      };

      const order = normalizeOrder(backendOrder);
      assert.equal(order.id, 'cbe-ord-456');
      assert.equal(order.status, 'Drone Launched');
      assert.equal(order.total, 1402.92);
      assert.equal(order.deliveryAddress.city, 'Coimbatore');
      assert.equal(order.deliveryAddress.latitude, 11.1132);
      assert.ok(Array.isArray(order.items));
      assert.ok(Array.isArray(order.timeline));
      assert.equal(order.timeline.length, 5);
      // Verify timeline milestone completion
      const preparingStep = order.timeline.find((t) => t.status === 'Preparing');
      assert.equal(preparingStep?.completed, true);
    });
  });

  describe('normalizeAddress', () => {
    it('handles null/undefined gracefully with safe defaults', () => {
      const addr = normalizeAddress(null);
      assert.ok(addr.id.startsWith('addr-'));
      assert.equal(addr.label, 'Home');
      assert.equal(addr.city, 'Coimbatore');
      assert.equal(typeof addr.label, 'string');
    });

    it('defensively handles null label from Prisma backend', () => {
      const prismaAddr = {
        id: 'addr-xyz-789',
        userId: 'usr-123',
        label: null,
        recipientName: 'Kavitha S',
        line1: '12 Nava India Road',
        line2: 'Peelamedu',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        postalCode: '641004',
        phone: '+91 94433 22110',
        isDefault: true,
      };

      const normalized = normalizeAddress(prismaAddr);
      assert.equal(normalized.id, 'addr-xyz-789');
      assert.equal(normalized.label, 'Home');
      assert.equal(normalized.building, '12 Nava India Road');
      assert.equal(normalized.street, 'Peelamedu');
      assert.equal(normalized.city, 'Coimbatore');
      assert.equal(normalized.postalCode, '641004');
      assert.equal(normalized.isDefault, true);
      assert.equal(normalized.latitude, 11.1132);
      assert.equal(typeof normalized.label, 'string');
    });
  });

  describe('ApiDownError', () => {
    it('constructs with isApiDown flag and statusCode', () => {
      const err = new ApiDownError('Gateway failure', 502);
      assert.equal(err.isApiDown, true);
      assert.equal(err.statusCode, 502);
      assert.equal(err.message, 'Gateway failure');
    });
  });

  describe('normalizeCart', () => {
    it('normalizes empty or null cart response gracefully', () => {
      const cart = normalizeCart(null);
      assert.equal(cart.id, 'cart-current');
      assert.deepEqual(cart.items, []);
      assert.equal(cart.itemCount, 0);
      assert.equal(cart.total, 0);
    });

    it('unwraps NestJS Cart response and builds item ID mapping for cart operations', () => {
      const cachedMap = new Map<string, string>();
      const nestJsCart = {
        cart: {
          id: 'cart-uuid-001',
          items: [
            {
              id: 'cart-item-1',
              productId: 'prod-dosa-1',
              quantity: 2,
              unitPrice: 180,
              product: {
                id: 'prod-dosa-1',
                name: 'Kovai Masala Dosa',
                price: 180,
                primaryImageUrl: '/images/products/masala_dosa.jpg',
                isInStock: true,
              },
            },
            {
              id: 'cart-item-2',
              productId: 'prod-coffee-1',
              quantity: 1,
              unitPrice: 240,
              product: {
                id: 'prod-coffee-1',
                name: 'Filter Coffee 500g',
                price: 240,
                primaryImageUrl: '/images/products/filter_coffee.jpg',
                isInStock: true,
              },
            },
          ],
          itemCount: 3,
          subtotal: 600,
          deliveryFee: 49,
          tax: 30,
          total: 679,
        },
      };

      const cart = normalizeCart(nestJsCart, cachedMap);

      assert.equal(cart.id, 'cart-uuid-001');
      assert.equal(cart.items.length, 2);
      assert.equal(cart.itemCount, 3);
      assert.equal(cart.total, 679);

      // Verify mapping: both cartItem.id and productId map to cartItem.id
      assert.equal(cachedMap.get('cart-item-1'), 'cart-item-1');
      assert.equal(cachedMap.get('prod-dosa-1'), 'cart-item-1');
      assert.equal(cachedMap.get('cart-item-2'), 'cart-item-2');
      assert.equal(cachedMap.get('prod-coffee-1'), 'cart-item-2');
    });
  });

  describe('admin extractData', () => {
    it('unwraps nested paginated drones, missions, and orders', () => {
      const dronesResponse = {
        success: true,
        data: {
          drones: [{ id: 'D-001', name: 'AeroSky 1' }],
          total: 1,
        },
      };
      assert.deepEqual(extractData(dronesResponse, 'drones'), [{ id: 'D-001', name: 'AeroSky 1' }]);

      const missionsResponse = {
        success: true,
        data: {
          missions: [{ id: 'M-001', status: 'IN_TRANSIT' }],
          total: 1,
        },
      };
      assert.deepEqual(extractData(missionsResponse, 'missions'), [{ id: 'M-001', status: 'IN_TRANSIT' }]);
    });
  });
});
