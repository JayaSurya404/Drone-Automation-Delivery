import crypto from "node:crypto";
import type {
  AuthenticatedUser,
  CreateOrderRequest,
  UpdateOrderStatusRequest,
  CancelOrderRequest,
  OrderResponse,
  OrderListQuery,
  OrderListResponse,
  OrderStatus,
  OrderPriority
} from "@skynav/contracts";
import type { OrderRepository, OrderRecord } from "./order.repository.js";
import type { AuditService } from "../audit/audit.service.js";
import {
  validateOrderStateTransition,
  canCustomerCancelOrder,
  canOperatorCancelOrder
} from "./order.state-machine.js";

export class OrderNotFoundError extends Error {
  public readonly code = "ORDER_NOT_FOUND";
  constructor(orderId: string) {
    super(`Order with ID '${orderId}' not found.`);
    this.name = "OrderNotFoundError";
  }
}

export class OrderForbiddenError extends Error {
  public readonly code = "ORDER_ACCESS_FORBIDDEN";
  constructor(message = "You do not have permission to access or modify this order.") {
    super(message);
    this.name = "OrderForbiddenError";
  }
}

export class OrderCancellationProhibitedError extends Error {
  public readonly code = "ORDER_CANCELLATION_PROHIBITED";
  constructor(status: string) {
    super(`Orders in '${status}' status cannot be cancelled.`);
    this.name = "OrderCancellationProhibitedError";
  }
}

export interface OrderService {
  createOrder(user: AuthenticatedUser, input: CreateOrderRequest): Promise<OrderResponse>;
  getOrder(user: AuthenticatedUser, orderId: string): Promise<OrderResponse>;
  updateOrderStatus(user: AuthenticatedUser, orderId: string, input: UpdateOrderStatusRequest): Promise<OrderResponse>;
  cancelOrder(user: AuthenticatedUser, orderId: string, input: CancelOrderRequest): Promise<OrderResponse>;
  listOrders(user: AuthenticatedUser, query: OrderListQuery): Promise<OrderListResponse>;
}

