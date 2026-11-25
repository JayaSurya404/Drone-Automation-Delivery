import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { configureApp, NEST_APP_OPTIONS } from "./bootstrap";
import type { EnvConfig } from "./config/env.validation";
import { RedisIoAdapter } from "./modules/realtime/redis-io.adapter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, ...NEST_APP_OPTIONS });

  const logger = app.get(Logger);
  app.useLogger(logger);

  configureApp(app);

  // Redis-backed Socket.IO adapter (PROJECT_CONTEXT.md #7) — makes both the
  // `/tracking` and `/ops` namespaces scale-out ready even though this
  // deployment runs a single API instance.
  const configService = app.get(ConfigService<EnvConfig, true>);
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(configService.get("REDIS_URL", { infer: true }));
  app.useWebSocketAdapter(redisIoAdapter);

  // Phase 13 — graceful shutdown. Deliberately NOT `app.enableShutdownHooks()`
  // alone: that only wires SIGTERM/SIGINT to `app.close()`, which fires every
  // Nest-managed provider's onModuleDestroy/onApplicationShutdown (Prisma's
  // $disconnect, RedisModule's client.quit() — see redis.module.ts) but knows
  // nothing about `redisIoAdapter`'s own two Redis clients, since those were
  // created with a plain `new Redis()` outside Nest's DI container. Verified
  // against a real container (`docker kill --signal=SIGTERM`): with only
  // `enableShutdownHooks()`, the process hung indefinitely (open ioredis
  // connections keep the event loop non-empty) until the orchestrator's kill
  // timeout force-SIGKILLed it — exactly the ungraceful shutdown this phase
  // is meant to prevent. A bounded force-exit is kept as a safety net in case
  // something else ever holds the event loop open the same way.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`Received ${signal}, shutting down gracefully...`);
    const forceExitTimer = setTimeout(() => {
      logger.error("Graceful shutdown exceeded 15s — forcing exit");
      process.exit(1);
    }, 15_000);
    forceExitTimer.unref();
    try {
      await redisIoAdapter.close();
      await app.close();
      logger.log("Shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Phase 13 — Swagger exposes the full API surface (every route, DTO shape,
  // and parameter) unauthenticated; that's a reasonable default in dev but
  // not something to expose publicly in production by default. Off by
  // default in production, on everywhere else, with an explicit env
  // override either way for a staging environment that wants it on.
  const isProduction = configService.get("NODE_ENV", { infer: true }) === "production";
  const enableSwagger = configService.get("ENABLE_SWAGGER", { infer: true }) ?? !isProduction;
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("SkyNav API")
      .setDescription("SkyNav — drone-powered e-commerce and delivery platform API")
      .setVersion("0.1.0")
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, swaggerDocument);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  logger.log(`SkyNav API listening on http://localhost:${port}`);
}

void bootstrap();
