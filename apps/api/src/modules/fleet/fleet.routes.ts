import type { FastifyPluginAsync } from "fastify";
import {
  createDroneRequestSchema,
  updateDroneRequestSchema,
  droneListQuerySchema,
  uuidSchema
} from "@skynav/contracts";
import type { FleetService } from "./fleet.service.js";
import { requireAuthenticated, requirePermission } from "../auth/rbac.js";
import { requireTenantIsolation } from "../tenant/tenant.guard.js";

export function createFleetRoutes(fleetService: FleetService): FastifyPluginAsync {
  return async function fleetRoutes(app) {
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
  };
}
