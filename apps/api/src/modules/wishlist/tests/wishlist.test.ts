import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWishlistService } from "../wishlist.service.js";

describe("Wishlist / Customer Wishlist Management", () => {
  const user = {
    id: "55555555-5555-5555-5555-555555555555",
    email: "customer@example.com",
    name: "Jane Doe",
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    organizationName: "Jane's Org",
    role: "CUSTOMER" as const,
    permissions: ["wishlist:manage" as const]
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

  let wishlistDb: any[] = [];

  const mockWishlistRepo = {
    async getWishlist(userId: string) {
      return wishlistDb
        .filter((w) => w.user_id === userId)
        .map((w) => ({
          item_id: w.id,
          user_id: w.user_id,
          product_id: w.product_id,
          item_created_at: new Date(),
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
    async addItem(userId: string, productId: string) {
      if (!wishlistDb.some((w) => w.user_id === userId && w.product_id === productId)) {
        wishlistDb.push({ id: "wish-1", user_id: userId, product_id: productId });
      }
    },
    async removeItem(userId: string, productId: string) {
      wishlistDb = wishlistDb.filter((w) => !(w.user_id === userId && w.product_id === productId));
    }
  };

  const mockCatalogRepo = {
    async findById(id: string) {
      return id === product.id ? product : null;
    }
  };

  const service = createWishlistService(mockWishlistRepo as any, mockCatalogRepo as any);

  it("adds and removes products from wishlist", async () => {
    const added = await service.addToWishlist(user, { productId: product.id });
    assert.equal(added.total, 1);
    assert.equal(added.items[0].product.slug, "organic-honeycrisp-apples-1kg");

    const removed = await service.removeFromWishlist(user, product.id);
    assert.equal(removed.total, 0);
  });
});
