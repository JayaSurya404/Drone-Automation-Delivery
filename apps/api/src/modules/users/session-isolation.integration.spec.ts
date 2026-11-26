import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Phase 4 requirement:
 * E2E test proving that an admin login in one tab does not log out the customer in another tab.
 * Uses separate refresh cookie names (`skynav_customer_refresh_token` and `skynav_admin_refresh_token`).
 */
describe("Tab Session Isolation (E2E Integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const customerEmail = `customer-tab-${Date.now()}@example.com`;
  const adminEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL ?? "admin@skynav.local";
  const adminPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(NEST_APP_OPTIONS);
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: customerEmail } });
    await app.close();
  });

  function extractCookie(res: request.Response, name: string): string {
    const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
    if (!setCookie) throw new Error(`No cookies returned in response`);
    const cookie = setCookie.find((c) => c.startsWith(`${name}=`));
    if (!cookie) throw new Error(`Cookie ${name} not set in response`);
    return cookie.split(";")[0] ?? cookie;
  }

  it("proves customer and admin sessions are isolated across tabs on localhost", async () => {
    const server = app.getHttpServer();

    // 1. Customer registers in Tab 1
    const custRegisterRes = await request(server)
      .post("/api/v1/auth/register")
      .set("x-client-app", "customer")
      .send({ email: customerEmail, password: "Password123", firstName: "CustomerTab" });

    expect(custRegisterRes.status).toBe(201);
    const customerCookie = extractCookie(custRegisterRes, "skynav_customer_refresh_token");
    expect(customerCookie).toContain("skynav_customer_refresh_token=");

    // 2. Admin logs in in Tab 2
    const adminLoginRes = await request(server)
      .post("/api/v1/auth/login")
      .set("x-client-app", "admin")
      .send({ email: adminEmail, password: adminPassword });

    expect(adminLoginRes.status).toBe(200);
    const adminCookie = extractCookie(adminLoginRes, "skynav_admin_refresh_token");
    expect(adminCookie).toContain("skynav_admin_refresh_token=");

    // 3. Multi-tab state: both cookies are stored on localhost and sent in subsequent requests
    const multiTabCookieHeader = `${customerCookie}; ${adminCookie}`;

    // 4. Tab 2 (Admin) refreshes session with both cookies present
    const adminRefreshRes = await request(server)
      .post("/api/v1/auth/refresh")
      .set("x-client-app", "admin")
      .set("Cookie", multiTabCookieHeader);

    expect(adminRefreshRes.status).toBe(200);
    expect(adminRefreshRes.body.data.user.email).toBe(adminEmail);
    const rotatedAdminCookie = extractCookie(adminRefreshRes, "skynav_admin_refresh_token");

    // 5. Tab 1 (Customer) refreshes session with both cookies present
    // CRITICAL CHECK: Customer must NOT be logged out or invalidated by the admin's login/refresh!
    const customerRefreshRes = await request(server)
      .post("/api/v1/auth/refresh")
      .set("x-client-app", "customer")
      .set("Cookie", `${customerCookie}; ${rotatedAdminCookie}`);

    expect(customerRefreshRes.status).toBe(200);
    expect(customerRefreshRes.body.data.user.email).toBe(customerEmail);
    const rotatedCustCookie = extractCookie(customerRefreshRes, "skynav_customer_refresh_token");

    // 6. Admin logs out in Tab 2
    const adminLogoutRes = await request(server)
      .post("/api/v1/auth/logout")
      .set("x-client-app", "admin")
      .set("Cookie", `${rotatedCustCookie}; ${rotatedAdminCookie}`);

    expect(adminLogoutRes.status).toBe(204);

    // 7. Tab 1 (Customer) is STILL authenticated and can refresh successfully
    const custStillLoggedInRes = await request(server)
      .post("/api/v1/auth/refresh")
      .set("x-client-app", "customer")
      .set("Cookie", rotatedCustCookie);

    expect(custStillLoggedInRes.status).toBe(200);
    expect(custStillLoggedInRes.body.data.user.email).toBe(customerEmail);
  });

  it("proves customer session cannot refresh in admin app (x-client-app=admin rejects customer cookie)", async () => {
    const server = app.getHttpServer();
    const crossCustomerEmail = `cust-cross-${Date.now()}@example.com`;

    try {
      // 1. Customer registers and gets a customer refresh cookie
      const custRegisterRes = await request(server)
        .post("/api/v1/auth/register")
        .set("x-client-app", "customer")
        .send({ email: crossCustomerEmail, password: "Password123", firstName: "CustomerCross" });

      expect(custRegisterRes.status).toBe(201);
      const customerCookie = extractCookie(custRegisterRes, "skynav_customer_refresh_token");

      // 2. Client sends the customer refresh cookie to the admin app (x-client-app=admin)
      const crossAppRefreshRes = await request(server)
        .post("/api/v1/auth/refresh")
        .set("x-client-app", "admin")
        .set("Cookie", customerCookie);

      // 3. Must fail with 400 Bad Request — admin app reads ONLY skynav_admin_refresh_token
      expect(crossAppRefreshRes.status).toBe(400);
      expect(crossAppRefreshRes.body.error?.message || crossAppRefreshRes.body.message).toContain("No refresh session found");
    } finally {
      await prisma.user.deleteMany({ where: { email: crossCustomerEmail } });
    }
  });
});
