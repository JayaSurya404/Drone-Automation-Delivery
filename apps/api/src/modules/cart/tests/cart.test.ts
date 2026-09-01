import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createCartService } from "../cart.service.js";

describe("Cart / Customer Cart Management & Calculations", () => {
  const userA = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "customera@example.com",
    name: "Customer A",
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    organizationName: "Org A",
    role: "CUSTOMER" as const,
    permissions: ["cart:manage" as const]
  };

  const userB = {
    id: "22222222-2222-2222-2222-222222222222",
    email: "customerb@example.com",
    name: "Customer B",
    organizationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    organizationName: "Org B",
    role: "CUSTOMER" as const,
    permissions: ["cart:manage" as const]
  };

  const product1 = {
    id: "10000000-0000-0000-0000-000000000001",
    name: "Aashirvaad Superior MP Atta (1kg)",
    slug: "aashirvaad-superior-mp-atta-1kg",
    description: "100% pure whole wheat flour.",
    category: "Groceries",
    price_cents: 6500, // ₹65.00
    mrp_cents: 7500, // ₹75.00
    currency: "INR",
    image_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400",
    stock_quantity: 50,
    weight_grams: 1000,
    is_drone_eligible: true,
    is_featured: true,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  const product2 = {
    id: "10000000-0000-0000-0000-000000000002",
    name: "Amul Taaza Toned Milk (500ml)",
    slug: "amul-taaza-toned-milk-500ml",
    description: "Fresh pasteurized toned milk.",
    category: "Daily Essentials",
    price_cents: 2700, // ₹27.00
    mrp_cents: 3000,
    currency: "INR",
    image_url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400",
    stock_quantity: 40,
    weight_grams: 520,
    is_drone_eligible: true,
    is_featured: true,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  let cartDb: any[] = [];

  const mockCartRepo = {
    async getCart(userId: string) {
      return cartDb
        .filter((c) => c.user_id === userId)
        .map((c) => {
          const prod = c.product_id === product1.id ? product1 : product2;
          return {
            item_id: c.id,
            user_id: c.user_id,
            product_id: c.product_id,
            quantity: c.quantity,
            item_created_at: new Date(),
            item_updated_at: new Date(),
            name: prod.name,
            slug: prod.slug,
            description: prod.description,
            category: prod.category,
            price_cents: prod.price_cents,
            mrp_cents: prod.mrp_cents,
            currency: prod.currency,
            image_url: prod.image_url,
            stock_quantity: prod.stock_quantity,
            weight_grams: prod.weight_grams,
            is_drone_eligible: prod.is_drone_eligible,
            is_featured: prod.is_featured,
            is_active: prod.is_active,
            product_created_at: prod.created_at,
            product_updated_at: prod.updated_at
          };
        });
    },
    async addItem(userId: string, productId: string, quantity: number) {
      const existing = cartDb.find((c) => c.user_id === userId && c.product_id === productId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        cartDb.push({ id: `item-${cartDb.length + 1}`, user_id: userId, product_id: productId, quantity });
      }
    },
    async updateQuantity(userId: string, itemId: string, quantity: number) {
      if (quantity <= 0) {
        cartDb = cartDb.filter((c) => !(c.user_id === userId && (c.id === itemId || c.product_id === itemId)));
      } else {
        const item = cartDb.find((c) => c.user_id === userId && (c.id === itemId || c.product_id === itemId));
        if (item) item.quantity = quantity;
      }
    },
    async removeItem(userId: string, itemId: string) {
      cartDb = cartDb.filter((c) => !(c.user_id === userId && (c.id === itemId || c.product_id === itemId)));
    },
    async clearCart(userId: string) {
      cartDb = cartDb.filter((c) => c.user_id !== userId);
    }
  };

  const mockCatalogRepo = {
    async findById(id: string) {
      if (id === product1.id) return product1;
      if (id === product2.id) return product2;
      return null;
    }
  };

  const service = createCartService(mockCartRepo as any, mockCatalogRepo as any);

  beforeEach(() => {
    cartDb = [];
  });

  it("1. starts with an empty cart correctly", async () => {
    const res = await service.getCart(userA);
    assert.equal(res.items.length, 0);
    assert.equal(res.itemCount, 0);
    assert.equal(res.subtotalPaise, 0);
    assert.equal(res.deliveryFeePaise, 0);
    assert.equal(res.totalPaise, 0);
    assert.equal(res.grossWeightGrams, 0);
    assert.equal(res.isPayloadExceeded, false);
  });

  it("2. adds item to cart and calculates ₹ pricing, standard delivery fee, and weight", async () => {
    const res = await service.addToCart(userA, { productId: product1.id, quantity: 1 });
    assert.equal(res.itemCount, 1);
    assert.equal(res.subtotalPaise, 6500); // ₹65.00
    assert.equal(res.deliveryFeePaise, 3900); // ₹39.00 (< ₹499)
    assert.equal(res.totalPaise, 10400); // ₹104.00
    assert.equal(res.grossWeightGrams, 1200); // 1000g + 200g packaging
    assert.equal(res.isPayloadExceeded, false);
  });

  it("3. increases item quantity (+) and recalculates pricing and free delivery", async () => {
    await service.addToCart(userA, { productId: product1.id, quantity: 1 });
    // Increase quantity from 1 to 8 (8 * ₹65 = ₹520 >= ₹499 -> Free delivery)
    const updated = await service.updateCartItem(userA, "item-1", { quantity: 8 });
    assert.equal(updated.itemCount, 8);
    assert.equal(updated.subtotalPaise, 52000); // ₹520.00
    assert.equal(updated.deliveryFeePaise, 0); // FREE DELIVERY!
    assert.equal(updated.totalPaise, 52000);
    assert.equal(updated.grossWeightGrams, 8200); // 8000g + 200g
    assert.equal(updated.isPayloadExceeded, true); // > 4000g limit
  });

  it("4. decreases item quantity (-) down to 1", async () => {
    await service.addToCart(userA, { productId: product1.id, quantity: 3 });
    const decremented = await service.updateCartItem(userA, "item-1", { quantity: 2 });
    assert.equal(decremented.itemCount, 2);
    assert.equal(decremented.subtotalPaise, 13000); // ₹130.00
    assert.equal(decremented.deliveryFeePaise, 3900); // ₹39.00
    assert.equal(decremented.totalPaise, 16900);
  });

  it("5. decreasing quantity to 0 removes the item from cart", async () => {
    await service.addToCart(userA, { productId: product1.id, quantity: 1 });
    const res = await service.updateCartItem(userA, "item-1", { quantity: 0 });
    assert.equal(res.items.length, 0);
    assert.equal(res.itemCount, 0);
    assert.equal(res.totalPaise, 0);
  });

  it("6. deletes an individual item from cart", async () => {
    await service.addToCart(userA, { productId: product1.id, quantity: 2 });
    await service.addToCart(userA, { productId: product2.id, quantity: 3 });

    let current = await service.getCart(userA);
    assert.equal(current.items.length, 2);
    assert.equal(current.itemCount, 5);

    // Remove first item
    const afterDelete = await service.removeCartItem(userA, "item-1");
    assert.equal(afterDelete.items.length, 1);
    assert.equal(afterDelete.itemCount, 3);
    assert.equal(afterDelete.items[0].productId, product2.id);
  });

  it("7. clears all items from the customer cart", async () => {
    await service.addToCart(userA, { productId: product1.id, quantity: 2 });
    await service.addToCart(userA, { productId: product2.id, quantity: 3 });

    const cleared = await service.clearCart(userA);
    assert.equal(cleared.items.length, 0);
    assert.equal(cleared.itemCount, 0);
    assert.equal(cleared.totalPaise, 0);
    assert.equal(cleared.grossWeightGrams, 0);
  });

  it("8. enforces strict customer isolation: Customer A mutations never affect Customer B", async () => {
    // Customer A adds product 1
    await service.addToCart(userA, { productId: product1.id, quantity: 2 });

    // Customer B adds product 2
    await service.addToCart(userB, { productId: product2.id, quantity: 1 });

    // Verify Customer A sees only Product 1
    const cartA = await service.getCart(userA);
    assert.equal(cartA.items.length, 1);
    assert.equal(cartA.items[0].productId, product1.id);
    assert.equal(cartA.itemCount, 2);

    // Verify Customer B sees only Product 2
    const cartB = await service.getCart(userB);
    assert.equal(cartB.items.length, 1);
    assert.equal(cartB.items[0].productId, product2.id);
    assert.equal(cartB.itemCount, 1);

    // Customer A clears their cart
    await service.clearCart(userA);

    // Customer A cart is empty
    const cartAAfter = await service.getCart(userA);
    assert.equal(cartAAfter.items.length, 0);

    // Customer B cart is UNTOUCHED
    const cartBAfter = await service.getCart(userB);
    assert.equal(cartBAfter.items.length, 1);
    assert.equal(cartBAfter.itemCount, 1);
    assert.equal(cartBAfter.items[0].productId, product2.id);
  });

  it("9. allows mutation by product ID as fallback", async () => {
    await service.addToCart(userA, { productId: product1.id, quantity: 1 });
    const updated = await service.updateCartItem(userA, product1.id, { quantity: 4 });
    assert.equal(updated.itemCount, 4);

    const removed = await service.removeCartItem(userA, product1.id);
    assert.equal(removed.items.length, 0);
  });
});
