import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildApp } from "../../../app.js";
import { createMockAuthRepository } from "../../auth/tests/mock.repository.js";
import { createMockFleetRepository } from "./mock.repository.js";
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
  const fleetRepo = createMockFleetRepository();
  const auditService = createMockAuditService();
  const app = buildApp({ authRepo, fleetRepo, auditService });
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

  return { app, authRepo, fleetRepo, auditService, signToken };
}

const adminUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@alphanetics.test",
  name: "Alice Admin",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "ADMIN" as UserRole,
  permissions: ["drones:create", "drones:read", "drones:command", "fleet:manage"] as Permission[]
};

const customerUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "cust@alphanetics.test",
  name: "Bob Customer",
  organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organizationName: "Alpha Logistics",
  role: "CUSTOMER" as UserRole,
  permissions: ["orders:read", "orders:create", "orders:cancel"] as Permission[]
};

const otherOrgAdmin = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "admin@beta.test",
  name: "Charlie Admin",
  organizationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  organizationName: "Beta Logistics",
  role: "ADMIN" as UserRole,
  permissions: ["drones:create", "drones:read", "drones:command", "fleet:manage"] as Permission[]
};

const validDronePayload = {
  callSign: "SKY-001",
  model: "SkyNav Hexacopter Alpha",
  maxPayloadGrams: 5000,
  batteryPercent: 100,
  currentLocation: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 },
  homeLocation: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 }
};

describe("Fleet / HTTP API Behavioral Integration", () => {
  it("1. rejects unauthenticated and unauthorized customer fleet creation (1, 21)", async () => {
    const { app, signToken } = await setupTestApp();

    // Unauthenticated -> 401
    const unauthRes = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      payload: validDronePayload
    });
    assert.equal(unauthRes.statusCode, 401);

    // Customer role without drones:create -> 403
    const customerToken = signToken(customerUser);
    const custRes = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: validDronePayload
    });
    assert.equal(custRes.statusCode, 403);
    assert.equal(JSON.parse(custRes.body).code, "INSUFFICIENT_PERMISSIONS");
  });

  it("2. allows authorized admin to create drone in fleet inventory", async () => {
    const { app, signToken, auditService } = await setupTestApp();
    const token = signToken(adminUser);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${token}` },
      payload: validDronePayload
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.data.id);
    assert.equal(body.data.callSign, "SKY-001");
    assert.equal(body.data.organizationId, adminUser.organizationId);
    assert.equal(body.data.status, "IDLE");

    // Audit log check (24)
    assert.equal(auditService.logs.length, 1);
    assert.equal(auditService.logs[0].action, "DRONE_REGISTERED");
  });

  it("3. rejects invalid drone data (invalid coordinates, negative payload)", async () => {
    const { app, signToken } = await setupTestApp();
    const token = signToken(adminUser);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        ...validDronePayload,
        callSign: "SKY INVALID #!",
        maxPayloadGrams: -100
      }
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, "SCHEMA_VALIDATION_ERROR");
  });

  it("4, 5, 6. enforces organization isolation and prevents cross-tenant access and org spoofing", async () => {
    const { app, signToken } = await setupTestApp();
    const token1 = signToken(adminUser);
    const token2 = signToken(otherOrgAdmin);

    // Create drone in Org Alpha
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${token1}` },
      payload: validDronePayload
    });
    const droneId = JSON.parse(createRes.body).data.id;

    // Org Beta admin cannot retrieve Org Alpha's drone (6)
    const crossGet = await app.inject({
      method: "GET",
      url: `/api/v1/drones/${droneId}`,
      headers: { Authorization: `Bearer ${token2}` }
    });
    assert.equal(crossGet.statusCode, 404);

    // Header org spoofing attempt is rejected with 403 (5)
    const spoofRes = await app.inject({
      method: "GET",
      url: `/api/v1/drones/${droneId}`,
      headers: {
        Authorization: `Bearer ${token1}`,
        "x-organization-id": otherOrgAdmin.organizationId
      }
    });
    assert.equal(spoofRes.statusCode, 403);
    assert.equal(JSON.parse(spoofRes.body).code, "CROSS_TENANT_ACCESS_DENIED");
  });

  it("7. handles duplicate drone call sign within same organization (409)", async () => {
    const { app, signToken } = await setupTestApp();
    const token = signToken(adminUser);

    // Create first drone
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${token}` },
      payload: validDronePayload
    });
    assert.equal(res1.statusCode, 201);

    // Attempt to register duplicate call sign
    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/drones",
      headers: { Authorization: `Bearer ${token}` },
      payload: validDronePayload
    });
    assert.equal(res2.statusCode, 409);
    assert.equal(JSON.parse(res2.body).code, "DUPLICATE_DRONE_CALL_SIGN");
  });
});
