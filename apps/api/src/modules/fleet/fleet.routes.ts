import type { FastifyPluginAsync } from "fastify";
import {
  createDroneRequestSchema,
  updateDroneRequestSchema,
  droneListQuerySchema,
  rthCommandRequestSchema,
  emergencyCommandRequestSchema,
  emergencyClearRequestSchema,
  uuidSchema
} from "@skynav/contracts";
import type { FleetService } from "./fleet.service.js";
import { requireAuthenticated, requirePermission } from "../auth/rbac.js";
import { requireTenantIsolation } from "../tenant/tenant.guard.js";

export function createFleetRoutes(fleetService: FleetService): FastifyPluginAsync {
  return async function fleetRoutes(app) {
    // ------------------------------------------------------------------------
    // GET /api/v1/fleet/summary: Fleet operational overview metrics
    // ------------------------------------------------------------------------
    app.get(
      "/api/v1/fleet/summary",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("fleet:read")
        ]
      },
      async (request, reply) => {
        const summary = await fleetService.getFleetSummary(request.user!);
        return reply.status(200).send({ data: summary });
      }
    );

    // Alias: GET /api/v1/drones/summary
    app.get(
      "/api/v1/drones/summary",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("drones:read")
        ]
      },
      async (request, reply) => {
        const summary = await fleetService.getFleetSummary(request.user!);
        return reply.status(200).send({ data: summary });
      }
    );

    // ------------------------------------------------------------------------
    // POST /api/v1/drones: Register a new UAV into the fleet inventory
    // ------------------------------------------------------------------------
    app.post(
      "/api/v1/drones",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("drones:create")
        ]
      },
      async (request, reply) => {
        const body = createDroneRequestSchema.parse(request.body);
        const drone = await fleetService.createDrone(request.user!, body);
        return reply.status(201).send({ data: drone });
      }
    );

    // ------------------------------------------------------------------------
    // GET /api/v1/drones: List drones (scoped by organization)
    // ------------------------------------------------------------------------
    app.get(
      "/api/v1/drones",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("drones:read")
        ]
      },
      async (request, reply) => {
        const query = droneListQuerySchema.parse(request.query);
        const result = await fleetService.listDrones(request.user!, query);
        return reply.status(200).send(result);
      }
    );

    // ------------------------------------------------------------------------
    // GET /api/v1/drones/:droneId/detail: Comprehensive operational drone details
    // ------------------------------------------------------------------------
    app.get<{ Params: { droneId: string } }>(
      "/api/v1/drones/:droneId/detail",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("drones:read")
        ]
      },
      async (request, reply) => {
        const droneId = uuidSchema.parse(request.params.droneId);
        const drone = await fleetService.getDroneDetail(request.user!, droneId);
        return reply.status(200).send({ data: drone });
      }
    );

    // ------------------------------------------------------------------------
    // GET /api/v1/drones/:droneId: Retrieve single drone by ID
    // ------------------------------------------------------------------------
    app.get<{ Params: { droneId: string } }>(
      "/api/v1/drones/:droneId",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("drones:read")
        ]
      },
      async (request, reply) => {
        const droneId = uuidSchema.parse(request.params.droneId);
        const drone = await fleetService.getDrone(request.user!, droneId);
        return reply.status(200).send({ data: drone });
      }
    );

    // ------------------------------------------------------------------------
    // PATCH /api/v1/drones/:droneId: Update drone metadata/status
    // ------------------------------------------------------------------------
    app.patch<{ Params: { droneId: string } }>(
      "/api/v1/drones/:droneId",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("drones:command")
        ]
      },
      async (request, reply) => {
        const droneId = uuidSchema.parse(request.params.droneId);
        const body = updateDroneRequestSchema.parse(request.body);
        const drone = await fleetService.updateDrone(request.user!, droneId, body);
        return reply.status(200).send({ data: drone });
      }
    );

    // ------------------------------------------------------------------------
    // POST /api/v1/drones/:droneId/rth: Command Return-To-Home
    // ------------------------------------------------------------------------
    app.post<{ Params: { droneId: string } }>(
      "/api/v1/drones/:droneId/rth",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("drones:command")
        ]
      },
      async (request, reply) => {
        const droneId = uuidSchema.parse(request.params.droneId);
        const body = rthCommandRequestSchema.safeParse(request.body ?? {});
        const reason = body.success ? body.data.reason : "Operator commanded Return-To-Home";
        const result = await fleetService.triggerReturnToHome(request.user!, droneId, reason);
        return reply.status(200).send({ data: result });
      }
    );

    // ------------------------------------------------------------------------
    // POST /api/v1/drones/:droneId/emergency: Trigger Emergency Halt / Land / RTH
    // ------------------------------------------------------------------------
    app.post<{ Params: { droneId: string } }>(
      "/api/v1/drones/:droneId/emergency",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("drones:command")
        ]
      },
      async (request, reply) => {
        const droneId = uuidSchema.parse(request.params.droneId);
        const body = emergencyCommandRequestSchema.parse(request.body);
        const result = await fleetService.triggerEmergency(request.user!, droneId, body.reason);
        return reply.status(200).send({ data: result });
      }
    );

    // ------------------------------------------------------------------------
    // POST /api/v1/drones/:droneId/emergency/clear: Clear Emergency State
    // ------------------------------------------------------------------------
    app.post<{ Params: { droneId: string } }>(
      "/api/v1/drones/:droneId/emergency/clear",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("drones:command")
        ]
      },
      async (request, reply) => {
        const droneId = uuidSchema.parse(request.params.droneId);
        const body = emergencyClearRequestSchema.safeParse(request.body ?? {});
        const reason = body.success ? body.data.reason : "Emergency cleared by operator";
        const result = await fleetService.clearEmergency(request.user!, droneId, reason);
        return reply.status(200).send({ data: result });
      }
    );
  };
}
