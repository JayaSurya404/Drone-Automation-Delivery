import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { requireAuthenticated, requireRole, requirePermission } from "../rbac.js";
import type { AuthenticatedUser } from "@skynav/contracts";

describe("Auth / RBAC & Authorization Hooks", () => {
  it("requireAuthenticated rejects unauthenticated requests with 401", async () => {
    const fastify = Fastify();
    fastify.get("/protected", { preHandler: [requireAuthenticated] }, async () => ({ ok: true }));

    const response = await fastify.inject({ method: "GET", url: "/protected" });
    assert.equal(response.statusCode, 401);
    const body = JSON.parse(response.body);
    assert.equal(body.code, "UNAUTHENTICATED");
  });

  it("requireRole allows permitted role and rejects unauthorized role with 403", async () => {
    const fastify = Fastify();

    fastify.addHook("onRequest", async (request) => {
      // Simulate authenticated Operator
      request.user = {
        id: "11111111-1111-1111-1111-111111111111",
        email: "operator@skynav.test",
        name: "Operator",
        organizationId: "00000000-0000-0000-0000-000000000001",
        organizationName: "SkyNav",
        role: "OPERATOR",
        permissions: ["missions:authorize", "drones:command"]
      };
    });

    fastify.get("/admin-only", { preHandler: [requireRole("ADMIN")] }, async () => ({ ok: true }));
    fastify.get("/operator-or-admin", { preHandler: [requireRole(["ADMIN", "OPERATOR"])] }, async () => ({ ok: true }));

    const adminResponse = await fastify.inject({ method: "GET", url: "/admin-only" });
    assert.equal(adminResponse.statusCode, 403);
    const adminBody = JSON.parse(adminResponse.body);
    assert.equal(adminBody.code, "INSUFFICIENT_ROLE");

    const operatorResponse = await fastify.inject({ method: "GET", url: "/operator-or-admin" });
    assert.equal(operatorResponse.statusCode, 200);
  });

  it("requirePermission validates granular user permissions", async () => {
    const fastify = Fastify();

    fastify.addHook("onRequest", async (request) => {
      request.user = {
        id: "22222222-2222-2222-2222-222222222222",
        email: "customer@skynav.test",
        name: "Customer",
        organizationId: "00000000-0000-0000-0000-000000000001",
        organizationName: "SkyNav",
        role: "CUSTOMER",
        permissions: ["orders:read", "orders:create"]
      };
    });

    fastify.get("/orders", { preHandler: [requirePermission("orders:create")] }, async () => ({ ok: true }));
    fastify.get("/dispatch", { preHandler: [requirePermission("missions:command")] }, async () => ({ ok: true }));

    const allowed = await fastify.inject({ method: "GET", url: "/orders" });
    assert.equal(allowed.statusCode, 200);

    const forbidden = await fastify.inject({ method: "GET", url: "/dispatch" });
    assert.equal(forbidden.statusCode, 403);
    const body = JSON.parse(forbidden.body);
    assert.equal(body.code, "INSUFFICIENT_PERMISSIONS");
  });
});
