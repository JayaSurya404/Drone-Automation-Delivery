import type { FastifyPluginAsync } from "fastify";
import type { Kysely } from "kysely";
import type { Redis } from "ioredis";
import type { Database } from "../../infrastructure/db/schema.js";
import { checkDbHealth } from "../../infrastructure/db/client.js";
import { metricsRegistry } from "../../infrastructure/metrics/metrics.registry.js";
import { env } from "../../config/env.js";

export interface ObservabilityOptions {
  db?: Kysely<Database>;
  redis?: Redis;
  isMockEnvironment?: boolean;
}

export function createObservabilityRoutes(options: ObservabilityOptions = {}): FastifyPluginAsync {
  const { db, redis, isMockEnvironment = false } = options;
  const startTime = Date.now();

  return async function observabilityRoutes(fastify) {
    // 1. Liveness Probe: GET /health
    fastify.get("/health", async (_request, reply) => {
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
      return reply.status(200).send({
        status: "LIVE",
        service: "skynav-api",
        environment: env.NODE_ENV,
        uptimeSeconds,
        timestamp: new Date().toISOString()
      });
    });

    // 2. Readiness Probe: GET /ready
    fastify.get("/ready", async (_request, reply) => {
      const startCheck = Date.now();
      const checks: Record<string, { status: "UP" | "DOWN" | "DISABLED"; latencyMs?: number; message?: string }> = {};
      let isHealthy = true;

      // Check PostgreSQL Database
      if (db) {
        const dbStart = Date.now();
        try {
          const dbOk = await checkDbHealth(db);
          const dbLatency = Date.now() - dbStart;
          if (dbOk) {
            checks.database = { status: "UP", latencyMs: dbLatency };
          } else {
            checks.database = { status: "DOWN", latencyMs: dbLatency, message: "Database query failed or timed out" };
            isHealthy = false;
          }
        } catch (err: any) {
          checks.database = { status: "DOWN", latencyMs: Date.now() - dbStart, message: err.message };
          isHealthy = false;
        }
      } else if (isMockEnvironment) {
        checks.database = { status: "UP", latencyMs: 0, message: "Mock Database In-Memory" };
      } else {
        checks.database = { status: "DISABLED", message: "No database instance attached" };
      }

      // Check Redis Pub/Sub
      if (redis) {
        const redisStart = Date.now();
        try {
          if (typeof redis.ping === "function") {
            const pong = await redis.ping();
            checks.redis = { status: pong === "PONG" ? "UP" : "DOWN", latencyMs: Date.now() - redisStart };
          } else {
            checks.redis = { status: "UP", latencyMs: 0 };
          }
        } catch (err: any) {
          checks.redis = { status: "DOWN", latencyMs: Date.now() - redisStart, message: err.message };
          // Redis degradation in non-prod can be considered warning; in prod if required, mark unhealthy
          if (env.NODE_ENV === "production") {
            isHealthy = false;
          }
        }
      } else {
        checks.redis = { status: "DISABLED", message: "In-Memory Event Bus Mode" };
      }

      // Overall Readiness Decision
      const statusCode = isHealthy ? 200 : 503;
      return reply.status(statusCode).send({
        status: isHealthy ? "READY" : "DEGRADED",
        service: "skynav-api",
        environment: env.NODE_ENV,
        durationMs: Date.now() - startCheck,
        checks,
        timestamp: new Date().toISOString()
      });
    });

    // 3. Metrics Probe: GET /metrics
    fastify.get("/metrics", async (_request, reply) => {
      const snapshot = metricsRegistry.getSnapshot();
      return reply.status(200).send(snapshot);
    });
  };
}
