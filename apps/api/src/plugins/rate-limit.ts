import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";
import { metricsRegistry } from "../infrastructure/metrics/metrics.registry.js";

export interface RateLimitOptions {
  windowMs?: number;
  authLimit?: number;
  emergencyLimit?: number;
  aiLimit?: number;
  defaultLimit?: number;
}

interface ClientBucket {
  count: number;
  resetTimeMs: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, ClientBucket>();
  private readonly windowMs: number;
  private readonly authLimit: number;
  private readonly emergencyLimit: number;
  private readonly aiLimit: number;
  private readonly defaultLimit: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: RateLimitOptions = {}) {
    this.windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
    this.authLimit = options.authLimit ?? env.RATE_LIMIT_AUTH_MAX;
    this.emergencyLimit = options.emergencyLimit ?? env.RATE_LIMIT_EMERGENCY_MAX;
    this.aiLimit = options.aiLimit ?? env.RATE_LIMIT_AI_MAX;
    this.defaultLimit = options.defaultLimit ?? env.RATE_LIMIT_API_MAX;

    // Periodic cleanup of expired rate limit buckets (every 60s)
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets.entries()) {
        if (now >= bucket.resetTimeMs) {
          this.buckets.delete(key);
        }
      }
    }, 60_000);
    this.cleanupInterval.unref();
  }

  public getLimitForUrl(url: string): { limit: number; tier: string } | null {
    const cleanUrl = url.split("?")[0] || url;

    // Whitelisted routes (no rate limiting)
    if (
      cleanUrl === "/health" ||
      cleanUrl === "/ready" ||
      cleanUrl === "/metrics" ||
      cleanUrl === "/api/v1/modules"
    ) {
      return null;
    }

    if (
      cleanUrl === "/api/v1/auth/login" ||
      cleanUrl === "/api/v1/auth/register" ||
      cleanUrl === "/api/v1/auth/refresh"
    ) {
      return { limit: this.authLimit, tier: "AUTH" };
    }

    if (cleanUrl.includes("/emergency") || cleanUrl.includes("/cancel")) {
      return { limit: this.emergencyLimit, tier: "EMERGENCY" };
    }

    if (cleanUrl.startsWith("/api/v1/ai/")) {
      return { limit: this.aiLimit, tier: "AI" };
    }

    return { limit: this.defaultLimit, tier: "STANDARD" };
  }

  public check(clientKey: string, limit: number): { allowed: boolean; remaining: number; retryAfterSeconds: number; resetTimeMs: number } {
    const now = Date.now();
    const bucket = this.buckets.get(clientKey);

    if (!bucket || now >= bucket.resetTimeMs) {
      const resetTimeMs = now + this.windowMs;
      this.buckets.set(clientKey, { count: 1, resetTimeMs });
      return {
        allowed: true,
        remaining: limit - 1,
        retryAfterSeconds: Math.ceil(this.windowMs / 1000),
        resetTimeMs
      };
    }

    bucket.count++;
    if (bucket.count > limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetTimeMs - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        resetTimeMs: bucket.resetTimeMs
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - bucket.count),
      retryAfterSeconds: Math.ceil((bucket.resetTimeMs - now) / 1000),
      resetTimeMs: bucket.resetTimeMs
    };
  }

  public reset(): void {
    this.buckets.clear();
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Sets up Rate Limiting hooks globally on the Fastify instance.
 */
export function setupRateLimiting(app: FastifyInstance, options?: RateLimitOptions): RateLimiter {
  const limiter = new RateLimiter(options);

  app.addHook("onClose", async () => {
    limiter.stop();
  });

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const limitInfo = limiter.getLimitForUrl(request.url);
    if (!limitInfo) return; // Whitelisted route

    const ip = request.ip || request.socket.remoteAddress || "127.0.0.1";
    const clientKey = `${limitInfo.tier}:${ip}`;

    const result = limiter.check(clientKey, limitInfo.limit);

    reply.header("x-ratelimit-limit", limitInfo.limit);
    reply.header("x-ratelimit-remaining", result.remaining);
    reply.header("x-ratelimit-reset", Math.floor(result.resetTimeMs / 1000));

    if (!result.allowed) {
      reply.header("retry-after", result.retryAfterSeconds);
      metricsRegistry.incrementCounter("rate_limit_exceeded_total", 1, { tier: limitInfo.tier });

      return reply.status(429).send({
        type: "https://skynav.io/errors/rate-limit-exceeded",
        title: "Too Many Requests",
        status: 429,
        detail: `Rate limit exceeded for tier '${limitInfo.tier}'. Try again in ${result.retryAfterSeconds} second(s).`,
        instance: request.url,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: result.retryAfterSeconds,
        correlationId: request.correlationId,
        timestamp: new Date().toISOString()
      });
    }
  });

  return limiter;
}
