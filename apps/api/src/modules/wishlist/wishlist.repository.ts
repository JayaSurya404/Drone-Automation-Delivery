import type { Kysely } from "kysely";
import type { Database } from "../../infrastructure/db/schema.js";

export interface WishlistRepository {
  getWishlist(userId: string): Promise<any[]>;
  addItem(userId: string, productId: string): Promise<void>;
  removeItem(userId: string, productId: string): Promise<void>;
}

export function createWishlistRepository(db: Kysely<Database>): WishlistRepository {
  return {
    async getWishlist(userId) {
      return db
        .selectFrom("wishlist_items")
        .innerJoin("products", "wishlist_items.product_id", "products.id")
        .select([
          "wishlist_items.id as item_id",
          "wishlist_items.user_id",
          "wishlist_items.product_id",
          "wishlist_items.created_at as item_created_at",
          "products.id as product_id",
          "products.name",
          "products.slug",
          "products.description",
          "products.category",
          "products.price_cents",
          "products.currency",
          "products.image_url",
          "products.stock_quantity",
          "products.weight_grams",
          "products.length_cm",
          "products.width_cm",
          "products.height_cm",
          "products.is_drone_eligible",
          "products.is_featured",
          "products.is_active",
          "products.created_at as product_created_at",
          "products.updated_at as product_updated_at"
        ])
        .where("wishlist_items.user_id", "=", userId)
        .where("products.is_active", "=", true)
        .orderBy("wishlist_items.created_at", "desc")
        .execute();
    },

    async addItem(userId, productId) {
      await db
        .insertInto("wishlist_items")
        .values({
          id: crypto.randomUUID(),
          user_id: userId,
          product_id: productId
        })
        .onConflict((oc) => oc.columns(["user_id", "product_id"]).doNothing())
        .execute();
    },

    async removeItem(userId, productId) {
      await db.deleteFrom("wishlist_items").where("user_id", "=", userId).where("product_id", "=", productId).execute();
    }
  };
}
