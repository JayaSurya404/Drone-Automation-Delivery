import type {
  OrderRepository,
  OrderRecord,
  NewOrderRecord,
  OrderUpdateRecord,
  ListOrdersFilter
} from "../order.repository.js";

export function createMockOrderRepository(initialOrders: OrderRecord[] = []): OrderRepository {
  const orders = new Map<string, OrderRecord>();

  for (const order of initialOrders) {
    orders.set(order.id, { ...order });
  }

  return {
    async create(order: NewOrderRecord): Promise<OrderRecord> {
      const now = new Date();
      const record: OrderRecord = {
        id: order.id,
        order_number: order.order_number,
        organization_id: order.organization_id,
        customer_id: order.customer_id,
        status: order.status,
        priority: order.priority ?? "STANDARD",
        pickup_latitude: order.pickup_latitude,
        pickup_longitude: order.pickup_longitude,
        pickup_altitude_meters: order.pickup_altitude_meters ?? 0,
        pickup_address: order.pickup_address ?? null,
        delivery_latitude: order.delivery_latitude,
        delivery_longitude: order.delivery_longitude,
        delivery_altitude_meters: order.delivery_altitude_meters ?? 0,
        delivery_address: order.delivery_address ?? null,
        package_weight_grams: order.package_weight_grams,
        package_length_cm: order.package_length_cm ?? null,
        package_width_cm: order.package_width_cm ?? null,
        package_height_cm: order.package_height_cm ?? null,
        package_description: order.package_description ?? null,
        delivery_notes: order.delivery_notes ?? null,
        cancellation_reason: order.cancellation_reason ?? null,
        cancelled_at: order.cancelled_at ? new Date(order.cancelled_at as any) : null,
        cancelled_by_user_id: order.cancelled_by_user_id ?? null,
        failure_reason: order.failure_reason ?? null,
        failed_at: order.failed_at ? new Date(order.failed_at as any) : null,
        confirmed_at: order.confirmed_at ? new Date(order.confirmed_at as any) : null,
        assigned_at: order.assigned_at ? new Date(order.assigned_at as any) : null,
        delivered_at: order.delivered_at ? new Date(order.delivered_at as any) : null,
        created_at: now,
        updated_at: now
      };

      orders.set(record.id, record);
      return record;
    },

    async findById(id: string, organizationId: string): Promise<OrderRecord | null> {
      const order = orders.get(id);
      if (!order || order.organization_id !== organizationId) {
        return null;
      }
      return { ...order };
    },

    async findByOrderNumber(orderNumber: string, organizationId: string): Promise<OrderRecord | null> {
      for (const order of orders.values()) {
        if (order.order_number === orderNumber && order.organization_id === organizationId) {
          return { ...order };
        }
      }
      return null;
    },

    async update(id: string, organizationId: string, updates: OrderUpdateRecord): Promise<OrderRecord | null> {
      const order = orders.get(id);
      if (!order || order.organization_id !== organizationId) {
        return null;
      }

      const updated: OrderRecord = {
        ...order,
        ...updates,
        cancelled_at: updates.cancelled_at !== undefined ? (updates.cancelled_at ? new Date(updates.cancelled_at as any) : null) : order.cancelled_at,
        confirmed_at: updates.confirmed_at !== undefined ? (updates.confirmed_at ? new Date(updates.confirmed_at as any) : null) : order.confirmed_at,
        assigned_at: updates.assigned_at !== undefined ? (updates.assigned_at ? new Date(updates.assigned_at as any) : null) : order.assigned_at,
        delivered_at: updates.delivered_at !== undefined ? (updates.delivered_at ? new Date(updates.delivered_at as any) : null) : order.delivered_at,
        failed_at: updates.failed_at !== undefined ? (updates.failed_at ? new Date(updates.failed_at as any) : null) : order.failed_at,
        updated_at: new Date()
      };

      orders.set(id, updated);
      return { ...updated };
    },

    async list(filter: ListOrdersFilter): Promise<{ orders: OrderRecord[]; total: number }> {
      let result = Array.from(orders.values()).filter(
        (o) => o.organization_id === filter.organizationId
      );

      if (filter.customerId) {
        result = result.filter((o) => o.customer_id === filter.customerId);
      }

      if (filter.status) {
        result = result.filter((o) => o.status === filter.status);
      }

      if (filter.priority) {
        result = result.filter((o) => o.priority === filter.priority);
      }

      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const total = result.length;
      const paginated = result.slice(filter.offset, filter.offset + filter.limit);

      return {
        orders: paginated.map((o) => ({ ...o })),
        total
      };
    },

    async getItemsForOrder(_orderId: string) {
      return [];
    },

    async getItemsForOrders(_orderIds: string[]) {
      return new Map();
    }
  };
}
