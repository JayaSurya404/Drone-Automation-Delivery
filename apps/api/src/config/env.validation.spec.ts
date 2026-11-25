import { validateEnv } from "./env.validation";

const validConfig = {
  DATABASE_URL: "postgresql://skynav:skynav@localhost:5432/skynav?schema=public",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_ENDPOINT: "localhost",
  STORAGE_ACCESS_KEY: "skynav",
  STORAGE_SECRET_KEY: "skynav123",
  STORAGE_BUCKET: "skynav-local",
  JWT_ACCESS_SECRET: "a".repeat(32),
};

describe("validateEnv", () => {
  it("accepts a valid configuration and applies defaults", () => {
    const result = validateEnv(validConfig);
    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(4000);
    expect(result.CORS_ORIGINS).toEqual(["http://localhost:3000", "http://localhost:3001"]);
    expect(result.STORAGE_USE_SSL).toBe(false);
  });

  it("coerces numeric and boolean string env vars", () => {
    const result = validateEnv({ ...validConfig, PORT: "5000", STORAGE_USE_SSL: "true" });
    expect(result.PORT).toBe(5000);
    expect(result.STORAGE_USE_SSL).toBe(true);
  });

  it("rejects a missing required variable", () => {
    const rest: Record<string, string> = { ...validConfig };
    delete rest.DATABASE_URL;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("rejects a malformed DATABASE_URL", () => {
    expect(() => validateEnv({ ...validConfig, DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("rejects an invalid NODE_ENV value", () => {
    expect(() => validateEnv({ ...validConfig, NODE_ENV: "staging" })).toThrow();
  });

  it("rejects a JWT access secret shorter than 32 characters", () => {
    expect(() => validateEnv({ ...validConfig, JWT_ACCESS_SECRET: "too-short" })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });
});
