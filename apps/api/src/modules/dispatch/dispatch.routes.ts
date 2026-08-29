import type { FastifyPluginAsync } from "fastify";
import { uuidSchema } from "@skynav/contracts";
import { z } from "zod";
import { requireAuthenticated, requirePermission } from "../auth/rbac.js";
import { requireTenantIsolation } from "../tenant/tenant.guard.js";
import type { DeliveryOrchestrator } from "./delivery-orchestrator.js";
import { OrderNotDispatchableError } from "./delivery-orchestrator.js";
import { NoAvailableDroneError } from "./drone-selector.js";
import type { SimulatorSyncService } from "./simulator-sync.service.js";

const tickRequestSchema = z.object({
  deltaSeconds: z.number().positive().max(3600).default(1)
});

export function createDispatchRoutes(
  orchestrator: DeliveryOrchestrator,
  simulatorSyncService?: SimulatorSyncService
): FastifyPluginAsync {
  return async function dispatchRoutes(app) {
    // ------------------------------------------------------------------------
    // POST /api/v1/orders/:orderId/dispatch
    // ------------------------------------------------------------------------
    app.post<{ Params: { orderId: string } }>(
      "/api/v1/orders/:orderId/dispatch",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("orders:create")
        ]
      },
      async (request, reply) => {
        const orderId = uuidSchema.parse(request.params.orderId);

        try {
          const result = await orchestrator.dispatchOrder(request.user!, orderId);
          return reply.status(200).send(result);
        } catch (err: any) {
          if (err instanceof NoAvailableDroneError) {
            return reply.status(422).send({
              type: "https://api.skynav.io/errors/no-available-drone",
              title: "No Available Drone",
              status: 422,
              detail: err.message,
              instance: request.url
            });
          }
          if (err instanceof OrderNotDispatchableError) {
            return reply.status(409).send({
              type: "https://api.skynav.io/errors/order-not-dispatchable",
              title: "Order Not Dispatchable",
              status: 409,
              detail: err.message,
              instance: request.url
            });
          }
          if (err.message && err.message.includes("not authorized")) {
            return reply.status(403).send({
              type: "https://api.skynav.io/errors/forbidden",
              title: "Forbidden",
              status: 403,
              detail: err.message,
              instance: request.url
            });
          }
          if (err.message && err.message.includes("not found")) {
            return reply.status(404).send({
              type: "https://api.skynav.io/errors/not-found",
              title: "Not Found",
              status: 404,
              detail: err.message,
              instance: request.url
            });
          }
          throw err;
        }
      }
    );

    // ------------------------------------------------------------------------
    // POST /api/v1/simulation/tick (Advance simulation clock)
    // ------------------------------------------------------------------------
    app.post(
      "/api/v1/simulation/tick",
      {
        preHandler: [
          requireAuthenticated,
          requirePermission("fleet:read")
        ]
      },
      async (request, reply) => {
        if (!simulatorSyncService) {
          return reply.status(503).send({
            type: "https://api.skynav.io/errors/simulation-unavailable",
            title: "Simulation Service Unavailable",
            status: 503,
            detail: "SimulatorSyncService is not configured.",
            instance: request.url
          });
        }

        const body = tickRequestSchema.parse(request.body ?? {});
        simulatorSyncService.advanceSimulation(body.deltaSeconds);

        const drones = simulatorSyncService.fleetSimulator.getAllDrones().map((d) => ({
          droneId: d.id,
          organizationId: d.organizationId,
          state: d.state,
          position: d.kinematics.position,
          speedMps: d.kinematics.speedMetersPerSecond,
          headingDeg: d.kinematics.headingDegrees,
          batteryPercent: d.battery.percent
        }));

        return reply.status(200).send({
          success: true,
          deltaSeconds: body.deltaSeconds,
          drones,
          timestamp: new Date().toISOString()
        });
      }
    );

    // ------------------------------------------------------------------------
    // GET /api/v1/simulation/state
    // ------------------------------------------------------------------------
    app.get(
      "/api/v1/simulation/state",
      {
        preHandler: [
          requireAuthenticated,
          requirePermission("fleet:read")
        ]
      },
      async (request, reply) => {
        if (!simulatorSyncService) {
          return reply.status(200).send({
            running: false,
            drones: []
          });
        }

        const drones = simulatorSyncService.fleetSimulator
          .getAllDrones()
          .filter((d) => d.organizationId === request.user!.organizationId)
          .map((d) => ({
            droneId: d.id,
            organizationId: d.organizationId,
            state: d.state,
            position: d.kinematics.position,
            speedMps: d.kinematics.speedMetersPerSecond,
            headingDeg: d.kinematics.headingDegrees,
            batteryPercent: d.battery.percent
          }));

        return reply.status(200).send({
          running: true,
          drones
        });
      }
    );
  };
}
