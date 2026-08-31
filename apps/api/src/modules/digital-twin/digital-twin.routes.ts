import type { FastifyPluginAsync } from "fastify";
import { requireAuthenticated, requireRole } from "../auth/rbac.js";
import { requireTenantIsolation } from "../tenant/tenant.guard.js";
import type { DigitalTwinService } from "./digital-twin.service.js";

export function createDigitalTwinRoutes(digitalTwinService: DigitalTwinService): FastifyPluginAsync {
  return async function digitalTwinRoutes(fastify) {
    // 1. Get Fleet Twin
    fastify.get(
      "/api/v1/digital-twin/fleet",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER", "DISPATCHER"])
        ]
      },
      async (request, reply) => {
        const result = await digitalTwinService.getFleetTwin(request.user!);
        return reply.status(200).send(result);
      }
    );

    // 2. Get Drone Twin
    fastify.get<{ Params: { droneId: string } }>(
      "/api/v1/digital-twin/drones/:droneId",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER", "DISPATCHER"])
        ]
      },
      async (request, reply) => {
        const result = await digitalTwinService.getDroneTwin(request.user!, request.params.droneId);
        return reply.status(200).send(result);
      }
    );

    // 3. Get Mission Twin
    fastify.get<{ Params: { missionId: string } }>(
      "/api/v1/digital-twin/missions/:missionId",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER", "DISPATCHER"])
        ]
      },
      async (request, reply) => {
        const result = await digitalTwinService.getMissionTwin(request.user!, request.params.missionId);
        return reply.status(200).send(result);
      }
    );

    // 4. Get Twin Health & Reconciliation Report
    fastify.get(
      "/api/v1/digital-twin/health",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER", "DISPATCHER"])
        ]
      },
      async (request, reply) => {
        const result = await digitalTwinService.getHealthReport(request.user!);
        return reply.status(200).send(result);
      }
    );

    // 5. Get Complete Digital Twin Snapshot
    fastify.get(
      "/api/v1/digital-twin/snapshot",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER", "DISPATCHER"])
        ]
      },
      async (request, reply) => {
        const result = await digitalTwinService.getSnapshot(request.user!);
        return reply.status(200).send(result);
      }
    );
  };
}
