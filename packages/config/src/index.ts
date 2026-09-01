import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().default(3001),
    API_HOST: z.string().default("0.0.0.0"),
    API_CORS_ORIGIN: z.string().default("http://localhost:3000"),
    DATABASE_URL: z.string().default("postgresql://skynav:skynav@localhost:5432/skynav"),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    JWT_SECRET: z
      .string()
      .min(16, "JWT_SECRET must be at least 16 characters long")
      .default("skynav-development-jwt-secret-key-32chars"),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("7d"),
    MAP_PROVIDER: z.enum(["osm", "maplibre", "custom", "radar"]).default("osm"),
    MAP_STYLE_URL: z.string().default(""),
    MAP_TILES_URL: z.string().default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
    MAX_TRAIL_POINTS: z.coerce.number().int().min(5).max(100).default(25),
    // Production Hardening & Observability Configs
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(10),
    RATE_LIMIT_EMERGENCY_MAX: z.coerce.number().int().min(1).default(30),
    RATE_LIMIT_AI_MAX: z.coerce.number().int().min(1).default(60),
    RATE_LIMIT_API_MAX: z.coerce.number().int().min(1).default(300),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
    REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).default(1_048_576), // 1 MB
    AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
    METRICS_ENABLED: z
      .string()
      .optional()
      .transform((val) => val !== "false")
      .pipe(z.boolean()),
    // Server-Side Administrator Configuration (Exactly ONE Admin Account)
    ADMIN_USERNAME: z.string().default("drone@gmail.com"),
    ADMIN_PASSWORD: z.string().min(8).default("drone@automation")
  })
  .superRefine((data, ctx) => {
    // Validate Redis URL protocol
    if (!data.REDIS_URL.startsWith("redis://") && !data.REDIS_URL.startsWith("rediss://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "REDIS_URL must start with 'redis://' or 'rediss://'",
        path: ["REDIS_URL"]
      });
    }

    // Production Invariant Validation
    if (data.NODE_ENV === "production") {
      // 1. Insecure Default JWT Secret Rejection
      if (
        data.JWT_SECRET === "skynav-development-jwt-secret-key-32chars" ||
        data.JWT_SECRET.length < 32
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Production JWT_SECRET must be at least 32 characters and cannot use development default secret.",
          path: ["JWT_SECRET"]
        });
      }

      // 2. Wildcard CORS Rejection in Production
      if (data.API_CORS_ORIGIN === "*") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "API_CORS_ORIGIN cannot be '*' wildcard in production environment.",
          path: ["API_CORS_ORIGIN"]
        });
      }

      // 3. Insecure Default Database Credentials in Production
      if (
        data.DATABASE_URL.includes("skynav:skynav@localhost") &&
        process.env.ALLOW_DEV_DATABASE_IN_PROD !== "true"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DATABASE_URL cannot use default development credentials in production.",
          path: ["DATABASE_URL"]
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

/**
 * Loads and validates environment variables.
 * In development and test environments, safe defaults are provided.
 */
export function loadEnv(customSource?: Record<string, string | undefined>): AppEnv {
  if (customSource) {
    return envSchema.parse(customSource);
  }
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}

/**
 * Reset cached environment (useful for testing).
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}

export interface ServiceConfig {
  readonly serviceName: string;
  readonly environment: string;
}

export const environment = (): string => process.env.NODE_ENV ?? "development";
