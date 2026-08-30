import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import type { Kysely } from "kysely";
import type { Database } from "./infrastructure/db/schema.js";
import { getDb } from "./infrastructure/db/client.js";
import { env } from "./config/env.js";
import { errorHandler } from "./plugins/error-handler.js";
import { createAuthRepository, type AuthRepository } from "./modules/auth/auth.repository.js";
import { createAuthService, type AuthService } from "./modules/auth/auth.service.js";
import { createAuthRoutes } from "./modules/auth/auth.routes.js";
import { createAuditService, type AuditService } from "./modules/audit/audit.service.js";
import { createAuditRoutes } from "./modules/audit/audit.routes.js";
import { createOrderRepository, type OrderRepository } from "./modules/orders/order.repository.js";
import { createOrderService, type OrderService } from "./modules/orders/order.service.js";
import { createOrderRoutes } from "./modules/orders/order.routes.js";
import { createFleetRepository, type FleetRepository } from "./modules/fleet/fleet.repository.js";
import { createFleetService, type FleetService } from "./modules/fleet/fleet.service.js";
import { createFleetRoutes } from "./modules/fleet/fleet.routes.js";
import { createMissionRepository, type MissionRepository } from "./modules/missions/mission.repository.js";
import { createMissionService, type MissionService } from "./modules/missions/mission.service.js";
import { createMissionRoutes } from "./modules/missions/mission.routes.js";
import { createSimulatorGateway, type SimulatorGateway } from "./modules/missions/simulator.adapter.js";
import { RealtimeService } from "./modules/realtime/realtime.service.js";
import { createRealtimeRoutes } from "./modules/realtime/realtime.routes.js";
import { createOutboxRepository, type OutboxRepository } from "./modules/events/outbox.repository.js";
import { RedisEventPublisher, InMemoryEventPublisher, type EventPublisher } from "./modules/events/event.publisher.js";
import { OutboxService } from "./modules/events/outbox.service.js";
import { createNotificationRepository, type NotificationRepository } from "./modules/notifications/notification.repository.js";
import { createNotificationService, type NotificationService } from "./modules/notifications/notification.service.js";
import { createNotificationRoutes } from "./modules/notifications/notification.routes.js";
import { createDroneSelector, type DroneSelector } from "./modules/dispatch/drone-selector.js";
import { SimulatorSyncService } from "./modules/dispatch/simulator-sync.service.js";
import { createDeliveryOrchestrator, type DeliveryOrchestrator } from "./modules/dispatch/delivery-orchestrator.js";
import { createDispatchRoutes } from "./modules/dispatch/dispatch.routes.js";
import type { UserRole, Permission } from "@skynav/contracts";

