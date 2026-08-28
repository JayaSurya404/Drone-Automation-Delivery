import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../../app.js";
import { createMockAuthRepository } from "../../auth/tests/mock.repository.js";
import { requireTenantIsolation } from "../tenant.guard.js";
import { requireAuthenticated } from "../../auth/rbac.js";
import type { AuditService } from "../../audit/audit.service.js";

function createMockAuditService(): AuditService {
  const logs: any[] = [];
  return {
    async log(params) {
      logs.push({
        id: `log-${Date.now()}-${Math.random()}`,
        organization_id: params.organizationId,
        actor_user_id: params.actorUserId ?? null,
        action: params.action,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        metadata: params.metadata ?? null,
        correlation_id: params.correlationId ?? null,
        created_at: new Date()
      });
    },
    async list(orgId) {
      return logs.filter((l) => l.organization_id === orgId);
    }
  };
}

describe("Tenant Isolation / Security Boundary", () => {
  it("strictly prohibits cross-organization access", async () => {
    const authRepo = createMockAuthRepository();
    const auditService = createMockAuditService();
    const app = buildApp({ authRepo, auditService });

    // Register a tenant-scoped test route BEFORE making any requests
    app.get(
      "/api/v1/organizations/:orgId/fleet",
      {
        preHandler: [requireAuthenticated, requireTenantIsolation]
      },
      async (req) => {
        return { fleet: [`Drone belonging to ${(req.params as any).orgId}`] };
      }
    );

    // Register User 1 in Org A
    const resA = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "alice@company-a.test",
        password: "Password123!",
        name: "Alice",
        organizationName: "Company Alpha"
      }
    });
    const bodyA = JSON.parse(resA.body);
    const tokenA = bodyA.accessToken;
    const orgIdA = bodyA.organization.id;

    // Register User 2 in Org B
    const resB = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "bob@company-b.test",
        password: "Password123!",
        name: "Bob",
        organizationName: "Company Beta"
      }
    });
    const bodyB = JSON.parse(resB.body);
    const orgIdB = bodyB.organization.id;

    // 1. User A accessing Org A route -> MUST SUCCEED (200)
    const accessOwn = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${orgIdA}/fleet`,
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(accessOwn.statusCode, 200);

    // 2. User A accessing Org B route -> MUST BE REJECTED (403 CROSS_TENANT_ACCESS_DENIED)
    const accessOther = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${orgIdB}/fleet`,
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(accessOther.statusCode, 403);
    const errorBody = JSON.parse(accessOther.body);
    assert.equal(errorBody.code, "CROSS_TENANT_ACCESS_DENIED");
  });

  it("ensures audit logs are scoped strictly by authenticated tenant", async () => {
    const authRepo = createMockAuthRepository();
    const auditService = createMockAuditService();
    const app = buildApp({ authRepo, auditService });

    // Register User A (Org A)
    const resA = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "admin_a@tenant-a.test",
        password: "Password123!",
        organizationName: "Tenant A"
      }
    });
    const tokenA = JSON.parse(resA.body).accessToken;

    // Register User B (Org B)
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "admin_b@tenant-b.test",
        password: "Password123!",
        organizationName: "Tenant B"
      }
    });

    // User A fetches audit logs -> MUST only see Tenant A logs
    const auditResponseA = await app.inject({
      method: "GET",
      url: "/api/v1/audit-logs",
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert.equal(auditResponseA.statusCode, 200);
    const logsA = JSON.parse(auditResponseA.body).data;
    assert.ok(logsA.length > 0);

    for (const log of logsA) {
      assert.equal(
        log.organization_id,
        JSON.parse(resA.body).organization.id,
        "Every returned audit log must belong strictly to Tenant A"
      );
    }
  });
});