export function mapOrderRecordToResponse(record: OrderRecord, items?: any[]): OrderResponse & { items?: any[] } {
  return {
    id: record.id,
    orderNumber: record.order_number,
    organizationId: record.organization_id,
    customerId: record.customer_id,
    status: record.status as OrderStatus,
    priority: record.priority as OrderPriority,
    pickup: {
      latitude: Number(record.pickup_latitude),
      longitude: Number(record.pickup_longitude),
      altitudeMeters: Number(record.pickup_altitude_meters ?? 0),
      ...(record.pickup_address ? { address: record.pickup_address } : {})
    },
    delivery: {
      latitude: Number(record.delivery_latitude),
      longitude: Number(record.delivery_longitude),
      altitudeMeters: Number(record.delivery_altitude_meters ?? 0),
      ...(record.delivery_address ? { address: record.delivery_address } : {})
    },
    package: {
      weightGrams: Number(record.package_weight_grams),
      ...(record.package_length_cm !== null ? { lengthCm: Number(record.package_length_cm) } : {}),
      ...(record.package_width_cm !== null ? { widthCm: Number(record.package_width_cm) } : {}),
      ...(record.package_height_cm !== null ? { heightCm: Number(record.package_height_cm) } : {}),
      ...(record.package_description ? { description: record.package_description } : {})
    },
    deliveryNotes: record.delivery_notes ?? null,
    cancellationReason: record.cancellation_reason ?? null,
    cancelledAt: record.cancelled_at ? new Date(record.cancelled_at).toISOString() : null,
    cancelledByUserId: record.cancelled_by_user_id ?? null,
    failureReason: record.failure_reason ?? null,
    failedAt: record.failed_at ? new Date(record.failed_at).toISOString() : null,
    confirmedAt: record.confirmed_at ? new Date(record.confirmed_at).toISOString() : null,
    assignedAt: record.assigned_at ? new Date(record.assigned_at).toISOString() : null,
    deliveredAt: record.delivered_at ? new Date(record.delivered_at).toISOString() : null,
    createdAt: new Date(record.created_at).toISOString(),
    updatedAt: new Date(record.updated_at).toISOString(),
    ...(items && items.length > 0
      ? {
          items: items.map((i) => ({
            id: i.id,
            orderId: i.order_id,
            productId: i.product_id,
            productName: i.product_name,
            unitPriceCents: Number(i.unit_price_cents),
            quantity: Number(i.quantity),
            totalPriceCents: Number(i.total_price_cents),
            weightGrams: Number(i.weight_grams),
            imageUrl: i.image_url,
            createdAt: i.created_at instanceof Date ? i.created_at.toISOString() : String(i.created_at)
          }))
        }
      : {})
  };
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${timestamp}-${randomSuffix}`;
}

import type { OutboxRepository } from "../events/outbox.repository.js";

export function createOrderService(
  repo: OrderRepository,
  auditService: AuditService,
  outboxRepo?: OutboxRepository
): OrderService {
  return {
    async createOrder(user: AuthenticatedUser, input: CreateOrderRequest): Promise<OrderResponse> {
      const orderId = crypto.randomUUID();
      const orderNumber = generateOrderNumber();

            const newOrder = await repo.create(
        {
          id: orderId,
          order_number: orderNumber,
          organization_id: user.organizationId,
          customer_id: user.id, // Strictly bound to authenticated identity
          status: "CREATED",
          priority: input.priority ?? "STANDARD",
          pickup_latitude: input.pickup.latitude,
          pickup_longitude: input.pickup.longitude,
          pickup_altitude_meters: input.pickup.altitudeMeters ?? 0,
          pickup_address: input.pickup.address ?? null,
          delivery_latitude: input.delivery.latitude,
          delivery_longitude: input.delivery.longitude,
          delivery_altitude_meters: input.delivery.altitudeMeters ?? 0,
          delivery_address: input.delivery.address ?? null,
          package_weight_grams: input.package.weightGrams,
          package_length_cm: input.package.lengthCm ?? null,
          package_width_cm: input.package.widthCm ?? null,
          package_height_cm: input.package.heightCm ?? null,
          package_description: input.package.description ?? null,
          delivery_notes: input.deliveryNotes ?? null,
          cancellation_reason: null,
          cancelled_at: null,
          cancelled_by_user_id: null,
          failure_reason: null,
          failed_at: null,
          confirmed_at: null,
          assigned_at: null,
          delivered_at: null
        },
        (input as any).items
          ? (input as any).items.map((it: any) => ({
              product_id: it.productId,
              product_name: it.productName || "Package Item",
              unit_price_cents: it.unitPriceCents || 0,
              quantity: it.quantity || 1,
              total_price_cents: (it.unitPriceCents || 0) * (it.quantity || 1),
              weight_grams: it.weightGrams || 100,
              image_url: it.imageUrl || null
            }))
          : undefined
      );

      if (outboxRepo) {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType: "ORDER_CREATED",
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "ORDER",
          aggregateId: newOrder.id,
          actorId: user.id,
          payload: {
            orderNumber: newOrder.order_number,
            customerId: user.id,
            priority: newOrder.priority,
            packageWeightGrams: newOrder.package_weight_grams
          }
        });
      }

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "ORDER_CREATED",
        resourceType: "order",
        resourceId: newOrder.id,
        metadata: {
          orderNumber: newOrder.order_number,
          priority: newOrder.priority,
          packageWeightGrams: newOrder.package_weight_grams
        }
      });

      const items = (input as any).items ? await repo.getItemsForOrder(newOrder.id) : [];
      return mapOrderRecordToResponse(newOrder, items);
    },

    async getOrder(user: AuthenticatedUser, orderId: string): Promise<OrderResponse> {
      const order = await repo.findById(orderId, user.organizationId);
      if (!order) {
        throw new OrderNotFoundError(orderId);
      }

      // Customer ownership check: Customers can only view their own orders
      if (user.role === "CUSTOMER" && order.customer_id !== user.id) {
        throw new OrderForbiddenError("You are not authorized to view this order.");
      }

      const items = await repo.getItemsForOrder(order.id);
      return mapOrderRecordToResponse(order, items);
    },

    async updateOrderStatus(
      user: AuthenticatedUser,
      orderId: string,
      input: UpdateOrderStatusRequest
    ): Promise<OrderResponse> {
      const order = await repo.findById(orderId, user.organizationId);
      if (!order) {
        throw new OrderNotFoundError(orderId);
      }

      // Customers cannot manually update operational order status
      if (user.role === "CUSTOMER") {
        throw new OrderForbiddenError("Customers cannot modify order flight lifecycle statuses.");
      }

      // Enforce centralized state transition matrix
      validateOrderStateTransition(order.status as OrderStatus, input.status);

      const now = new Date();
      const updates: Partial<OrderRecord> = {
        status: input.status
      };

      if (input.status === "CONFIRMED" && !order.confirmed_at) {
        updates.confirmed_at = now;
      } else if (input.status === "ASSIGNED" && !order.assigned_at) {
        updates.assigned_at = now;
      } else if (input.status === "DELIVERED" && !order.delivered_at) {
        updates.delivered_at = now;
      } else if (input.status === "FAILED") {
        updates.failed_at = now;
        updates.failure_reason = input.reason ?? "Delivery failure reported by operator";
      } else if (input.status === "CANCELLED") {
        updates.cancelled_at = now;
        updates.cancellation_reason = input.reason ?? "Cancelled by operator";
        updates.cancelled_by_user_id = user.id;
      }

      const updated = await repo.update(orderId, user.organizationId, updates);
      if (!updated) {
        throw new OrderNotFoundError(orderId);
      }

      if (outboxRepo) {
        const eventTypeMap: Record<string, string> = {
          CONFIRMED: "ORDER_CONFIRMED",
          ASSIGNED: "ORDER_ASSIGNED",
          IN_TRANSIT: "ORDER_IN_TRANSIT",
          DELIVERED: "ORDER_DELIVERED",
          FAILED: "ORDER_FAILED",
          CANCELLED: "ORDER_CANCELLED"
        };
        const eventType = (eventTypeMap[input.status] ?? "ORDER_UPDATED") as any;

        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType,
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "ORDER",
          aggregateId: orderId,
          actorId: user.id,
          payload: {
            orderNumber: updated.order_number,
            customerId: updated.customer_id,
            previousStatus: order.status,
            status: input.status,
            reason: input.reason ?? null
          }
        });
      }

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "ORDER_STATUS_UPDATED",
        resourceType: "order",
        resourceId: orderId,
        metadata: {
          previousStatus: order.status,
          newStatus: input.status,
          reason: input.reason ?? null
        }
      });

      return mapOrderRecordToResponse(updated);
    },

    async cancelOrder(
      user: AuthenticatedUser,
      orderId: string,
      input: CancelOrderRequest
    ): Promise<OrderResponse> {
      const order = await repo.findById(orderId, user.organizationId);
      if (!order) {
        throw new OrderNotFoundError(orderId);
      }

      if (user.role === "CUSTOMER") {
        if (order.customer_id !== user.id) {
          throw new OrderForbiddenError("You are not authorized to cancel this order.");
        }
        if (!canCustomerCancelOrder(order.status as OrderStatus)) {
          throw new OrderCancellationProhibitedError(order.status);
        }
      } else {
        if (!canOperatorCancelOrder(order.status as OrderStatus)) {
          throw new OrderCancellationProhibitedError(order.status);
        }
      }

      const now = new Date();
      const updated = await repo.update(orderId, user.organizationId, {
        status: "CANCELLED",
        cancelled_at: now,
        cancellation_reason: input.reason ?? (user.role === "CUSTOMER" ? "Cancelled by customer" : "Cancelled by operator"),
        cancelled_by_user_id: user.id
      });

      if (!updated) {
        throw new OrderNotFoundError(orderId);
      }

      if (outboxRepo) {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType: "ORDER_CANCELLED",
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "ORDER",
          aggregateId: orderId,
          actorId: user.id,
          payload: {
            orderNumber: updated.order_number,
            customerId: updated.customer_id,
            reason: input.reason ?? (user.role === "CUSTOMER" ? "Cancelled by customer" : "Cancelled by operator")
          }
        });
      }

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "ORDER_CANCELLED",
        resourceType: "order",
        resourceId: orderId,
        metadata: {
          previousStatus: order.status,
          reason: input.reason ?? null,
          cancelledByUserId: user.id
        }
      });

      return mapOrderRecordToResponse(updated);
    },

    async listOrders(user: AuthenticatedUser, query: OrderListQuery): Promise<OrderListResponse> {
      const customerId = user.role === "CUSTOMER" ? user.id : undefined;

      const { orders, total } = await repo.list({
        organizationId: user.organizationId,
        customerId,
        status: query.status,
        priority: query.priority,
        limit: query.limit,
        offset: query.offset
      });

      return {
        data: orders.map((o) => mapOrderRecordToResponse(o)),
        pagination: {
          total,
          limit: query.limit,
          offset: query.offset
        }
      };
    }
  };
}
