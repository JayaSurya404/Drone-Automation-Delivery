import type { Kysely, Insertable, Updateable, Selectable } from "kysely";
import type { Database, OrderTable, OrderItemTable } from "../../infrastructure/db/schema.js";

export type OrderRecord = Selectable<OrderTable>;
export type NewOrderRecord = Insertable<OrderTable>;
export type OrderUpdateRecord = Updateable<OrderTable>;
export type OrderItemRecord = Selectable<OrderItemTable>;

export interface ListOrdersFilter {
  organizationId: string;
  customerId?: string;
  status?: string;
  priority?: string;
  limit: number;
  offset: number;
}

export interface OrderRepository {
  create(order: NewOrderRecord, items?: Array<Insertable<OrderItemTable>>): Promise<OrderRecord>;
  findById(id: string, organizationId: string): Promise<OrderRecord | null>;
  findByOrderNumber(orderNumber: string, organizationId: string): Promise<OrderRecord | null>;
  update(id: string, organizationId: string, updates: OrderUpdateRecord): Promise<OrderRecord | null>;
  list(filter: ListOrdersFilter): Promise<{ orders: OrderRecord[]; total: number }>;
  getItemsForOrder(orderId: string): Promise<OrderItemRecord[]>;
  getItemsForOrders(orderIds: string[]): Promise<Map<string, OrderItemRecord[]>>;
}

export function createOrderRepository(db: Kysely<Database>): OrderRepository {
  return {
    async create(order: NewOrderRecord, items?: Array<Insertable<OrderItemTable>>): Promise<OrderRecord> {
      const rows = await db
        .insertInto("orders")
        .values(order)
        .returningAll()
        .execute();

      const createdOrder = rows[0];

      if (items && items.length > 0) {
        const itemValues = items.map((item) => ({
          id: item.id || crypto.randomUUID(),
          order_id: createdOrder.id,
          product_id: item.product_id || null,
          product_name: item.product_name,
          unit_price_cents: item.unit_price_cents,
          quantity: item.quantity,
          total_price_cents: item.total_price_cents,
          weight_grams: item.weight_grams,
          image_url: item.image_url || null
        }));
        await db.insertInto("order_items").values(itemValues).execute();
      }

      return createdOrder;
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
    },

    async getItemsForOrder(orderId: string): Promise<OrderItemRecord[]> {
      return db
        .selectFrom("order_items")
        .selectAll()
        .where("order_id", "=", orderId)
        .orderBy("created_at", "asc")
        .execute();
    },

    async getItemsForOrders(orderIds: string[]): Promise<Map<string, OrderItemRecord[]>> {
      const map = new Map<string, OrderItemRecord[]>();
      if (orderIds.length === 0) return map;

      const rows = await db
        .selectFrom("order_items")
        .selectAll()
        .where("order_id", "in", orderIds)
        .orderBy("created_at", "asc")
        .execute();

      for (const row of rows) {
        const list = map.get(row.order_id) || [];
        list.push(row);
        map.set(row.order_id, list);
      }
      return map;
    }
  };
}
