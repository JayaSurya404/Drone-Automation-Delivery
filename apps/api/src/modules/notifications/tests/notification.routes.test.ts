import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildApp } from "../../../app.js";
import { createMockAuthRepository } from "../../auth/tests/mock.repository.js";
import { createMockNotificationRepository } from "./mock.repository.js";
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
  const notificationRepo = createMockNotificationRepository();
  const auditService = createMockAuditService();
  const app = buildApp({ authRepo, notificationRepo, auditService });
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

  return { app, authRepo, notificationRepo, auditService, signToken };
}

const customer1 = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "alice@customer.test",
  name: "Alice Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER" as UserRole,
  permissions: ["orders:read", "notifications:read"] as Permission[]
};

const customer2 = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "bob@customer.test",
  name: "Bob Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER" as UserRole,
  permissions: ["orders:read", "notifications:read"] as Permission[]
};

const operator1 = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "ops@alpha.test",
  name: "Dan Operator",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "OPERATOR" as UserRole,
  permissions: ["orders:read", "missions:read", "notifications:read", "notifications:manage"] as Permission[]
};

const alienCustomer = {
  id: "44444444-4444-4444-4444-444444444444",
  email: "alien@beta.test",
  name: "Alien Customer",
  organizationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  organizationName: "Beta Logistics",
  role: "CUSTOMER" as UserRole,
  permissions: ["orders:read", "notifications:read"] as Permission[]
};

describe("Notifications API Routes / End-to-End Tests", () => {
  it("GET /api/v1/notifications requires authentication (21)", async () => {
    const { app } = await setupTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/notifications"
    });

    assert.equal(response.statusCode, 401);
  });

  it("GET /api/v1/notifications lists user notifications with unread count and pagination (22)", async () => {
    const { app, notificationRepo, signToken } = await setupTestApp();
    const token = signToken(customer1);

    // Seed 2 notifications for customer 1
    await notificationRepo.create({
      id: crypto.randomUUID(),
      organizationId: customer1.organizationId,
      userId: customer1.id,
      type: "ORDER_UPDATE",
      severity: "INFO",
      title: "Order Placed",
      message: "Order placed successfully."
    });

    await notificationRepo.create({
      id: crypto.randomUUID(),
      organizationId: customer1.organizationId,
      userId: customer1.id,
      type: "DELIVERY_UPDATE",
      severity: "SUCCESS",
      title: "Delivered",
      message: "Touchdown confirmed."
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 2);
    assert.equal(body.unreadCount, 2);
    assert.equal(body.pagination.total, 2);
  });

  it("GET /api/v1/notifications enforces customer recipient isolation (23, 24)", async () => {
    const { app, notificationRepo, signToken } = await setupTestApp();

    // Notification for customer 1
    await notificationRepo.create({
      id: crypto.randomUUID(),
      organizationId: customer1.organizationId,
      userId: customer1.id,
      type: "ORDER_UPDATE",
      severity: "INFO",
      title: "Customer 1 Only",
      message: "Private order details"
    });

    // Notification for customer 2
    await notificationRepo.create({
      id: crypto.randomUUID(),
      organizationId: customer2.organizationId,
      userId: customer2.id,
      type: "ORDER_UPDATE",
      severity: "INFO",
      title: "Customer 2 Only",
      message: "Private order details"
    });

    // Customer 1 request
    const res1 = await app.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: { authorization: `Bearer ${signToken(customer1)}` }
    });
    const body1 = res1.json();
    assert.equal(body1.data.length, 1);
    assert.equal(body1.data[0].title, "Customer 1 Only");

    // Operator request: sees both notifications in the organization
    const resOps = await app.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: { authorization: `Bearer ${signToken(operator1)}` }
    });
    const bodyOps = resOps.json();
    assert.equal(bodyOps.data.length, 2);
  });

  it("PATCH /api/v1/notifications/:id/read and PATCH /api/v1/notifications/read-all (25, 26)", async () => {
    const { app, notificationRepo, signToken } = await setupTestApp();
    const token = signToken(customer1);

    const notif = await notificationRepo.create({
      id: crypto.randomUUID(),
      organizationId: customer1.organizationId,
      userId: customer1.id,
      type: "ORDER_UPDATE",
      severity: "INFO",
      title: "Order Update",
      message: "Processing order."
    });

    // Mark single notification as read
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/notifications/${notif.id}/read`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(patchRes.statusCode, 200);
    const patchBody = patchRes.json();
    assert.equal(patchBody.isRead, true);

    // Create another unread notification
    await notificationRepo.create({
      id: crypto.randomUUID(),
      organizationId: customer1.organizationId,
      userId: customer1.id,
      type: "DELIVERY_UPDATE",
      severity: "INFO",
      title: "Approaching",
      message: "UAV approaching."
    });

    // Mark all as read
    const readAllRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/notifications/read-all",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(readAllRes.statusCode, 200);
    const readAllBody = readAllRes.json();
    assert.equal(readAllBody.success, true);
    assert.equal(readAllBody.updatedCount, 1);
  });

  it("Enforces multi-tenant boundary: Tenant A cannot view or modify Tenant B's notifications (27, 28)", async () => {
    const { app, notificationRepo, signToken } = await setupTestApp();

    const notifOrg1 = await notificationRepo.create({
      id: crypto.randomUUID(),
      organizationId: customer1.organizationId,
      userId: customer1.id,
      type: "ORDER_UPDATE",
      severity: "INFO",
      title: "Org 1 Notification",
      message: "Secret org 1 info"
    });

    // Alien customer in Org 2 attempts to fetch Org 1 notification
    const resGet = await app.inject({
      method: "GET",
      url: `/api/v1/notifications/${notifOrg1.id}`,
      headers: { authorization: `Bearer ${signToken(alienCustomer)}` }
    });
    assert.equal(resGet.statusCode, 404);

    // Alien customer in Org 2 attempts to mark Org 1 notification read
    const resPatch = await app.inject({
      method: "PATCH",
      url: `/api/v1/notifications/${notifOrg1.id}/read`,
      headers: { authorization: `Bearer ${signToken(alienCustomer)}` }
    });
    assert.equal(resPatch.statusCode, 404);
  });
});
