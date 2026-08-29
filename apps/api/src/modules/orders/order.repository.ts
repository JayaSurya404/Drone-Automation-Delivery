import type { Kysely, Insertable, Updateable, Selectable } from "kysely";
import type { Database, OrderTable } from "../../infrastructure/db/schema.js";

export type OrderRecord = Selectable<OrderTable>;
export type NewOrderRecord = Insertable<OrderTable>;
export type OrderUpdateRecord = Updateable<OrderTable>;

export interface ListOrdersFilter {
  organizationId: string;
  customerId?: string;
  status?: string;
  priority?: string;
  limit: number;
  offset: number;
}

export interface OrderRepository {
  create(order: NewOrderRecord): Promise<OrderRecord>;
  findById(id: string, organizationId: string): Promise<OrderRecord | null>;
  findByOrderNumber(orderNumber: string, organizationId: string): Promise<OrderRecord | null>;
  update(id: string, organizationId: string, updates: OrderUpdateRecord): Promise<OrderRecord | null>;
  list(filter: ListOrdersFilter): Promise<{ orders: OrderRecord[]; total: number }>;
}

export function createOrderRepository(db: Kysely<Database>): OrderRepository {
  return {
    async create(order: NewOrderRecord): Promise<OrderRecord> {
      const rows = await db
        .insertInto("orders")
        .values(order)
        .returningAll()
        .execute();
      return rows[0];
    },

    async findById(id: string, organizationId: string): Promise<OrderRecord | null> {
      const row = await db
        .selectFrom("orders")
        .selectAll()
        .where("id", "=", id)
        .where("organization_id", "=", organizationId)
        .executeTakeFirst();
      return row ?? null;
    },

    async findByOrderNumber(orderNumber: string, organizationId: string): Promise<OrderRecord | null> {
      const row = await db
        .selectFrom("orders")
        .selectAll()
        .where("order_number", "=", orderNumber)
        .where("organization_id", "=", organizationId)
        .executeTakeFirst();
      return row ?? null;
    },

    async update(id: string, organizationId: string, updates: OrderUpdateRecord): Promise<OrderRecord | null> {
      const rows = await db
        .updateTable("orders")
        .set({
          ...updates,
          updated_at: new Date()
        })
        .where("id", "=", id)
        .where("organization_id", "=", organizationId)
        .returningAll()
        .execute();
      return rows[0] ?? null;
    },

    async list(filter: ListOrdersFilter): Promise<{ orders: OrderRecord[]; total: number }> {
      let query = db
        .selectFrom("orders")
        .selectAll()
        .where("organization_id", "=", filter.organizationId);

      let countQuery = db
        .selectFrom("orders")
        .select((eb) => eb.fn.count("id").as("count"))
        .where("organization_id", "=", filter.organizationId);

      if (filter.customerId) {
        query = query.where("customer_id", "=", filter.customerId);
        countQuery = countQuery.where("customer_id", "=", filter.customerId);
      }

      if (filter.status) {
        query = query.where("status", "=", filter.status);
        countQuery = countQuery.where("status", "=", filter.status);
      }

      if (filter.priority) {
        query = query.where("priority", "=", filter.priority);
        countQuery = countQuery.where("priority", "=", filter.priority);
      }

      const [orders, countResult] = await Promise.all([
        query
          .orderBy("created_at", "desc")
          .limit(filter.limit)
          .offset(filter.offset)
          .execute(),
        countQuery.executeTakeFirst()
      ]);

      const total = countResult ? Number(countResult.count) : 0;
      return { orders, total };
    }
  };
}
