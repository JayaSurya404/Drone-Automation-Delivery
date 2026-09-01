import type { Kysely } from "kysely";
import type { Database } from "../../infrastructure/db/schema.js";

export interface CartRepository {
  getCart(userId: string): Promise<any[]>;
  addItem(userId: string, productId: string, quantity: number): Promise<void>;
  updateQuantity(userId: string, itemId: string, quantity: number): Promise<void>;
  removeItem(userId: string, itemId: string): Promise<void>;
  clearCart(userId: string): Promise<void>;
}

export function createCartRepository(db: Kysely<Database>): CartRepository {
  return {
    async getCart(userId) {
      return db
        .selectFrom("cart_items")
        .innerJoin("products", "cart_items.product_id", "products.id")
        .select([
          "cart_items.id as item_id",
          "cart_items.user_id",
          "cart_items.product_id",
          "cart_items.quantity",
          "cart_items.created_at as item_created_at",
          "cart_items.updated_at as item_updated_at",
          "products.id as product_id",
          "products.name",
          "products.slug",
          "products.description",
          "products.category",
          "products.price_cents",
          "products.mrp_cents",
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
        .where("cart_items.user_id", "=", userId)
        .where("products.is_active", "=", true)
        .orderBy("cart_items.created_at", "asc")
        .execute();
    },

    async addItem(userId, productId, quantity) {
      await db
        .insertInto("cart_items")
        .values({
          id: crypto.randomUUID(),
          user_id: userId,
          product_id: productId,
          quantity
        })
        .onConflict((oc) =>
          oc.columns(["user_id", "product_id"]).doUpdateSet((eb) => ({
            quantity: eb("cart_items.quantity", "+", quantity),
            updated_at: new Date()
          }))
        )
        .execute();
    },

    async updateQuantity(userId, itemId, quantity) {
      if (quantity <= 0) {
        await db
          .deleteFrom("cart_items")
          .where("user_id", "=", userId)
          .where((eb) => eb.or([
            eb("id", "=", itemId),
            eb("product_id", "=", itemId)
          ]))
          .execute();
      } else {
        await db
          .updateTable("cart_items")
          .set({ quantity, updated_at: new Date() })
          .where("user_id", "=", userId)
          .where((eb) => eb.or([
            eb("id", "=", itemId),
            eb("product_id", "=", itemId)
          ]))
          .execute();
      }
    },

    async removeItem(userId, itemId) {
      await db
        .deleteFrom("cart_items")
        .where("user_id", "=", userId)
        .where((eb) => eb.or([
          eb("id", "=", itemId),
          eb("product_id", "=", itemId)
        ]))
        .execute();
    },

    async clearCart(userId) {
      await db.deleteFrom("cart_items").where("user_id", "=", userId).execute();
    }
  };
}
