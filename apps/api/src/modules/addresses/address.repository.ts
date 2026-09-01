import type { Kysely } from "kysely";
import type { Database } from "../../infrastructure/db/schema.js";

export interface AddressRepository {
  list(userId: string): Promise<any[]>;
  findById(userId: string, id: string): Promise<any | null>;
  create(userId: string, data: any): Promise<any>;
  update(userId: string, id: string, data: any): Promise<any | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

export function createAddressRepository(db: Kysely<Database>): AddressRepository {
  return {
    async list(userId) {
      return db
        .selectFrom("customer_addresses")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("is_default", "desc")
        .orderBy("created_at", "desc")
        .execute();
    },

    async findById(userId, id) {
      const row = await db
        .selectFrom("customer_addresses")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();
      return row || null;
    },

    async create(userId, data) {
      if (data.is_default) {
        await db.updateTable("customer_addresses").set({ is_default: false }).where("user_id", "=", userId).execute();
      }

      const id = crypto.randomUUID();
      const row = await db
        .insertInto("customer_addresses")
        .values({
          id,
          user_id: userId,
          recipient_name: data.recipient_name,
          phone: data.phone,
          address_line1: data.address_line1,
          address_line2: data.address_line2 || null,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
          latitude: data.latitude,
          longitude: data.longitude,
          delivery_instructions: data.delivery_instructions || null,
          is_default: Boolean(data.is_default)
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return row;
    },

    async update(userId, id, data) {
      if (data.is_default) {
        await db.updateTable("customer_addresses").set({ is_default: false }).where("user_id", "=", userId).execute();
      }

      const row = await db
        .updateTable("customer_addresses")
        .set({
          ...data,
          updated_at: new Date()
        })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .returningAll()
        .executeTakeFirst();

      return row || null;
    },

    async delete(userId, id) {
      const result = await db.deleteFrom("customer_addresses").where("id", "=", id).where("user_id", "=", userId).executeTakeFirst();
      return Number(result.numDeletedRows ?? 0) > 0;
    }
  };
}
