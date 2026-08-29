import type { FastifyPluginAsync } from "fastify";
import {
  createOrderRequestSchema,
  updateOrderStatusRequestSchema,
  cancelOrderRequestSchema,
  orderListQuerySchema,
  uuidSchema
} from "@skynav/contracts";
import type { OrderService } from "./order.service.js";
import { requireAuthenticated, requirePermission } from "../auth/rbac.js";
import { requireTenantIsolation } from "../tenant/tenant.guard.js";

export function createOrderRoutes(orderService: OrderService): FastifyPluginAsync {
  return async function orderRoutes(app) {
    // ------------------------------------------------------------------------
    // POST /api/v1/orders: Create a new delivery order
    // ------------------------------------------------------------------------
    app.post(
      "/api/v1/orders",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("orders:create")
        ]
      },
      async (request, reply) => {
        const body = createOrderRequestSchema.parse(request.body);
        const order = await orderService.createOrder(request.user!, body);
        return reply.status(201).send({ data: order });
      }
    );

    // ------------------------------------------------------------------------
    // GET /api/v1/orders: List orders (scoped by organization & ownership)
    // ------------------------------------------------------------------------
    app.get(
      "/api/v1/orders",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("orders:read")
        ]
      },
      async (request, reply) => {
        const query = orderListQuerySchema.parse(request.query);
        const result = await orderService.listOrders(request.user!, query);
        return reply.status(200).send(result);
      }
    );

    // ------------------------------------------------------------------------
    // GET /api/v1/orders/:orderId: Retrieve single order by ID
    // ------------------------------------------------------------------------
    app.get<{ Params: { orderId: string } }>(
      "/api/v1/orders/:orderId",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("orders:read")
        ]
      },
      async (request, reply) => {
        const orderId = uuidSchema.parse(request.params.orderId);
        const order = await orderService.getOrder(request.user!, orderId);
        return reply.status(200).send({ data: order });
      }
    );

    // ------------------------------------------------------------------------
    // PATCH /api/v1/orders/:orderId/status: Operational status update
    // ------------------------------------------------------------------------
    app.patch<{ Params: { orderId: string } }>(
      "/api/v1/orders/:orderId/status",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("orders:update")
        ]
      },
      async (request, reply) => {
        const orderId = uuidSchema.parse(request.params.orderId);
        const body = updateOrderStatusRequestSchema.parse(request.body);
        const order = await orderService.updateOrderStatus(request.user!, orderId, body);
        return reply.status(200).send({ data: order });
      }
    );

    // ------------------------------------------------------------------------
    // POST /api/v1/orders/:orderId/cancel: Order cancellation
    // ------------------------------------------------------------------------
    app.post<{ Params: { orderId: string } }>(
      "/api/v1/orders/:orderId/cancel",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("orders:cancel")
        ]
      },
      async (request, reply) => {
        const orderId = uuidSchema.parse(request.params.orderId);
        const body = cancelOrderRequestSchema.parse(request.body ?? {});
        const order = await orderService.cancelOrder(request.user!, orderId, body);
        return reply.status(200).send({ data: order });
      }
    );
  };
}
