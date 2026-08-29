import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildApp } from "../../../app.js";
import { createMockAuthRepository } from "../../auth/tests/mock.repository.js";
import { createMockOrderRepository } from "./mock.repository.js";
import type { AuditService } from "../../audit/audit.service.js";
import type { UserRole, Permission } from "@skynav/contracts";

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

async function setupTestApp() {
  const authRepo = createMockAuthRepository();
  const orderRepo = createMockOrderRepository();
  const auditService = createMockAuditService();
  const app = buildApp({ authRepo, orderRepo, auditService });
  await app.ready();

  const signToken = (user: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    role: UserRole;
    permissions: Permission[];
  }) => {
    return app.jwt.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      orgId: user.organizationId,
      orgName: user.organizationName,
      role: user.role,
      permissions: user.permissions
    });
  };

  return { app, authRepo, orderRepo, auditService, signToken };
}

const customer1 = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "alice@customer.test",
  name: "Alice Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER" as UserRole,
  permissions: ["orders:create", "orders:read", "orders:cancel"] as Permission[]
};

const customer2 = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "bob@customer.test",
  name: "Bob Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER" as UserRole,
  permissions: ["orders:create", "orders:read", "orders:cancel"] as Permission[]
};

const tenant2Customer = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "eve@competitor.test",
  name: "Eve Competitor",
  organizationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  organizationName: "Beta Logistics",
  role: "CUSTOMER" as UserRole,
  permissions: ["orders:create", "orders:read", "orders:cancel"] as Permission[]
};

const operator = {
  id: "44444444-4444-4444-4444-444444444444",
  email: "dan@operator.test",
  name: "Dan Operator",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "OPERATOR" as UserRole,
  permissions: ["orders:read", "orders:update", "orders:cancel"] as Permission[]
};

const validOrderPayload = {
  pickup: {
    latitude: 37.7749,
    longitude: -122.4194,
    altitudeMeters: 10,
    address: "Depot A"
  },
  delivery: {
    latitude: 37.7833,
    longitude: -122.4167,
    altitudeMeters: 15,
    address: "Customer Pad 1"
  },
  package: {
    weightGrams: 500,
    lengthCm: 20,
    widthCm: 15,
    heightCm: 10,
    description: "Documents"
  },
  priority: "STANDARD",
  deliveryNotes: "Leave at reception"
};

