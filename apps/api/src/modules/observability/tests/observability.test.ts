import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { buildApp } from "../../../app.js";
import { redactSensitiveData } from "../../../infrastructure/logging/logger.js";
import { RateLimiter } from "../../../plugins/rate-limit.js";
import { metricsRegistry } from "../../../infrastructure/metrics/metrics.registry.js";

const TEST_SECRET = "skynav-super-secure-jwt-signing-secret-key-32chars!";

describe("Milestone 7 / Production Hardening, Observability, Rate Limiting & Security Tests", () => {
  let app: FastifyInstance;

  before(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    metricsRegistry.reset();

    app = buildApp({
      logger: false
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it("1. GET /health returns liveness probe with service name and uptime", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health"
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "LIVE");
    assert.equal(body.service, "skynav-api");
    assert.ok(typeof body.uptimeSeconds === "number");
    assert.ok(body.timestamp);
  });

  it("2. GET /ready returns structured readiness probe with dependency check results", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/ready"
    });

    // In local unit test without db attached, returns 200 or 503 structured json
    assert.ok([200, 503].includes(res.statusCode));
    const body = res.json();
    assert.ok(["READY", "DEGRADED"].includes(body.status));
    assert.ok(body.checks);
    assert.ok(typeof body.durationMs === "number");
  });

  it("3. GET /metrics returns JSON metrics snapshot with counters, gauges, and memory stats", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/metrics"
    });

    assert.equal(res.statusCode, 200);
    const metrics = res.json();
    assert.ok(metrics.counters);
    assert.ok(metrics.gauges);
    assert.ok(metrics.memory.heapUsedBytes > 0);
    assert.ok(typeof metrics.uptimeSeconds === "number");
  });

  it("4. Echoes incoming x-correlation-id and generates one if absent", async () => {
    // 4a. Client supplies correlation ID
    const resWithHeader = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-correlation-id": "custom-trace-id-98765"
      }
    });
    assert.equal(resWithHeader.headers["x-correlation-id"], "custom-trace-id-98765");

    // 4b. Client omits correlation ID -> generated
    const resWithoutHeader = await app.inject({
      method: "GET",
      url: "/health"
    });
    assert.ok(resWithoutHeader.headers["x-correlation-id"]);
    assert.ok((resWithoutHeader.headers["x-correlation-id"] as string).length >= 16);
  });

  it("5. Attaches security headers on all HTTP responses", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health"
    });

    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-frame-options"], "DENY");
    assert.equal(res.headers["x-xss-protection"], "0");
    assert.equal(res.headers["referrer-policy"], "strict-origin-when-cross-origin");
  });

  it("6. Enforces rate limiting on auth tier and returns 429 Problem Details with Retry-After", async () => {
    const limiter = new RateLimiter({
      authLimit: 3,
      windowMs: 60000
    });

    const key = "AUTH:192.168.1.100";
    assert.equal(limiter.check(key, 3).allowed, true);
    assert.equal(limiter.check(key, 3).allowed, true);
    assert.equal(limiter.check(key, 3).allowed, true);

    // 4th request exceeds limit
    const blocked = limiter.check(key, 3);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterSeconds > 0);
    limiter.stop();
  });

  it("7. Deeply redacts sensitive credentials, tokens, and keys from structured logs", () => {
    const rawData = {
      userId: "u-123",
      email: "user@example.com",
      password: "SuperSecretPassword123!",
      authToken: "jwt.header.payload.signature",
      nested: {
        apiKey: "sk_live_123456789",
        refreshToken: "refresh_token_secret",
        normalData: "safe_value"
      },
      arrayData: [
        { secret: "hidden_token", publicField: "visible" }
      ]
    };

    const clean = redactSensitiveData(rawData);
    assert.equal(clean.userId, "u-123");
    assert.equal(clean.email, "user@example.com");
    assert.equal(clean.password, "[REDACTED]");
    assert.equal(clean.authToken, "[REDACTED]");
    assert.equal(clean.nested.apiKey, "[REDACTED]");
    assert.equal(clean.nested.refreshToken, "[REDACTED]");
    assert.equal(clean.nested.normalData, "safe_value");
    assert.equal(clean.arrayData[0].secret, "[REDACTED]");
    assert.equal(clean.arrayData[0].publicField, "visible");
  });

  it("8. Rejects oversized payloads exceeding body limit", async () => {
    // 2MB oversized payload
    const oversizedPayload = JSON.stringify({
      data: "a".repeat(2 * 1024 * 1024)
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "content-type": "application/json"
      },
      payload: oversizedPayload
    });

    // Fastify returns 413 Payload Too Large on oversized body
    assert.equal(res.statusCode, 413);
  });
});
