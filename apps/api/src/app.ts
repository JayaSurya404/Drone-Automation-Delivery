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
  realtimeService?: RealtimeService;
  logger?: boolean;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false
  });

  // Database and services dependency injection
  const db = options.db ?? getDb();
  const auditService = options.auditService ?? createAuditService(db);
  const authRepo = options.authRepo ?? createAuthRepository(db);
  const orderRepo = options.orderRepo ?? createOrderRepository(db);
  const fleetRepo = options.fleetRepo ?? createFleetRepository(db);
  const missionRepo = options.missionRepo ?? createMissionRepository(db);
  const simulatorGateway = options.simulatorGateway ?? createSimulatorGateway();

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

  const authService = options.authService ?? createAuthService(authRepo, auditService, jwtSign);
  const orderService = options.orderService ?? createOrderService(orderRepo, auditService);
  const fleetService = options.fleetService ?? createFleetService(fleetRepo, auditService);
  const missionService =
    options.missionService ??
    createMissionService(missionRepo, orderRepo, fleetRepo, simulatorGateway, auditService);
  const realtimeService =
    options.realtimeService ??
    new RealtimeService({
      fleetRepo,
      orderRepo,
      missionRepo
    });

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
  app.register(createAuthRoutes(authService));
  app.register(createAuditRoutes(auditService));
  app.register(createOrderRoutes(orderService));
  app.register(createFleetRoutes(fleetService));
  app.register(createMissionRoutes(missionService));
  app.register(createRealtimeRoutes(realtimeService));

  return app;
}
