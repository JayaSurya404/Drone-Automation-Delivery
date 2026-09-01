import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../../app.js";
import { createMockAuthRepository } from "./mock.repository.js";
import type { AuditService } from "../../audit/audit.service.js";

function createMockAuditService(): AuditService {
  const logs: any[] = [];
  return {
    async log(params) {
      logs.push({ id: `log-${Date.now()}`, ...params, created_at: new Date() });
    },
    async list(orgId) {
      return logs.filter((l) => l.organization_id === orgId);
    }
  };
}

describe("Auth / HTTP Integration & Lifecycle", () => {
  it("registers a new customer successfully with CUSTOMER role", async () => {
    const authRepo = createMockAuthRepository();
    const auditService = createMockAuditService();
    const app = buildApp({ authRepo, auditService });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "customer@skynav.test",
        password: "Password123!",
        name: "SkyNav Customer",
        organizationName: "SkyNav Alpha Workspace"
      }
    });

    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.equal(body.user.email, "customer@skynav.test");
    assert.equal(body.user.name, "SkyNav Customer");
    assert.equal(body.organization.name, "SkyNav Alpha Workspace");
    assert.equal(body.organization.role, "CUSTOMER");
    assert.ok(body.accessToken, "Access token must be returned");
    assert.ok(body.refreshToken, "Refresh token must be returned");
    assert.equal(body.tokenType, "Bearer");
    assert.equal(body.expiresIn, 900);
    // Customer must NOT have admin/operator permissions
    assert.ok(!body.permissions.includes("missions:authorize"));
    assert.ok(body.permissions.includes("orders:create"));
  });

  it("rejects attempt to register with reserved administrator email", async () => {
    const authRepo = createMockAuthRepository();
    const app = buildApp({ authRepo, auditService: createMockAuditService() });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "admin@skynav.test",
        password: "Password123!"
      }
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.code, "RESERVED_IDENTIFIER");
  });

  it("rejects attempt to elevate role to ADMIN via registration payload", async () => {
    const authRepo = createMockAuthRepository();
    const app = buildApp({ authRepo, auditService: createMockAuditService() });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "hacker@skynav.test",
        password: "Password123!",
        role: "ADMIN"
      }
    });

    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.equal(body.organization.role, "CUSTOMER");
    assert.ok(!body.permissions.includes("missions:authorize"));
  });

  it("rejects duplicate email registration with 409 Conflict", async () => {
    const authRepo = createMockAuthRepository();
    const auditService = createMockAuditService();
    const app = buildApp({ authRepo, auditService });

    // First registration
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "duplicate@skynav.test",
        password: "Password123!"
      }
    });

    // Duplicate registration attempt
    const dupResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "duplicate@skynav.test",
        password: "Password123!"
      }
    });

    assert.equal(dupResponse.statusCode, 409);
    const body = JSON.parse(dupResponse.body);
    assert.equal(body.code, "EMAIL_ALREADY_EXISTS");
  });

  it("rejects registration with weak password with 400 Bad Request", async () => {
    const authRepo = createMockAuthRepository();
    const app = buildApp({ authRepo, auditService: createMockAuditService() });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "weak@skynav.test",
        password: "weak"
      }
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.code, "SCHEMA_VALIDATION_ERROR");
  });

  it("authenticates configured single administrator and rejects invalid admin password", async () => {
    const authRepo = createMockAuthRepository();
    const auditService = createMockAuditService();
    const app = buildApp({ authRepo, auditService });

    // Valid admin login via server-configured credentials
    const validAdmin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "admin@skynav.test",
        password: "Password123!"
      }
    });
    assert.equal(validAdmin.statusCode, 200);
    const adminBody = JSON.parse(validAdmin.body);
    assert.equal(adminBody.organization.role, "ADMIN");
    assert.ok(adminBody.permissions.includes("missions:authorize"));
    assert.ok(adminBody.permissions.includes("audit:read"));

    // Also supports "admin" username
    const validAdminUsername = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "admin",
        password: "Password123!"
      }
    });
    assert.equal(validAdminUsername.statusCode, 200);

    // Invalid admin password
    const badAdminPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "admin@skynav.test",
        password: "WrongPassword!"
      }
    });
    assert.equal(badAdminPassword.statusCode, 401);
    assert.equal(JSON.parse(badAdminPassword.body).code, "INVALID_CREDENTIALS");
  });

  it("authenticates customer credentials and rejects invalid customer password", async () => {
    const authRepo = createMockAuthRepository();
    const auditService = createMockAuditService();
    const app = buildApp({ authRepo, auditService });

    // Register customer
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "client@skynav.test",
        password: "Password123!",
        name: "Client User"
      }
    });

    // Valid customer login
    const validLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "client@skynav.test",
        password: "Password123!"
      }
    });
    assert.equal(validLogin.statusCode, 200);
    const loginBody = JSON.parse(validLogin.body);
    assert.equal(loginBody.organization.role, "CUSTOMER");
    assert.ok(!loginBody.permissions.includes("missions:authorize"));

    // Invalid password
    const badPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "client@skynav.test",
        password: "WrongPassword!"
      }
    });
    assert.equal(badPassword.statusCode, 401);
    assert.equal(JSON.parse(badPassword.body).code, "INVALID_CREDENTIALS");

    // Non-existent email
    const badEmail = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "nonexistent@skynav.test",
        password: "Password123!"
      }
    });
    assert.equal(badEmail.statusCode, 401);
    assert.equal(JSON.parse(badEmail.body).code, "INVALID_CREDENTIALS");
  });

  it("rotates refresh token on refresh and revokes old token", async () => {
    const authRepo = createMockAuthRepository();
    const auditService = createMockAuditService();
    const app = buildApp({ authRepo, auditService });

    const regResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "rotator@skynav.test",
        password: "Password123!"
      }
    });
    const regBody = JSON.parse(regResponse.body);
    const initialRefreshToken = regBody.refreshToken;

    // Refresh token request
    const refreshResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: {
        refreshToken: initialRefreshToken
      }
    });

    assert.equal(refreshResponse.statusCode, 200);
    const refreshBody = JSON.parse(refreshResponse.body);
    assert.ok(refreshBody.accessToken);
    assert.ok(refreshBody.refreshToken);
    assert.notEqual(refreshBody.refreshToken, initialRefreshToken, "Refresh token must be rotated");

    // Trying to use the OLD refresh token must fail with reuse detection
    const reuseAttempt = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: {
        refreshToken: initialRefreshToken
      }
    });
    assert.equal(reuseAttempt.statusCode, 401);
    assert.equal(JSON.parse(reuseAttempt.body).code, "REFRESH_TOKEN_REUSED");
  });

  it("authenticates protected endpoint /api/v1/auth/me", async () => {
    const authRepo = createMockAuthRepository();
    const app = buildApp({ authRepo, auditService: createMockAuditService() });

    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "me@skynav.test",
        password: "Password123!",
        name: "Profile User"
      }
    });
    const token = JSON.parse(reg.body).accessToken;

    // Call /me with token
    const meResponse = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    assert.equal(meResponse.statusCode, 200);
    const meBody = JSON.parse(meResponse.body);
    assert.equal(meBody.data.email, "me@skynav.test");
    assert.equal(meBody.data.name, "Profile User");

    // Call /me without token
    const unauthResponse = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me"
    });
    assert.equal(unauthResponse.statusCode, 401);
  });
});
