import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { envSchema, loadEnv } from "./index.js";

describe("Config / Environment Validation", () => {
  it("provides safe development defaults when variables are unset", () => {
    const env = loadEnv({});
    assert.equal(env.NODE_ENV, "development");
    assert.equal(env.API_PORT, 3001);
    assert.equal(env.API_HOST, "0.0.0.0");
    assert.equal(env.DATABASE_URL, "postgresql://skynav:skynav@localhost:5432/skynav");
    assert.equal(env.REDIS_URL, "redis://localhost:6379");
    assert.ok(env.JWT_SECRET.length >= 16);
    assert.equal(env.JWT_ACCESS_TTL, "15m");
    assert.equal(env.JWT_REFRESH_TTL, "7d");
  });

  it("parses valid custom environment variables correctly", () => {
    const custom = {
      NODE_ENV: "production" as const,
      API_PORT: "8080",
      API_HOST: "127.0.0.1",
      API_CORS_ORIGIN: "https://app.skynav.io",
      DATABASE_URL: "postgresql://user:pass@db.example.com:5432/skynav_prod",
      REDIS_URL: "redis://redis.example.com:6379",
      JWT_SECRET: "production-ultra-secure-key-must-be-long-enough",
      JWT_ACCESS_TTL: "30m",
      JWT_REFRESH_TTL: "14d"
    };
    const env = loadEnv(custom);
    assert.equal(env.NODE_ENV, "production");
    assert.equal(env.API_PORT, 8080);
    assert.equal(env.API_HOST, "127.0.0.1");
    assert.equal(env.API_CORS_ORIGIN, "https://app.skynav.io");
    assert.equal(env.DATABASE_URL, custom.DATABASE_URL);
    assert.equal(env.REDIS_URL, custom.REDIS_URL);
    assert.equal(env.JWT_SECRET, custom.JWT_SECRET);
    assert.equal(env.JWT_ACCESS_TTL, "30m");
    assert.equal(env.JWT_REFRESH_TTL, "14d");
  });

  it("rejects short JWT secret", () => {
    assert.throws(() => {
      envSchema.parse({ JWT_SECRET: "short" });
    });
  });

  it("rejects invalid NODE_ENV", () => {
    assert.throws(() => {
      envSchema.parse({ NODE_ENV: "invalid_env" });
    });
  });
});
