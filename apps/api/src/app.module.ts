import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseEnvelopeInterceptor } from "./common/interceptors/response-envelope.interceptor";
import type { EnvConfig } from "./config/env.validation";
import { validateEnv } from "./config/env.validation";
import { HealthModule } from "./health/health.module";
import { AiModule } from "./modules/ai/ai.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CartModule } from "./modules/cart/cart.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { DeliveryModule } from "./modules/delivery/delivery.module";
import { DigitalTwinModule } from "./modules/digital-twin/digital-twin.module";
import { DronesModule } from "./modules/drones/drones.module";
import { GeofencingModule } from "./modules/geofencing/geofencing.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { MissionsModule } from "./modules/missions/missions.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { RouteIntelligenceModule } from "./modules/route-intelligence/route-intelligence.module";
import { SwarmModule } from "./modules/swarm/swarm.module";
import { TelemetryModule } from "./modules/telemetry/telemetry.module";
import { UsersModule } from "./modules/users/users.module";
import { VisionModule } from "./modules/vision/vision.module";
import { WeatherModule } from "./modules/weather/weather.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", "../../../.env", ".env"],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { singleLine: true } }
            : undefined,
        autoLogging: true,
        // Phase 12 fix: pino-http's default `req` serializer includes the
        // full request headers, so every authenticated request previously
        // logged the raw `Authorization: Bearer <accessToken>` and `Cookie`
        // (refresh token) headers verbatim at info level. `res.headers`'
        // `set-cookie` (the refresh-token cookie being issued) is redacted
        // for the same reason.
        redact: {
          paths: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"],
          censor: "[REDACTED]",
        },
      },
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (_configService: ConfigService<EnvConfig, true>) => ({
        throttlers: [{ ttl: 60_000, limit: 300 }],
      }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    HealthModule,
    // Users/Rbac/Audit are fully implemented as of Phase 2 (see
    // docs/ARCHITECTURE.md). The remaining modules stay empty placeholders —
    // lock in the bounded-module map from docs/PROJECT_CONTEXT.md; business
    // logic is added starting the phase noted for each in ARCHITECTURE.md.
    UsersModule,
    RbacModule,
    AuditModule,
    CatalogModule,
    InventoryModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    DeliveryModule,
    DronesModule,
    MissionsModule,
    TelemetryModule,
    RealtimeModule,
    GeofencingModule,
    WeatherModule,
    AiModule,
    NotificationsModule,
    AnalyticsModule,
    VisionModule,
    SwarmModule,
    DigitalTwinModule,
    RouteIntelligenceModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
