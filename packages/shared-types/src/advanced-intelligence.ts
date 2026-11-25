import { z } from "zod";

/**
 * Phase 11 — Advanced Drone Intelligence. Mirrors the API's view interfaces
 * exactly (`VisionService`/`LandingZoneService`/`SwarmService`/
 * `SwarmPlanningService`/`DigitalTwinService`/`RouteIntelligenceService`).
 * Every one of these is admin/ops-only — no customer-facing type is added
 * here, per Part 11's "do not expose internal computer-vision, swarm, or
 * security information."
 */

export const visionDetectionClassSchema = z.enum(["PERSON", "VEHICLE", "ANIMAL", "OBSTACLE", "STRUCTURE", "VEGETATION", "OPEN_GROUND"]);
export type VisionDetectionClass = z.infer<typeof visionDetectionClassSchema>;

export const boundingBoxSchema = z.object({ xMin: z.number(), yMin: z.number(), xMax: z.number(), yMax: z.number() });
export type BoundingBox = z.infer<typeof boundingBoxSchema>;

export const detectedObjectSchema = z.object({ class: visionDetectionClassSchema, confidence: z.number(), boundingBox: boundingBoxSchema });
export type DetectedObject = z.infer<typeof detectedObjectSchema>;

export const landingZoneCandidateSchema = z.object({ lat: z.number(), lng: z.number(), radiusMeters: z.number(), clearanceScore: z.number() });
export type LandingZoneCandidate = z.infer<typeof landingZoneCandidateSchema>;

export const visionAnalysisSchema = z.object({
  id: z.string(),
  droneId: z.string().nullable(),
  missionId: z.string().nullable(),
  deliveryId: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  altitudeMeters: z.number(),
  objects: z.array(detectedObjectSchema),
  landingZoneCandidates: z.array(landingZoneCandidateSchema),
  landingZoneCandidateCount: z.number(),
  obstructed: z.boolean(),
  humanDetected: z.boolean(),
  modelProvider: z.string(),
  summary: z.string(),
  createdAt: z.string(),
});
export type VisionAnalysis = z.infer<typeof visionAnalysisSchema>;

export const landingZoneVerdictSchema = z.enum(["SUITABLE", "MARGINAL", "UNSUITABLE"]);
export type LandingZoneVerdict = z.infer<typeof landingZoneVerdictSchema>;

export const navigationRecommendationSchema = z.enum(["PROCEED", "HOLD", "ABORT_LANDING"]);
export type NavigationRecommendation = z.infer<typeof navigationRecommendationSchema>;

export const visualNavigationHintSchema = z.object({ recommendation: navigationRecommendationSchema, message: z.string(), reasons: z.array(z.string()) });
export type VisualNavigationHint = z.infer<typeof visualNavigationHintSchema>;

export const landingZoneEvaluationSchema = z.object({
  id: z.string(),
  missionId: z.string().nullable(),
  deliveryId: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  radiusMeters: z.number(),
  sizeScore: z.number(),
  obstructionScore: z.number(),
  safetyScore: z.number(),
  proximityScore: z.number(),
  suitabilityScore: z.number(),
  verdict: landingZoneVerdictSchema,
  reasons: z.array(z.string()),
  navigationHint: visualNavigationHintSchema.optional(),
  visionAnalysis: visionAnalysisSchema.optional(),
  createdAt: z.string(),
});
export type LandingZoneEvaluation = z.infer<typeof landingZoneEvaluationSchema>;

// --- Swarm ---------------------------------------------------------------

export const swarmMemberSchema = z.object({ id: z.string(), droneId: z.string(), droneName: z.string(), role: z.enum(["LEADER", "FOLLOWER"]), joinedAt: z.string() });
export type SwarmMember = z.infer<typeof swarmMemberSchema>;

export const swarmSchema = z.object({ id: z.string(), name: z.string(), status: z.enum(["ACTIVE", "DISBANDED"]), memberCount: z.number(), createdAt: z.string() });
export type Swarm = z.infer<typeof swarmSchema>;

export const swarmDetailSchema = swarmSchema.extend({ members: z.array(swarmMemberSchema) });
export type SwarmDetail = z.infer<typeof swarmDetailSchema>;

export const swarmAssignmentSchema = z.object({
  id: z.string(),
  droneId: z.string().nullable(),
  droneName: z.string().nullable(),
  deliveryId: z.string().nullable(),
  targetLat: z.number(),
  targetLng: z.number(),
  sequence: z.number(),
  estimatedDistanceMeters: z.number(),
  estimatedDurationSeconds: z.number(),
  batteryFeasibility: z.string(),
  payloadSuitable: z.boolean(),
  score: z.number(),
  reason: z.string(),
});
export type SwarmAssignment = z.infer<typeof swarmAssignmentSchema>;

