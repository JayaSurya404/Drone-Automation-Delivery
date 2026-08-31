import type { FastifyPluginAsync } from "fastify";
import {
  aiRouteScoringRequestSchema,
  aiEtaPredictionRequestSchema,
  aiBatteryPredictionRequestSchema,
  aiMaintenancePredictionRequestSchema,
  aiWeatherRiskRequestSchema,
  aiDemandForecastRequestSchema,
  missionPlanEvaluationRequestSchema
} from "@skynav/contracts";
import type { AiService } from "./ai.service.js";
import { requireAuthenticated, requireRole } from "../auth/rbac.js";
import { requireTenantIsolation } from "../tenant/tenant.guard.js";

export function createAiRoutes(aiService: AiService): FastifyPluginAsync {
  return async function aiRoutes(fastify) {
    // 1. Route Candidate Scoring & Ranking
    fastify.post(
      "/api/v1/ai/routes/score",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER", "DISPATCHER"])
        ]
      },
      async (request, reply) => {
        const payload = aiRouteScoringRequestSchema.omit({ organizationId: true }).parse(request.body);
        const result = await aiService.scoreRoutes(request.user!, payload);
        return reply.status(200).send(result);
      }
    );

    // 2. Flight ETA Prediction
    fastify.post(
      "/api/v1/ai/eta/predict",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation
        ]
      },
      async (request, reply) => {
        const payload = aiEtaPredictionRequestSchema.omit({ organizationId: true }).parse(request.body);
        const result = await aiService.predictEta(request.user!, payload);
        return reply.status(200).send(result);
      }
    );

    // 3. Battery Consumption & Feasibility Prediction
    fastify.post(
      "/api/v1/ai/battery/predict",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER", "DISPATCHER"])
        ]
      },
      async (request, reply) => {
        const payload = aiBatteryPredictionRequestSchema.omit({ organizationId: true }).parse(request.body);
        const result = await aiService.predictBattery(request.user!, payload);
        return reply.status(200).send(result);
      }
    );

    // 4. Predictive Maintenance & Fleet Health
    fastify.post(
      "/api/v1/ai/maintenance/predict",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER"])
        ]
      },
      async (request, reply) => {
        const payload = aiMaintenancePredictionRequestSchema.omit({ organizationId: true }).parse(request.body);
        const result = await aiService.predictMaintenance(request.user!, payload);
        return reply.status(200).send(result);
      }
    );

    // 5. Meteorological Risk Assessment
    fastify.post(
      "/api/v1/ai/weather/risk",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER", "DISPATCHER"])
        ]
      },
      async (request, reply) => {
        const payload = aiWeatherRiskRequestSchema.parse(request.body);
        const result = await aiService.assessWeatherRisk(request.user!, payload);
        return reply.status(200).send(result);
      }
    );

    // 6. Delivery Demand Forecasting
    fastify.post(
      "/api/v1/ai/forecasting/demand",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER"])
        ]
      },
      async (request, reply) => {
        const payload = aiDemandForecastRequestSchema.omit({ organizationId: true }).parse(request.body);
        const result = await aiService.forecastDemand(request.user!, payload);
        return reply.status(200).send(result);
      }
    );

    // 7. Composite Mission Plan Evaluation (AI Scoring + Authoritative Safety Gate)
    fastify.post(
      "/api/v1/ai/missions/evaluate-plan",
      {
        preHandler: [
          requireAuthenticated,
          requireTenantIsolation,
          requireRole(["ADMIN", "OPERATOR", "FLEET_MANAGER", "DISPATCHER"])
        ]
      },
      async (request, reply) => {
        const payload = missionPlanEvaluationRequestSchema.parse(request.body);
        const result = await aiService.evaluateMissionPlan(request.user!, payload);
        return reply.status(200).send(result);
      }
    );
  };
}
