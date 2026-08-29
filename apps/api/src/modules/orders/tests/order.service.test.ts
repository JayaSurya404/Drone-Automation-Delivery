import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createOrderService, OrderNotFoundError, OrderForbiddenError, OrderCancellationProhibitedError } from "../order.service.js";
import { createMockOrderRepository } from "./mock.repository.js";
import type { AuditService } from "../../audit/audit.service.js";
import type { AuthenticatedUser, CreateOrderRequest } from "@skynav/contracts";

function createMockAuditService(): AuditService & { logs: any[] } {
  const logs: any[] = [];
  return {
    logs,
    async log(params) {
      logs.push({ id: crypto.randomUUID(), ...params, created_at: new Date() });
    },
    async list(orgId) {
      return logs.filter((l) => l.organizationId === orgId);
    }
  };
}

const customerUser: AuthenticatedUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "customer@skynav.test",
  name: "Alice Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER",
  permissions: ["orders:create", "orders:read", "orders:cancel"]
};

const otherCustomerUser: AuthenticatedUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "other@skynav.test",
  name: "Bob Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER",
  permissions: ["orders:create", "orders:read", "orders:cancel"]
};

const operatorUser: AuthenticatedUser = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "operator@skynav.test",
  name: "Charlie Operator",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "OPERATOR",
  permissions: ["orders:read", "orders:update", "orders:cancel"]
};

const sampleOrderInput: CreateOrderRequest = {
  pickup: {
    latitude: 37.7749,
    longitude: -122.4194,
    altitudeMeters: 10,
    address: "Hub Alpha, 100 Flight Path"
  },
  delivery: {
    latitude: 37.7833,
    longitude: -122.4167,
    altitudeMeters: 15,
    address: "Customer Pad, 200 Mission St"
  },
  package: {
    weightGrams: 850,
    lengthCm: 25,
    widthCm: 20,
    heightCm: 15,
    description: "Urgent Medical Supplies"
  },
  priority: "EXPRESS",
  deliveryNotes: "Deliver to rooftop landing pad B"
};

describe("Orders / Service Logic & Customer Ownership", () => {
  it("creates an order with server-side customer and organization context", async () => {
    const repo = createMockOrderRepository();
    const auditService = createMockAuditService();
    const service = createOrderService(repo, auditService);

    const order = await service.createOrder(customerUser, sampleOrderInput);

    assert.ok(order.id);
    assert.ok(order.orderNumber.startsWith("ORD-"));
    assert.equal(order.organizationId, customerUser.organizationId);
    assert.equal(order.customerId, customerUser.id);
    assert.equal(order.status, "CREATED");
    assert.equal(order.priority, "EXPRESS");
    assert.equal(order.package.weightGrams, 850);
    assert.equal(order.pickup.latitude, 37.7749);
    assert.equal(order.delivery.longitude, -122.4167);

    // Verify audit log entry
    assert.equal(auditService.logs.length, 1);
    assert.equal(auditService.logs[0].action, "ORDER_CREATED");
    assert.equal(auditService.logs[0].resourceId, order.id);
  });

  it("allows customer to retrieve their own order and prevents other customer retrieval", async () => {
    const repo = createMockOrderRepository();
    const auditService = createMockAuditService();
    const service = createOrderService(repo, auditService);

    const order = await service.createOrder(customerUser, sampleOrderInput);

    // Customer can retrieve their own order
    const retrieved = await service.getOrder(customerUser, order.id);
    assert.equal(retrieved.id, order.id);

    // Other customer is forbidden
    await assert.rejects(
      async () => service.getOrder(otherCustomerUser, order.id),
      (err: any) => err instanceof OrderForbiddenError && err.code === "ORDER_ACCESS_FORBIDDEN"
    );

    // Operator can retrieve any order in their organization
    const operatorRetrieved = await service.getOrder(operatorUser, order.id);
    assert.equal(operatorRetrieved.id, order.id);
  });

  it("enforces RBAC on status updates (customer cannot update, operator can)", async () => {
    const repo = createMockOrderRepository();
    const auditService = createMockAuditService();
    const service = createOrderService(repo, auditService);

    const order = await service.createOrder(customerUser, sampleOrderInput);

    // Customer status update rejected
    await assert.rejects(
      async () => service.updateOrderStatus(customerUser, order.id, { status: "CONFIRMED" }),
      (err: any) => err instanceof OrderForbiddenError
    );

    // Operator status update allowed
    const confirmed = await service.updateOrderStatus(operatorUser, order.id, { status: "CONFIRMED" });
    assert.equal(confirmed.status, "CONFIRMED");
    assert.ok(confirmed.confirmedAt);

    // Next legal transition: ASSIGNED
    const assigned = await service.updateOrderStatus(operatorUser, order.id, { status: "ASSIGNED" });
    assert.equal(assigned.status, "ASSIGNED");
    assert.ok(assigned.assignedAt);
  });

  it("handles cancellation rules correctly for customer and operator", async () => {
    const repo = createMockOrderRepository();
    const auditService = createMockAuditService();
    const service = createOrderService(repo, auditService);

    // 1. Customer cancels their own CREATED order
    const order1 = await service.createOrder(customerUser, sampleOrderInput);
    const cancelled1 = await service.cancelOrder(customerUser, order1.id, { reason: "Changed mind" });
    assert.equal(cancelled1.status, "CANCELLED");
    assert.equal(cancelled1.cancellationReason, "Changed mind");
    assert.equal(cancelled1.cancelledByUserId, customerUser.id);

    // 2. Customer cannot cancel an already ASSIGNED or IN_TRANSIT order
    const order2 = await service.createOrder(customerUser, sampleOrderInput);
    await service.updateOrderStatus(operatorUser, order2.id, { status: "CONFIRMED" });
    await service.updateOrderStatus(operatorUser, order2.id, { status: "ASSIGNED" });

    await assert.rejects(
      async () => service.cancelOrder(customerUser, order2.id, { reason: "Too late" }),
      (err: any) => err instanceof OrderCancellationProhibitedError
    );

    // 3. Operator can cancel the ASSIGNED order with operational reason
    const operatorCancelled = await service.cancelOrder(operatorUser, order2.id, { reason: "Severe weather hold" });
    assert.equal(operatorCancelled.status, "CANCELLED");
    assert.equal(operatorCancelled.cancellationReason, "Severe weather hold");
  });

  it("applies customer ownership filtering when listing orders", async () => {
    const repo = createMockOrderRepository();
    const auditService = createMockAuditService();
    const service = createOrderService(repo, auditService);

    // Create 2 orders for customerUser, 1 for otherCustomerUser
    await service.createOrder(customerUser, sampleOrderInput);
    await service.createOrder(customerUser, sampleOrderInput);
    await service.createOrder(otherCustomerUser, sampleOrderInput);

    // customerUser sees only their 2 orders
    const customerList = await service.listOrders(customerUser, { limit: 10, offset: 0 });
    assert.equal(customerList.data.length, 2);
    assert.equal(customerList.pagination.total, 2);
    for (const ord of customerList.data) {
      assert.equal(ord.customerId, customerUser.id);
    }

    // Operator sees all 3 orders in the organization
    const operatorList = await service.listOrders(operatorUser, { limit: 10, offset: 0 });
    assert.equal(operatorList.data.length, 3);
    assert.equal(operatorList.pagination.total, 3);
  });
});
