import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCartService } from "../cart.service.js";

describe("Cart / Customer Cart Management & Calculations", () => {
  const user = {
    id: "55555555-5555-5555-5555-555555555555",
    email: "customer@example.com",
    name: "Jane Doe",
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    organizationName: "Jane's Org",
    role: "CUSTOMER" as const,
    permissions: ["cart:manage" as const]
  };

  const product = {
    id: "10000000-0000-0000-0000-000000000001",
    name: "Organic Honeycrisp Apples (1kg)",
    slug: "organic-honeycrisp-apples-1kg",
    description: "Crisp organic apples.",
    category: "Groceries",
    price_cents: 699,
    currency: "USD",
    image_url: "https://example.com/apples.jpg",
    stock_quantity: 50,
    weight_grams: 1050,
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
        .map((c) => ({
          item_id: c.id,
          user_id: c.user_id,
          product_id: c.product_id,
          quantity: c.quantity,
          item_created_at: new Date(),
          item_updated_at: new Date(),
          name: product.name,
          slug: product.slug,
          description: product.description,
          category: product.category,
          price_cents: product.price_cents,
          currency: product.currency,
          image_url: product.image_url,
          stock_quantity: product.stock_quantity,
          weight_grams: product.weight_grams,
          is_drone_eligible: product.is_drone_eligible,
          is_featured: product.is_featured,
          is_active: product.is_active,
          product_created_at: product.created_at,
          product_updated_at: product.updated_at
        }));
    },
    async addItem(userId: string, productId: string, quantity: number) {
      const existing = cartDb.find((c) => c.user_id === userId && c.product_id === productId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        cartDb.push({ id: "item-1", user_id: userId, product_id: productId, quantity });
      }
    },
    async updateQuantity(userId: string, itemId: string, quantity: number) {
      if (quantity <= 0) {
        cartDb = cartDb.filter((c) => !(c.user_id === userId && c.id === itemId));
      } else {
        const item = cartDb.find((c) => c.user_id === userId && c.id === itemId);
        if (item) item.quantity = quantity;
      }
    },
    async removeItem(userId: string, itemId: string) {
      cartDb = cartDb.filter((c) => !(c.user_id === userId && c.id === itemId));
    },
    async clearCart(userId: string) {
      cartDb = cartDb.filter((c) => c.user_id !== userId);
    }
  };

  const mockCatalogRepo = {
    async findById(id: string) {
      return id === product.id ? product : null;
    }
  };

  const service = createCartService(mockCartRepo as any, mockCatalogRepo as any);

  it("adds items and computes subtotal and delivery fees accurately", async () => {
    const res = await service.addToCart(user, { productId: product.id, quantity: 2 });
    assert.equal(res.itemCount, 2);
    assert.equal(res.subtotalCents, 1398); // 699 * 2
    assert.equal(res.deliveryFeeCents, 499); // below 3500 cents promo threshold
    assert.equal(res.totalCents, 1897);
    assert.equal(res.isDronePayloadCompliant, true);
  });

  it("updates item quantity and clears cart", async () => {
    const updated = await service.updateCartItem(user, "item-1", { quantity: 5 });
    assert.equal(updated.itemCount, 5);
    assert.equal(updated.subtotalCents, 3495);

    const cleared = await service.clearCart(user);
    assert.equal(cleared.itemCount, 0);
    assert.equal(cleared.items.length, 0);
  });
});