describe("Orders / HTTP API Behavioral Integration", () => {
  it("1. rejects unauthenticated order creation with 401 ProblemDetails", async () => {
    const { app } = await setupTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      payload: validOrderPayload
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.code, "UNAUTHENTICATED");
    assert.equal(body.title, "Unauthorized");
  });

  it("2. allows authenticated authorized customer to create an order", async () => {
    const { app, auditService, signToken } = await setupTestApp();
    const token = signToken(customer1);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${token}` },
      payload: validOrderPayload
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.data.id);
    assert.ok(body.data.orderNumber.startsWith("ORD-"));
    assert.equal(body.data.customerId, customer1.id);
    assert.equal(body.data.organizationId, customer1.organizationId);
    assert.equal(body.data.status, "CREATED");
    assert.equal(body.data.package.weightGrams, 500);

    // Audit log check (17)
    assert.equal(auditService.logs.length, 1);
    assert.equal(auditService.logs[0].action, "ORDER_CREATED");
  });

  it("3. rejects invalid order input (invalid coordinates, negative package weight)", async () => {
    const { app, signToken } = await setupTestApp();
    const token = signToken(customer1);

    // Invalid latitude (> 90) and negative weight
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        ...validOrderPayload,
        pickup: {
          ...validOrderPayload.pickup,
          latitude: 95.0
        },
        package: {
          ...validOrderPayload.package,
          weightGrams: -50
        }
      }
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, "SCHEMA_VALIDATION_ERROR");
    assert.ok(body.errors.length >= 2);
  });

  it("4. retrieves valid order by ID", async () => {
    const { app, signToken } = await setupTestApp();
    const token = signToken(customer1);

    // Create order
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${token}` },
      payload: validOrderPayload
    });
    const orderId = JSON.parse(createRes.body).data.id;

    // Retrieve order
    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${orderId}`,
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(getRes.statusCode, 200);
    const getBody = JSON.parse(getRes.body);
    assert.equal(getBody.data.id, orderId);
  });

  it("5. prevents unauthorized customer from retrieving another customer's order", async () => {
    const { app, signToken } = await setupTestApp();
    const token1 = signToken(customer1);
    const token2 = signToken(customer2);

    // Customer 1 creates order
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${token1}` },
      payload: validOrderPayload
    });
    const orderId = JSON.parse(createRes.body).data.id;

    // Customer 2 attempts to retrieve Customer 1's order
    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${orderId}`,
      headers: { Authorization: `Bearer ${token2}` }
    });

    assert.equal(getRes.statusCode, 403);
    const body = JSON.parse(getRes.body);
    assert.equal(body.code, "ORDER_ACCESS_FORBIDDEN");
  });

  it("6. strictly rejects cross-tenant access and organization ID spoofing (6, 7, 8)", async () => {
    const { app, signToken } = await setupTestApp();
    const token1 = signToken(customer1);
    const tenant2Token = signToken(tenant2Customer);

    // Tenant 1 Customer creates order
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${token1}` },
      payload: validOrderPayload
    });
    const orderId = JSON.parse(createRes.body).data.id;

    // Tenant 2 Customer attempts to read Tenant 1 order
    const crossTenantGet = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${orderId}`,
      headers: { Authorization: `Bearer ${tenant2Token}` }
    });
    assert.equal(crossTenantGet.statusCode, 404); // Scoped repository query returns null -> 404

    // Header org spoofing attempt
    const spoofHeaderRes = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${orderId}`,
      headers: {
        Authorization: `Bearer ${token1}`,
        "x-organization-id": tenant2Customer.organizationId
      }
    });
    assert.equal(spoofHeaderRes.statusCode, 403);
    assert.equal(JSON.parse(spoofHeaderRes.body).code, "CROSS_TENANT_ACCESS_DENIED");
  });

  it("9 & 10 & 11. enforces RBAC and valid state transitions on PATCH /status", async () => {
    const { app, signToken } = await setupTestApp();
    const customerToken = signToken(customer1);
    const operatorToken = signToken(operator);

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: validOrderPayload
    });
    const orderId = JSON.parse(createRes.body).data.id;

    // 9. Customer cannot update status (403 INSUFFICIENT_PERMISSIONS)
    const customerPatch = await app.inject({
      method: "PATCH",
      url: `/api/v1/orders/${orderId}/status`,
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: { status: "CONFIRMED" }
    });
    assert.equal(customerPatch.statusCode, 403);

    // 10. Operator transitions CREATED -> CONFIRMED (200)
    const opConfirm = await app.inject({
      method: "PATCH",
      url: `/api/v1/orders/${orderId}/status`,
      headers: { Authorization: `Bearer ${operatorToken}` },
      payload: { status: "CONFIRMED" }
    });
    assert.equal(opConfirm.statusCode, 200);
    assert.equal(JSON.parse(opConfirm.body).data.status, "CONFIRMED");

    // 10. Operator transitions CONFIRMED -> ASSIGNED (200)
    const opAssign = await app.inject({
      method: "PATCH",
      url: `/api/v1/orders/${orderId}/status`,
      headers: { Authorization: `Bearer ${operatorToken}` },
      payload: { status: "ASSIGNED" }
    });
    assert.equal(opAssign.statusCode, 200);
    assert.equal(JSON.parse(opAssign.body).data.status, "ASSIGNED");

    // 11. Invalid transition ASSIGNED -> CREATED fails with 422
    const invalidTransition = await app.inject({
      method: "PATCH",
      url: `/api/v1/orders/${orderId}/status`,
      headers: { Authorization: `Bearer ${operatorToken}` },
      payload: { status: "CREATED" }
    });
    assert.equal(invalidTransition.statusCode, 422);
    assert.equal(JSON.parse(invalidTransition.body).code, "INVALID_ORDER_STATE_TRANSITION");
  });

  it("12 & 13. handles cancellation permissions and restrictions", async () => {
    const { app, signToken } = await setupTestApp();
    const customer1Token = signToken(customer1);
    const customer2Token = signToken(customer2);
    const operatorToken = signToken(operator);

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${customer1Token}` },
      payload: validOrderPayload
    });
    const orderId = JSON.parse(createRes.body).data.id;

    // 12. Non-owner customer cannot cancel Customer 1's order
    const badCancel = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/cancel`,
      headers: { Authorization: `Bearer ${customer2Token}` },
      payload: { reason: "Sneaky cancel" }
    });
    assert.equal(badCancel.statusCode, 403);

    // 13. Customer 1 successfully cancels own CREATED order
    const goodCancel = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/cancel`,
      headers: { Authorization: `Bearer ${customer1Token}` },
      payload: { reason: "Ordered by mistake" }
    });
    assert.equal(goodCancel.statusCode, 200);
    assert.equal(JSON.parse(goodCancel.body).data.status, "CANCELLED");

    // Cannot cancel again (already CANCELLED)
    const reCancel = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${orderId}/cancel`,
      headers: { Authorization: `Bearer ${operatorToken}` }
    });
    assert.equal(reCancel.statusCode, 422);
  });

  it("14 & 15. applies organization scoping and customer ownership rules on listing", async () => {
    const { app, signToken } = await setupTestApp();
    const c1Token = signToken(customer1);
    const c2Token = signToken(customer2);
    const opToken = signToken(operator);
    const t2Token = signToken(tenant2Customer);

    // Customer 1 creates 2 orders
    await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${c1Token}` },
      payload: validOrderPayload
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${c1Token}` },
      payload: validOrderPayload
    });

    // Customer 2 creates 1 order
    await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${c2Token}` },
      payload: validOrderPayload
    });

    // Tenant 2 Customer creates 1 order
    await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${t2Token}` },
      payload: validOrderPayload
    });

    // Customer 1 list: exactly 2 orders
    const c1ListRes = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${c1Token}` }
    });
    assert.equal(c1ListRes.statusCode, 200);
    const c1List = JSON.parse(c1ListRes.body);
    assert.equal(c1List.data.length, 2);
    assert.equal(c1List.pagination.total, 2);

    // Operator list: exactly 3 orders in Tenant 1 (Tenant 2 excluded)
    const opListRes = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
      headers: { Authorization: `Bearer ${opToken}` }
    });
    assert.equal(opListRes.statusCode, 200);
    const opList = JSON.parse(opListRes.body);
    assert.equal(opList.data.length, 3);
    assert.equal(opList.pagination.total, 3);
    for (const ord of opList.data) {
      assert.equal(ord.organizationId, customer1.organizationId);
    }
  });

  it("17 & 18. generates structured audit logs and follows RFC 7807 problem details error format", async () => {
    const { app, signToken } = await setupTestApp();
    const c1Token = signToken(customer1);

    // Malformed UUID request
    const badIdRes = await app.inject({
      method: "GET",
      url: "/api/v1/orders/invalid-uuid-format",
      headers: { Authorization: `Bearer ${c1Token}` }
    });

    assert.equal(badIdRes.statusCode, 400);
    const errBody = JSON.parse(badIdRes.body);
    assert.equal(errBody.type, "https://skynav.io/errors/validation");
    assert.equal(errBody.code, "SCHEMA_VALIDATION_ERROR");
    assert.ok(errBody.timestamp);
    assert.ok(errBody.errors);
  });
});
