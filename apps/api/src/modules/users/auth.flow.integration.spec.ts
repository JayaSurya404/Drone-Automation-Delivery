import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { generateOpaqueToken, hashToken } from "../../common/security/token.util";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Proves the full Phase 2 round trip against real Postgres/Redis:
 * register -> verify email -> login -> refresh (rotation) -> logout ->
 * refresh again (must fail, session revoked). Run via `pnpm test:integration`.
 */
describe("Auth flow (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testEmail = `auth-flow-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(NEST_APP_OPTIONS);
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  function extractRefreshCookie(res: request.Response): string {
    const setCookie = res.headers["set-cookie"] as unknown as string[];
    const cookie = setCookie?.find((c) => c.includes("refresh_token="));
    if (!cookie) throw new Error("refresh cookie not set");
    return cookie.split(";")[0] ?? cookie;
  }

  it("registers a new customer and issues tokens", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: testEmail, password: "Password123", firstName: "Test" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.isEmailVerified).toBe(false);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(extractRefreshCookie(res)).toContain("refresh_token=");
  });

  it("rejects a duplicate registration", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: testEmail, password: "Password123" });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("verifies the email using a token in the shape the service issues", async () => {
    const rawToken = generateOpaqueToken();
    await prisma.user.update({
      where: { email: testEmail },
      data: {
        emailVerificationTokenHash: hashToken(rawToken),
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    // Phase 12: POST-with-body now, not a token-bearing query string.
    const res = await request(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token: rawToken });
    expect(res.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    expect(user.isEmailVerified).toBe(true);
  });

  it("logs in with the correct password and rejects the wrong one", async () => {
    const bad = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: "WrongPassword1" });
    expect(bad.status).toBe(401);
    expect(bad.body.success).toBe(false);

    const good = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: "Password123" });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toEqual(expect.any(String));
  });

  it("round-trips register -> refresh (rotation) -> reuse rejection -> logout -> refresh rejected", async () => {
    const server = app.getHttpServer();
    const loginRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: "Password123" });
    const firstCookie = extractRefreshCookie(loginRes);

    // Rotation: refreshing with a valid token succeeds and issues a new one.
    const refreshRes = await request(server).post("/api/v1/auth/refresh").set("Cookie", firstCookie);
    expect(refreshRes.status).toBe(200);
    const secondCookie = extractRefreshCookie(refreshRes);
    expect(secondCookie).not.toBe(firstCookie);

    // Reuse detection: the now-rotated-out first token is rejected.
    const reuseRes = await request(server).post("/api/v1/auth/refresh").set("Cookie", firstCookie);
    expect(reuseRes.status).toBe(401);

    // Reuse detection revoked the whole family, so even the latest token is now dead.
    const afterReuseRes = await request(server).post("/api/v1/auth/refresh").set("Cookie", secondCookie);
    expect(afterReuseRes.status).toBe(401);
  });

  it("logout revokes the session so a subsequent refresh fails", async () => {
    const server = app.getHttpServer();
    const loginRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: "Password123" });
    const cookie = extractRefreshCookie(loginRes);

    const logoutRes = await request(server).post("/api/v1/auth/logout").set("Cookie", cookie);
    expect(logoutRes.status).toBe(204);

    const refreshAfterLogout = await request(server).post("/api/v1/auth/refresh").set("Cookie", cookie);
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("logout-all (Phase 12) revokes every session, including ones from other logins", async () => {
    const server = app.getHttpServer();
    const loginA = await request(server).post("/api/v1/auth/login").send({ email: testEmail, password: "Password123" });
    const cookieA = extractRefreshCookie(loginA);
    const accessTokenA = loginA.body.data.accessToken as string;
    const loginB = await request(server).post("/api/v1/auth/login").send({ email: testEmail, password: "Password123" });
    const cookieB = extractRefreshCookie(loginB);

    const unauthenticatedAttempt = await request(server).post("/api/v1/auth/logout-all");
    expect(unauthenticatedAttempt.status).toBe(401);

    const logoutAllRes = await request(server).post("/api/v1/auth/logout-all").set("Authorization", `Bearer ${accessTokenA}`);
    expect(logoutAllRes.status).toBe(204);

    const refreshA = await request(server).post("/api/v1/auth/refresh").set("Cookie", cookieA);
    expect(refreshA.status).toBe(401);
    const refreshB = await request(server).post("/api/v1/auth/refresh").set("Cookie", cookieB);
    expect(refreshB.status).toBe(401);
  });

  it("rejects /auth/me without a token and accepts it with one", async () => {
    const server = app.getHttpServer();
    const unauthenticated = await request(server).get("/api/v1/auth/me");
    expect(unauthenticated.status).toBe(401);

    const loginRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: "Password123" });
    const accessToken = loginRes.body.data.accessToken as string;

    const me = await request(server).get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(testEmail);
    expect(me.body.data).not.toHaveProperty("passwordHash");
  });
});
