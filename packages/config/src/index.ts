import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default("0.0.0.0"),
  API_CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("postgresql://skynav:skynav@localhost:5432/skynav"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters long").default("skynav-development-jwt-secret-key-32chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  MAP_PROVIDER: z.enum(["osm", "maplibre", "custom", "radar"]).default("osm"),
  MAP_STYLE_URL: z.string().default(""),
  MAP_TILES_URL: z.string().default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
  MAX_TRAIL_POINTS: z.coerce.number().int().min(5).max(100).default(25)
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