export interface AppOptions {
  db?: Kysely<Database>;
  authRepo?: AuthRepository;
  auditService?: AuditService;
  authService?: AuthService;
  orderRepo?: OrderRepository;
  orderService?: OrderService;
  fleetRepo?: FleetRepository;
  fleetService?: FleetService;
  missionRepo?: MissionRepository;
  missionService?: MissionService;
  simulatorGateway?: SimulatorGateway;
  simulatorSyncService?: SimulatorSyncService;
  droneSelector?: DroneSelector;
  deliveryOrchestrator?: DeliveryOrchestrator;
  realtimeService?: RealtimeService;
  outboxRepo?: OutboxRepository;
  eventPublisher?: EventPublisher;
  outboxService?: OutboxService;
  notificationRepo?: NotificationRepository;
  notificationService?: NotificationService;
  logger?: boolean;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false
  });

  const isMockEnvironment = Boolean(
    options.authRepo ||
    options.orderRepo ||
    options.fleetRepo ||
    options.missionRepo ||
    options.notificationRepo
  );

  // Database and services dependency injection
  const db = options.db ?? (!isMockEnvironment ? getDb() : undefined);
  const auditService = options.auditService ?? (db ? createAuditService(db) : undefined as any);
  const authRepo = options.authRepo ?? (db ? createAuthRepository(db) : undefined as any);
  const orderRepo = options.orderRepo ?? (db ? createOrderRepository(db) : undefined as any);
  const fleetRepo = options.fleetRepo ?? (db ? createFleetRepository(db) : undefined as any);
  const missionRepo = options.missionRepo ?? (db ? createMissionRepository(db) : undefined as any);
  const outboxRepo = options.outboxRepo ?? (db ? createOutboxRepository(db) : undefined);
  const notificationRepo = options.notificationRepo ?? (db ? createNotificationRepository(db) : undefined as any);
  const eventPublisher = options.eventPublisher ?? (process.env.REDIS_URL ? new RedisEventPublisher() : new InMemoryEventPublisher());

  // Error handling plugin
  app.setErrorHandler(errorHandler);

  // Security & HTTP plugins
  app.register(cors, {
    origin: env.API_CORS_ORIGIN,
    credentials: true
  });

  app.register(cookie, {
    secret: env.JWT_SECRET
  });

  app.register(jwt, {
    secret: env.JWT_SECRET
  });

  app.register(websocket, {
    options: {
      maxPayload: 1048576 // 1MB
    }
  });

  // JWT Token Signing Helper for AuthService
  const jwtSign = (payload: Record<string, unknown>, opts?: { expiresIn?: string }) => {
    return app.jwt.sign(payload as any, { expiresIn: opts?.expiresIn ?? env.JWT_ACCESS_TTL });
  };

  const realtimeService =
    options.realtimeService ??
    new RealtimeService({
      fleetRepo,
      orderRepo,
      missionRepo
    });

  const simulatorSyncService =
    options.simulatorSyncService ??
    new SimulatorSyncService({
      orderRepo,
      missionRepo,
      fleetRepo,
      outboxRepo,
      telemetryPublisher: {
        publish: async (telemetry) => {
          realtimeService.broadcastTelemetry(telemetry);
        }
      }
    });

  const simulatorGateway = options.simulatorGateway ?? simulatorSyncService;
  const droneSelector = options.droneSelector ?? (fleetRepo ? createDroneSelector(fleetRepo) : undefined as any);

  const authService = options.authService ?? (authRepo && auditService ? createAuthService(authRepo, auditService, jwtSign) : undefined as any);
  const orderService = options.orderService ?? (orderRepo && auditService ? createOrderService(orderRepo, auditService, outboxRepo) : undefined as any);
  const fleetService =
    options.fleetService ??
    (fleetRepo && auditService
      ? createFleetService(fleetRepo, auditService, outboxRepo, simulatorGateway, missionRepo, orderRepo)
      : undefined as any);
  const missionService =
    options.missionService ??
    (missionRepo && orderRepo && fleetRepo && auditService
      ? createMissionService(missionRepo, orderRepo, fleetRepo, simulatorGateway, auditService, outboxRepo)
      : undefined as any);
  const notificationService =
    options.notificationService ??
    (notificationRepo ? createNotificationService(notificationRepo, auditService) : undefined as any);
  const outboxService =
    options.outboxService ??
    (outboxRepo
      ? new OutboxService({
          outboxRepo,
          eventPublisher
        })
      : undefined);
  const deliveryOrchestrator =
    options.deliveryOrchestrator ??
    (orderRepo && missionRepo && fleetRepo && droneSelector && missionService && auditService
      ? createDeliveryOrchestrator({
          orderRepo,
          missionRepo,
          fleetRepo,
          droneSelector,
          missionService,
          simulatorGateway,
          simulatorSyncService,
          auditService,
          outboxRepo
        })
      : undefined as any);

  // Pre-handler hook to authenticate requests with Bearer tokens
  app.addHook("onRequest", async (request) => {
    try {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const decoded = await request.jwtVerify<{
          sub: string;
          email: string;
          name: string;
          orgId: string;
          orgName: string;
          role: UserRole;
          permissions: Permission[];
        }>();

        if (decoded) {
          request.user = {
            id: decoded.sub,
            email: decoded.email,
            name: decoded.name,
            organizationId: decoded.orgId,
            organizationName: decoded.orgName,
            role: decoded.role,
            permissions: decoded.permissions
          };
        }
      }
    } catch {
      // Token was invalid or expired; leave request.user undefined so requireAuthenticated will reject.
    }
  });

  // Health and discovery endpoints
  app.get("/health", async () => ({ status: "ok", service: "api", timestamp: new Date().toISOString() }));

  const modules = [
    "auth",
    "users",
    "organizations",
    "customers",
    "drones",
    "fleet",
    "orders",
    "packages",
    "missions",
    "routes",
    "telemetry",
    "geofences",
    "weather",
    "alerts",
    "incidents",
    "deliveries",
    "notifications",
    "analytics",
    "audit"
  ];
  app.get("/api/v1/modules", async () => ({ modules }));

  // Register domain routes
  if (authService) app.register(createAuthRoutes(authService));
  if (auditService) app.register(createAuditRoutes(auditService));
  if (orderService) app.register(createOrderRoutes(orderService));
  if (fleetService) app.register(createFleetRoutes(fleetService));
  if (missionService) app.register(createMissionRoutes(missionService));
  if (notificationService) app.register(createNotificationRoutes(notificationService));
  if (realtimeService) app.register(createRealtimeRoutes(realtimeService));
  if (deliveryOrchestrator) app.register(createDispatchRoutes(deliveryOrchestrator, simulatorSyncService));

  return app;
}
