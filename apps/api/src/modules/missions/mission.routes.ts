import type { FastifyPluginAsync } from "fastify";
import {
  createMissionRequestSchema,
  assignMissionRequestSchema,
  updateMissionStatusRequestSchema,
  cancelMissionRequestSchema,
  missionListQuerySchema,
  uuidSchema
} from "@skynav/contracts";
import type { MissionService } from "./mission.service.js";
import { requireAuthenticated, requirePermission } from "../auth/rbac.js";
import { requireTenantIsolation } from "../tenant/tenant.guard.js";

export function createMissionRoutes(missionService: MissionService): FastifyPluginAsync {
  return async function missionRoutes(app) {
    // ------------------------------------------------------------------------
    // POST /api/v1/missions: Create a new delivery mission for an order
    // ------------------------------------------------------------------------
    app.post(
      "/api/v1/missions",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("missions:create")
        ]
      },
      async (request, reply) => {
        const body = createMissionRequestSchema.parse(request.body);
        const mission = await missionService.createMission(request.user!, body);
        return reply.status(201).send({ data: mission });
      }
    );

    // ------------------------------------------------------------------------
    // GET /api/v1/missions: List missions (scoped by organization)
    // ------------------------------------------------------------------------
    app.get(
      "/api/v1/missions",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("missions:read")
        ]
      },
      async (request, reply) => {
        const query = missionListQuerySchema.parse(request.query);
        const result = await missionService.listMissions(request.user!, query);
        return reply.status(200).send(result);
      }
    );

    // ------------------------------------------------------------------------
    // GET /api/v1/missions/:missionId/detail: Retrieve comprehensive mission details
    // ------------------------------------------------------------------------
    app.get<{ Params: { missionId: string } }>(
      "/api/v1/missions/:missionId/detail",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("missions:read")
        ]
      },
      async (request, reply) => {
        const missionId = uuidSchema.parse(request.params.missionId);
        const mission = await missionService.getMissionDetail(request.user!, missionId);
        return reply.status(200).send({ data: mission });
      }
    );

    // ------------------------------------------------------------------------
    // GET /api/v1/missions/:missionId: Retrieve single mission by ID
    // ------------------------------------------------------------------------
    app.get<{ Params: { missionId: string } }>(
      "/api/v1/missions/:missionId",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("missions:read")
        ]
      },
      async (request, reply) => {
        const missionId = uuidSchema.parse(request.params.missionId);
        const mission = await missionService.getMission(request.user!, missionId);
        return reply.status(200).send({ data: mission });
      }
    );

    // ------------------------------------------------------------------------
    // POST /api/v1/missions/:missionId/assign: Assign a drone to a mission
    // ------------------------------------------------------------------------
    app.post<{ Params: { missionId: string } }>(
      "/api/v1/missions/:missionId/assign",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("missions:authorize")
        ]
      },
      async (request, reply) => {
        const missionId = uuidSchema.parse(request.params.missionId);
        const body = assignMissionRequestSchema.parse(request.body);
        const mission = await missionService.assignDrone(request.user!, missionId, body.droneId);
        return reply.status(200).send({ data: mission });
      }
    );

    // ------------------------------------------------------------------------
    // PATCH /api/v1/missions/:missionId/status: Operational mission status update
    // ------------------------------------------------------------------------
    app.patch<{ Params: { missionId: string } }>(
      "/api/v1/missions/:missionId/status",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("missions:command")
        ]
      },
      async (request, reply) => {
        const missionId = uuidSchema.parse(request.params.missionId);
        const body = updateMissionStatusRequestSchema.parse(request.body);
        const mission = await missionService.updateMissionStatus(request.user!, missionId, body);
        return reply.status(200).send({ data: mission });
      }
    );

    // ------------------------------------------------------------------------
    // POST /api/v1/missions/:missionId/cancel: Safely cancel mission & command RTH
    // ------------------------------------------------------------------------
    app.post<{ Params: { missionId: string } }>(
      "/api/v1/missions/:missionId/cancel",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requirePermission("missions:command")
        ]
      },
      async (request, reply) => {
        const missionId = uuidSchema.parse(request.params.missionId);
        const body = cancelMissionRequestSchema.parse(request.body);
        const result = await missionService.cancelMission(request.user!, missionId, body.reason);
        return reply.status(200).send({ data: result });
      }
    );
  };
}
