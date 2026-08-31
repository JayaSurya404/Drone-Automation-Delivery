import type {
  AuthenticatedUser,
  AiRouteScoringRequest,
  AiRouteScoringResponse,
  AiEtaPredictionRequest,
  AiEtaPredictionResponse,
  AiBatteryPredictionRequest,
  AiBatteryPredictionResponse,
  AiMaintenancePredictionRequest,
  AiMaintenancePredictionResponse,
  AiWeatherRiskRequest,
  AiWeatherRiskResponse,
  AiDemandForecastRequest,
  AiDemandForecastResponse,
  MissionPlanEvaluationRequest,
  MissionPlanEvaluationResponse,
  RouteCandidate
} from "@skynav/contracts";
import type { AiClient } from "./ai.client.js";
import type { DeterministicSafetyGate } from "./safety-gate.js";
import type { FleetRepository } from "../fleet/fleet.repository.js";
import type { OrderRepository } from "../orders/order.repository.js";
import type { MissionRepository } from "../missions/mission.repository.js";
import type { AuditService } from "../audit/audit.service.js";

export class AiForbiddenError extends Error {
  public readonly code = "AI_FORBIDDEN";
  constructor(message = "You are not authorized to perform this AI operation.") {
    super(message);
    this.name = "AiForbiddenError";
  }
}

export class AiResourceNotFoundError extends Error {
  public readonly code = "AI_RESOURCE_NOT_FOUND";
  constructor(message = "Requested domain resource was not found in your organization.") {
    super(message);
    this.name = "AiResourceNotFoundError";
  }
}

export interface AiService {
  scoreRoutes(user: AuthenticatedUser, request: Omit<AiRouteScoringRequest, "organizationId">): Promise<AiRouteScoringResponse>;
  predictEta(user: AuthenticatedUser, request: Omit<AiEtaPredictionRequest, "organizationId">): Promise<AiEtaPredictionResponse>;
  predictBattery(user: AuthenticatedUser, request: Omit<AiBatteryPredictionRequest, "organizationId">): Promise<AiBatteryPredictionResponse>;
  predictMaintenance(user: AuthenticatedUser, request: Omit<AiMaintenancePredictionRequest, "organizationId">): Promise<AiMaintenancePredictionResponse>;
  assessWeatherRisk(user: AuthenticatedUser, request: AiWeatherRiskRequest): Promise<AiWeatherRiskResponse>;
  forecastDemand(user: AuthenticatedUser, request: Omit<AiDemandForecastRequest, "organizationId">): Promise<AiDemandForecastResponse>;
  evaluateMissionPlan(user: AuthenticatedUser, request: MissionPlanEvaluationRequest): Promise<MissionPlanEvaluationResponse>;
}