export const swarmPlanUnassignedTargetSchema = z.object({ deliveryId: z.string().nullable(), lat: z.number(), lng: z.number(), reason: z.string() });
export type SwarmPlanUnassignedTarget = z.infer<typeof swarmPlanUnassignedTargetSchema>;

export const swarmPlanSchema = z.object({
  id: z.string(),
  swarmId: z.string(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]),
  objective: z.string(),
  summary: z.string(),
  assignments: z.array(swarmAssignmentSchema),
  unassignedTargets: z.array(swarmPlanUnassignedTargetSchema),
  createdAt: z.string(),
});
export type SwarmPlan = z.infer<typeof swarmPlanSchema>;

// --- Digital twin ----------------------------------------------------------

export const simulationScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  originLat: z.number(),
  originLng: z.number(),
  destinationLat: z.number(),
  destinationLng: z.number(),
  droneId: z.string().nullable(),
  payloadKg: z.number(),
  priority: z.string(),
  weatherOverride: z.unknown().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type SimulationScenario = z.infer<typeof simulationScenarioSchema>;

export const simulationRiskCategorySchema = z.enum([
  "LOW_BATTERY",
  "UNSAFE_LANDING_ZONE",
  "ROUTE_OBSTRUCTION",
  "GEOFENCE_CONFLICT",
  "WEATHER_CONFLICT",
  "PAYLOAD_CONSTRAINT",
  "DRONE_AVAILABILITY_CONFLICT",
]);
export type SimulationRiskCategory = z.infer<typeof simulationRiskCategorySchema>;

export const simulationRiskSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type SimulationRiskSeverity = z.infer<typeof simulationRiskSeveritySchema>;

export const simulationRiskFindingSchema = z.object({ id: z.string(), category: simulationRiskCategorySchema, severity: simulationRiskSeveritySchema, message: z.string() });
export type SimulationRiskFinding = z.infer<typeof simulationRiskFindingSchema>;

export const simulationRunSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  status: z.enum(["COMPLETED", "FAILED"]),
  routeSelected: z.boolean(),
  distanceMeters: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  estimatedBatteryUsedPercent: z.number().nullable(),
  riskScore: z.number().nullable(),
  riskLevel: z.string().nullable(),
  summary: z.string(),
  riskFindings: z.array(simulationRiskFindingSchema),
  startedAt: z.string(),
  completedAt: z.string(),
  createdAt: z.string(),
});
export type SimulationRun = z.infer<typeof simulationRunSchema>;

// --- Shared route intelligence ---------------------------------------------

// --- Request shapes ---------------------------------------------------------

export interface AnalyzeVisionFrameRequest {
  droneId?: string;
  missionId?: string;
  deliveryId?: string;
  lat: number;
  lng: number;
  altitudeMeters?: number;
}

export interface EvaluateLandingZoneRequest extends AnalyzeVisionFrameRequest {
  targetLat?: number;
  targetLng?: number;
}

export interface CreateSwarmRequest {
  name: string;
}

export interface AddSwarmMemberRequest {
  droneId: string;
  role?: "LEADER" | "FOLLOWER";
}

export interface SwarmPlanTargetRequest {
  deliveryId?: string;
  lat: number;
  lng: number;
  payloadKg: number;
  priority?: "STANDARD" | "EXPRESS";
}

export interface CreateSwarmPlanRequest {
  objective: string;
  targets: SwarmPlanTargetRequest[];
}

export interface CreateSimulationScenarioRequest {
  name: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  droneId?: string;
  payloadKg?: number;
  priority?: "STANDARD" | "EXPRESS";
  weatherOverride?: { windSpeedMps: number; precipitationMm: number; condition: string };
  notes?: string;
}

export interface RouteIntelligenceQuery {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}

export const routeIntelligenceObservationSchema = z.object({
  sampleSize: z.number(),
  averageDistanceMeters: z.number().nullable(),
  averageDurationSeconds: z.number().nullable(),
  averageBatteryDropPercent: z.number().nullable(),
  abortCount: z.number(),
  abortRate: z.number().nullable(),
  hazardBreakdown: z.record(z.string(), z.number()),
  lookbackDays: z.number(),
  matchRadiusMeters: z.number(),
});
export type RouteIntelligenceObservation = z.infer<typeof routeIntelligenceObservationSchema>;
