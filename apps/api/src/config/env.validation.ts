import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // Phase 13 — explicit override for whether Swagger (`/api/docs`) is
  // exposed; unset defaults to "on everywhere except production" in
  // `main.ts`. Left optional/undefined here (not defaulted) so `main.ts`
  // can tell "not set" apart from an explicit "false".
  ENABLE_SWAGGER: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001")
    .transform((value) => value.split(",").map((origin) => origin.trim())),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  // Phase 12 fix: `rediss://` (TLS) is a real, commonly-required scheme for
  // a managed production Redis — the schema previously rejected it outright
  // at startup, which would have forced a production deployment to disable
  // Redis TLS just to pass config validation.
  REDIS_URL: z.string().url().refine((value) => value.startsWith("redis://") || value.startsWith("rediss://"), {
    message: "must start with redis:// or rediss://",
  }),
  STORAGE_ENDPOINT: z.string().min(1),
  STORAGE_PORT: z.coerce.number().int().positive().default(9000),
  STORAGE_USE_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_REGION: z.string().default("us-east-1"),

  JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REFRESH_COOKIE_NAME: z.string().default("skynav_refresh_token"),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().default("SkyNav <no-reply@skynav.local>"),

  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  BOOTSTRAP_SUPER_ADMIN_EMAIL: z.string().email().default("admin@skynav.local"),
  BOOTSTRAP_SUPER_ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),

  // Checkout pricing (Phase 4) — simple, documented placeholders; real
  // jurisdiction-aware tax and computed delivery pricing are out of scope.
  DELIVERY_FEE_FLAT: z.coerce.number().min(0).default(4.99),
  FREE_DELIVERY_THRESHOLD: z.coerce.number().min(0).default(35),
  TAX_RATE: z.coerce.number().min(0).max(1).default(0.08),

  // Payments (Phase 4). Stripe is optional — undefined means the real
  // StripeProvider is unavailable and checkout falls back to an explicit
  // error if a caller requests it; local dev never needs these (Simulated
  // and COD need no external account at all).
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Delivery (Phase 5). ETA is a deterministic placeholder for Phase 9's
  // real ETAPredictor. Verification TTL/max-attempts bound the OTP/QR code
  // Redis holds for the owning customer to view — see DeliveryService.
  DEFAULT_DELIVERY_ETA_MINUTES: z.coerce.number().int().positive().default(45),
  DELIVERY_VERIFICATION_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  DELIVERY_VERIFICATION_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  // Drone & Fleet (Phase 6). DRONE_ADAPTER picks the DroneAdapter
  // implementation per PROJECT_CONTEXT.md #3 — "mavlink" is a deliberately
  // unimplemented stub (throws on every call), not silently ignored.
  // TELEMETRY_INGEST_API_KEY is a LOCAL DEV DEFAULT ONLY, the signed service
  // credential the standalone drone-simulator process presents to the
  // internal telemetry-ingest endpoint (blueprint Section O) — distinct from
  // user JWTs, never accepted from a browser client.
  DRONE_ADAPTER: z.enum(["simulated", "mavlink"]).default("simulated"),
  TELEMETRY_INGEST_API_KEY: z.string().min(16).default("local-dev-only-telemetry-key-change-me"),
  DRONE_SIMULATION_TICK_MS: z.coerce.number().int().positive().default(4000),
  DRONE_SIMULATION_AUTOPLAY: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  DRONE_LOW_BATTERY_THRESHOLD_PERCENT: z.coerce.number().int().min(1).max(100).default(20),

  // Realtime (Phase 7). Ingest/write rate stays whatever Phase 6 already
  // does (unchanged) — this only throttles how often a given drone's
  // high-frequency telemetry (location/battery) is fanned out over
  // WebSocket, per PROJECT_CONTEXT.md #7's "decouple ingest and broadcast
  // rate." WS_SUBSCRIBE_RATE_LIMIT/_WINDOW_MS bound how often a single
  // socket may send subscribe/unsubscribe messages, a lightweight backpressure
  // guard against a misbehaving/abusive client.
  REALTIME_TELEMETRY_THROTTLE_MS: z.coerce.number().int().positive().default(500),
  WS_SUBSCRIBE_RATE_LIMIT: z.coerce.number().int().positive().default(30),
  WS_SUBSCRIBE_RATE_WINDOW_MS: z.coerce.number().int().positive().default(10_000),
  // Phase 12 hardening — connection *attempts* were previously unbounded
  // (only post-connect subscribe/unsubscribe messages were rate-limited),
  // letting a client force unlimited JWT-verify + handshake work per second.
  // Keyed by remote address in both `TrackingGateway`/`OpsGateway`.
  WS_CONNECT_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  WS_CONNECT_RATE_WINDOW_MS: z.coerce.number().int().positive().default(10_000),

  // Weather & Safety (Phase 8). WEATHER_PROVIDER picks the WeatherProvider
  // implementation per PROJECT_CONTEXT.md #3 — "open-meteo" is a
  // deliberately unimplemented stub (throws on every call), same
  // convention as DRONE_ADAPTER=mavlink. Caution/unsafe thresholds are
  // read by evaluateWeatherSafety() (weather-safety.util.ts); unsafe must
  // be >= caution for the escalation logic to behave sensibly, but that
  // ordering isn't enforced by the schema itself — an operator changing
  // these is expected to keep it consistent, same as every other
  // env-configured threshold in this app (e.g. DRONE_LOW_BATTERY_THRESHOLD_PERCENT).
  WEATHER_PROVIDER: z.enum(["local", "open-meteo"]).default("local"),
  WEATHER_CACHE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  WEATHER_CAUTION_WIND_MPS: z.coerce.number().positive().default(8),
  WEATHER_UNSAFE_WIND_MPS: z.coerce.number().positive().default(12),
  WEATHER_CAUTION_PRECIPITATION_MM: z.coerce.number().min(0).default(1.5),
  WEATHER_UNSAFE_PRECIPITATION_MM: z.coerce.number().min(0).default(4),

  // AI Intelligence (Phase 9). AI_BATTERY_DRAIN_PERCENT_PER_KM is
  // calibrated to match SimulatedDroneAdapter's real drain rate (3% per
  // ~0.444km step, apps/api/src/modules/drones/adapters/simulated-drone.adapter.ts)
  // so predictions are consistent with what the simulator will actually do,
  // not an arbitrary guess. AI_BATTERY_SAFETY_MARGIN_PERCENT is added on
  // top of DRONE_LOW_BATTERY_THRESHOLD_PERCENT (Phase 6) to get the
  // required arrival reserve — see BatteryAwareRouterService. Risk
  // thresholds are on DeliveryRiskAnalyzer's 0-100 scale;
  // AI_RISK_HIGH_THRESHOLD is also the `Mission.requiresApproval` gate.
  AI_BATTERY_DRAIN_PERCENT_PER_KM: z.coerce.number().positive().default(6.75),
  AI_BATTERY_SAFETY_MARGIN_PERCENT: z.coerce.number().min(0).default(5),
  AI_RISK_MEDIUM_THRESHOLD: z.coerce.number().min(0).max(100).default(40),
  AI_RISK_HIGH_THRESHOLD: z.coerce.number().min(0).max(100).default(70),

  // Analytics (Phase 10). No real cost-accounting data exists anywhere in
  // this app (Order.deliveryFee is revenue charged to the customer, not
  // operating cost) — cost-per-delivery is an explicit, documented estimate
  // model: a fixed per-mission overhead (dispatch/ground ops/amortized
  // hardware) plus a per-kilometer operating cost (energy + wear),
  // evaluated against each mission's real flown distance. Both are
  // deliberately configurable defaults, not measured figures — see
  // `analytics-cost.util.ts` and `docs/ARCHITECTURE.md`'s "Analytics"
  // section. ANALYTICS_DEGRADED_BATTERY_HEALTH_THRESHOLD_PERCENT flags a
  // drone as a maintenance indicator in fleet analytics — deliberately a
  // separate, softer threshold than `AI_BATTERY_SAFETY_MARGIN_PERCENT`
  // (Phase 9's per-route safety margin), since this one is a fleet-health
  // trend signal, not a per-flight go/no-go gate.
  ANALYTICS_COST_PER_KM_USD: z.coerce.number().min(0).default(0.35),
  ANALYTICS_FIXED_COST_PER_MISSION_USD: z.coerce.number().min(0).default(1.5),
  ANALYTICS_DEGRADED_BATTERY_HEALTH_THRESHOLD_PERCENT: z.coerce.number().int().min(0).max(100).default(70),
  ANALYTICS_DASHBOARD_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(60),

  // Advanced Drone Intelligence (Phase 11). VISION_ADAPTER picks the
  // ComputerVisionAdapter implementation, same DRONE_ADAPTER/WEATHER_PROVIDER
  // convention — "model" is a deliberately unimplemented future stub (real
  // OpenCV/YOLO pluggable behind the same interface), never silently
  // downgraded to the simulator. LANDING_ZONE_* thresholds gate
  // `LandingZoneService`'s 0-100 suitability score into SUITABLE/MARGINAL/
  // UNSUITABLE, mirroring `AI_RISK_MEDIUM_THRESHOLD`/`AI_RISK_HIGH_THRESHOLD`'s
  // pattern. ROUTE_INTEL_* bounds `RouteIntelligenceService`'s live
  // aggregation query (lookback window, sample cap, and the corridor-match
  // radius) so it can never scan the full mission history unbounded — the
  // same "bounded date range, capped sample size" discipline Phase 10's
  // analytics queries already use.
  VISION_ADAPTER: z.enum(["simulated", "model"]).default("simulated"),
  LANDING_ZONE_SUITABLE_THRESHOLD: z.coerce.number().int().min(0).max(100).default(70),
  LANDING_ZONE_MARGINAL_THRESHOLD: z.coerce.number().int().min(0).max(100).default(40),
  LANDING_ZONE_REQUIRED_RADIUS_METERS: z.coerce.number().positive().default(5),
  ROUTE_INTEL_LOOKBACK_DAYS: z.coerce.number().int().positive().default(90),
  ROUTE_INTEL_MAX_SAMPLES: z.coerce.number().int().positive().default(200),
  ROUTE_INTEL_MATCH_RADIUS_METERS: z.coerce.number().positive().default(500),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Phase 12 hardening — schema validation alone (`.min(32)`, `.min(16)`, etc.)
 * happily accepts the exact well-known strings committed in `.env.example`,
 * so a deployment that copies `.env.example` to `.env` and forgets to
 * change these three would pass startup validation and run in production
 * with publicly-known credentials. This is a startup-time-only check (not
 * part of the Zod schema itself) so it can be scoped to `NODE_ENV ===
 * "production"` without affecting local dev/test, where these defaults are
 * expected and documented.
 */
const KNOWN_DEV_DEFAULT_SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: "local-dev-only-secret-change-me-1234567890abcdef",
  TELEMETRY_INGEST_API_KEY: "local-dev-only-telemetry-key-change-me",
  BOOTSTRAP_SUPER_ADMIN_PASSWORD: "ChangeMe123!",
};

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }

  if (result.data.NODE_ENV === "production") {
    const stillDefault = Object.entries(KNOWN_DEV_DEFAULT_SECRETS)
      .filter(([key, devValue]) => (result.data as unknown as Record<string, unknown>)[key] === devValue)
      .map(([key]) => key);
    if (stillDefault.length > 0) {
      throw new Error(
        `Refusing to start in production with local-dev-only default value(s) for: ${stillDefault.join(", ")}. ` +
          "Set real values for these before deploying — see .env.example.",
      );
    }
  }

  return result.data;
}
