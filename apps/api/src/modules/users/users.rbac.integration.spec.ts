import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { RbacService } from "../rbac/rbac.service";

/**
 * Proves the Phase 2 completion criterion: unauthorized access to /users is
 * rejected for every non-Super-Admin role, and allowed for Super Admin.
 * Tokens are minted directly (not via POST /auth/login) so this suite is
 * independent of the login-endpoint rate limit. Run via `pnpm test:integration`.
 */
describe("GET /users RBAC enforcement (integration)", () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let rbacService: RbacService;

  const ALL_ROLES = [
    "guest",
    "customer",
    "catalog_manager",
    "order_support_agent",
    "delivery_coordinator",
    "fleet_manager",
    "drone_operator",
    "compliance_safety_officer",
    "analyst",
    "system_service_account",
  ];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(NEST_APP_OPTIONS);
    configureApp(app);
    await app.init();
    jwtService = app.get(JwtService);
    rbacService = app.get(RbacService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function tokenFor(roleName: string): Promise<string> {
    const permissions = await rbacService.resolvePermissions([roleName]);
    return jwtService.signAsync({
      sub: `test-${roleName}`,
      email: `${roleName}@example.com`,
      roles: [roleName],
      permissions,
    });
  }

  it("rejects an unauthenticated request", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/users");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it.each(ALL_ROLES)("rejects %s (lacks users.read)", async (roleName) => {
    const token = await tokenFor(roleName);
    const res = await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("allows super_admin (has users.read)", async () => {
    const token = await tokenFor("super_admin");
    const res = await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.users)).toBe(true);
  });

  it("rejects a syntactically valid but unsigned/garbage token", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