export function createAiService(params: {
  aiClient: AiClient;
  safetyGate: DeterministicSafetyGate;
  fleetRepo?: FleetRepository;
  orderRepo?: OrderRepository;
  missionRepo?: MissionRepository;
  auditService?: AuditService;
}): AiService {
  const { aiClient, safetyGate, fleetRepo, orderRepo, missionRepo, auditService } = params;

  return {
    async scoreRoutes(user, request) {
      const fullReq: AiRouteScoringRequest = {
        ...request,
        organizationId: user.organizationId
      };

      const result = await aiClient.scoreRoutes(fullReq);

      if (auditService) {
        await auditService.log({
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "AI_ROUTE_SCORED",
          resourceType: "route",
          resourceId: result.recommendedRouteId || "candidates",
          metadata: {
            candidatesCount: request.candidates.length,
            recommendedRouteId: result.recommendedRouteId,
            modelVersion: result.modelVersion
          }
        });
      }

      return result;
    },

    async predictEta(user, request) {
      const fullReq: AiEtaPredictionRequest = {
        ...request,
        organizationId: user.organizationId
      };
      return aiClient.predictEta(fullReq);
    },

    async predictBattery(user, request) {
      // Validate drone belongs to organization if fleetRepo provided
      if (fleetRepo && request.droneId) {
        const drone = await fleetRepo.findById(request.droneId, user.organizationId);
        if (!drone) {
          throw new AiResourceNotFoundError(`Drone '${request.droneId}' not found in your organization.`);
        }
      }

      const fullReq: AiBatteryPredictionRequest = {
        ...request,
        organizationId: user.organizationId
      };
      return aiClient.predictBattery(fullReq);
    },

    async predictMaintenance(user, request) {
      if (fleetRepo && request.droneId) {
        const drone = await fleetRepo.findById(request.droneId, user.organizationId);
        if (!drone) {
          throw new AiResourceNotFoundError(`Drone '${request.droneId}' not found in your organization.`);
        }
      }

      const fullReq: AiMaintenancePredictionRequest = {
        ...request,
        organizationId: user.organizationId
      };

      const result = await aiClient.predictMaintenance(fullReq);

      if (auditService) {
        await auditService.log({
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "AI_MAINTENANCE_PREDICTED",
          resourceType: "drone",
          resourceId: request.droneId,
          metadata: {
            overallRiskScore: result.overallRiskScore,
            overallRiskLevel: result.overallRiskLevel,
            priority: result.maintenancePriority
          }
        });
      }

      return result;
    },

    async assessWeatherRisk(user, request) {
      return aiClient.assessWeatherRisk(request);
    },

    async forecastDemand(user, request) {
      const fullReq: AiDemandForecastRequest = {
        ...request,
        organizationId: user.organizationId
      };

      const result = await aiClient.forecastDemand(fullReq);

      if (auditService) {
        await auditService.log({
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "AI_DEMAND_FORECASTED",
          resourceType: "analytics",
          resourceId: user.organizationId,
          metadata: {
            forecastHorizonHours: result.forecastHorizonHours,
            totalPredictedOrders: result.totalPredictedOrders,
            recommendedFleetSize: result.recommendedFleetSize
          }
        });
      }

      return result;
    },

    async evaluateMissionPlan(user, request) {
      // 1. Verify order belongs to organization
      let orderRecord = null;
      if (orderRepo) {
        orderRecord = await orderRepo.findById(request.orderId, user.organizationId);
        if (!orderRecord) {
          throw new AiResourceNotFoundError(`Order '${request.orderId}' not found in your organization.`);
        }
      }

      // 2. Determine or fetch drone specs
      let droneBattery = 100.0;
      let droneMaxPayload = 5000.0;

      if (fleetRepo && request.droneId) {
        const drone = await fleetRepo.findById(request.droneId, user.organizationId);
        if (drone) {
          droneBattery = drone.battery_percent;
          droneMaxPayload = drone.max_payload_grams;
        }
      }

      // 3. Formulate candidate routes if none passed
      const candidateList: RouteCandidate[] = request.candidateRoutes && request.candidateRoutes.length > 0
        ? request.candidateRoutes
        : [
            {
              id: "route-primary-direct",
              name: "Primary Direct Flight Plan",
              waypoints: [request.origin, request.destination],
              cruiseAltitudeMeters: 60.0,
              targetSpeedMps: 15.0
            },
            {
              id: "route-corridor-alt",
              name: "Midway Corridor Fix Bravo",
              waypoints: [
                request.origin,
                {
                  latitude: (request.origin.latitude + request.destination.latitude) / 2 + 0.002,
                  longitude: (request.origin.longitude + request.destination.longitude) / 2 - 0.002,
                  altitudeMeters: 60.0
                },
                request.destination
              ],
              cruiseAltitudeMeters: 60.0,
              targetSpeedMps: 14.0
            }
          ];

      // 4. Run AI Advisory Route Scoring
      const aiScoreResult = await aiClient.scoreRoutes({
        organizationId: user.organizationId,
        orderId: request.orderId,
        droneId: request.droneId,
        packageWeightGrams: request.packageWeightGrams,
        droneMaxPayloadGrams: droneMaxPayload,
        droneBatteryPercent: droneBattery,
        droneBatteryCapacityMah: 10000,
        candidates: candidateList,
        priority: "STANDARD"
      });

      const topAiCandidate = aiScoreResult.candidates[0];

      // 5. Authoritative Deterministic Safety Gate
      const gateResult = safetyGate.evaluateCandidate({
        candidate: topAiCandidate,
        packageWeightGrams: request.packageWeightGrams,
        droneMaxPayloadGrams: droneMaxPayload,
        droneBatteryPercent: droneBattery,
        estimatedConsumptionPercent: topAiCandidate.estimatedBatteryConsumptionPercent
      });

      const isAuthorized = gateResult.passed && topAiCandidate.batteryFeasibility !== "NOT_FEASIBLE";
      const rationale = isAuthorized
        ? `AI recommended '${topAiCandidate.name}' (Score ${topAiCandidate.score}/100) which passed all deterministic safety gates.`
        : `Mission authorization withheld: ${gateResult.rejectionReasons.join("; ")}`;

      if (auditService) {
        await auditService.log({
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "AI_SAFETY_GATE_EVALUATED",
          resourceType: "order",
          resourceId: request.orderId,
          metadata: {
            isAuthorized,
            passedSafetyGate: gateResult.passed,
            topAiCandidateId: topAiCandidate.id,
            rejectionReasons: gateResult.rejectionReasons
          }
        });
      }

      return {
        orderId: request.orderId,
        evaluatedAt: new Date().toISOString(),
        aiRecommendation: topAiCandidate,
        deterministicSafetyGate: gateResult,
        isMissionAuthorized: isAuthorized,
        authorizedRoute: isAuthorized
          ? {
              id: topAiCandidate.id,
              name: topAiCandidate.name,
              waypoints: topAiCandidate.waypoints,
              cruiseAltitudeMeters: topAiCandidate.waypoints[0]?.altitudeMeters || 60.0,
              targetSpeedMps: 15.0
            }
          : undefined,
        operatorDecisionRationale: rationale
      };
    }
  };
}
