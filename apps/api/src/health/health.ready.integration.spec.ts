import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../bootstrap";

/**
 * Proves the Phase 1 round trip: API -> Postgres (real query) -> Redis (real
 * set/get). Requires `docker compose up -d` (postgres + redis) and a valid
 * root `.env` — run via `pnpm test:integration`, not the default `pnpm test`.
 */
describe("GET /health/ready (integration)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(NEST_APP_OPTIONS);
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns ok after a real Postgres query and Redis set/get", async () => {
    const response = await request(app.getHttpServer()).get("/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      postgres: "ok",
      redis: "ok",
    });
    expect(["ok", "degraded"]).toContain(response.body.objectStorage);
  });
});
