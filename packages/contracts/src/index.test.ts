import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  registerRequestSchema,
  loginRequestSchema,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  roleHasPermission,
  problemDetailsSchema
} from "./index.js";

describe("Contracts / Authentication & RBAC Schemas", () => {
  it("validates valid registration request", () => {
    const valid = {
      email: "operator@skynav.test",
      password: "StrongPassword123!",
      name: "John Operator",
      organizationName: "SkyNav West"
    };
    const parsed = registerRequestSchema.parse(valid);
    assert.equal(parsed.email, "operator@skynav.test");
  });

  it("rejects weak password on registration", () => {
    assert.throws(() => {
      registerRequestSchema.parse({
        email: "test@example.com",
        password: "short"
      });
    });
  });

  it("validates login request with optional orgId", () => {
    const login = {
      email: "admin@skynav.test",
      password: "Password123!",
      organizationId: "11111111-1111-1111-1111-111111111111"
    };
    const parsed = loginRequestSchema.parse(login);
    assert.equal(parsed.organizationId, "11111111-1111-1111-1111-111111111111");
  });

  it("checks RBAC permissions correctly", () => {
    assert.ok(roleHasPermission("ADMIN", "missions:authorize"));
    assert.ok(roleHasPermission("ADMIN", "audit:read"));
    assert.ok(roleHasPermission("OPERATOR", "missions:command"));
    assert.ok(!roleHasPermission("CUSTOMER", "missions:authorize"));
    assert.ok(roleHasPermission("CUSTOMER", "orders:create"));

    const operatorPerms = getPermissionsForRole("OPERATOR");
    assert.ok(operatorPerms.includes("missions:authorize"));
    assert.ok(!operatorPerms.includes("org:manage" as any));
  });

  it("validates RFC 7807 problem details envelope", () => {
    const problem = {
      type: "https://skynav.io/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid credentials provided.",
      timestamp: new Date().toISOString(),
      code: "INVALID_CREDENTIALS"
    };
    const parsed = problemDetailsSchema.parse(problem);
    assert.equal(parsed.status, 401);
  });
});
