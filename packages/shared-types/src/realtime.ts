import { z } from "zod";
import { deliveryStatusSchema } from "./delivery";

/**
 * The exact set of domain events the WebSocket gateways relay. Every one of
 * these already existed as an in-process `EventEmitter2` event before Phase
 * 7 (Phase 6's drone/mission events) except `delivery.status_changed`
 * (Phase 7, so every delivery status transition is visible to the customer
 * tracking UI) and the five Phase 8 safety events (`weather.warning`,
 * `weather.unsafe`, `geofence.violation`, `mission.safety_blocked`,
 * `mission.safety_cleared`) — see `docs/ARCHITECTURE.md`'s Realtime and
 * "Weather, Geofencing, and Safety" sections. `weather.*`/`geofence.violation`
 * are ops-only (never relayed to a customer's `/tracking` room — raw
 * weather/geofence detail is internal); `mission.safety_blocked`/
 * `mission.safety_cleared` reach both rooms but with different payloads —
 * ops gets the full reason, tracking gets a sanitized customer-safe message.
 * The six Phase 9 AI events (`route.optimized`, `route.rejected`,
 * `route.rerouted`, `eta.predicted`, `delivery.risk_assessed`,
 * `drone.recommended`) follow the same split: all six carry the full,
 * explainable payload to `ops:fleet`/`mission:<id>`, but only `eta.predicted`
 * also reaches a customer's `/tracking` room, and only with a sanitized
 * `{ deliveryId, etaAt }` echo — never the internal factors/confidence
 * detail, and never the route/risk/fleet-scoring events at all (see
 * `docs/ARCHITECTURE.md`'s "AI Intelligence" section).
 */
export const realtimeEventTypeSchema = z.enum([
  "drone.created",
  "drone.status_changed",
  "drone.location_updated",
  "drone.battery_updated",
  "mission.created",
  "mission.started",
  "mission.progressed",
  "mission.completed",
  "mission.aborted",
  "drone.return_to_home",
  "delivery.status_changed",
  "weather.warning",
  "weather.unsafe",
  "geofence.violation",
  "mission.safety_blocked",
  "mission.safety_cleared",
  "route.optimized",
  "route.rejected",
  "route.rerouted",
  "eta.predicted",
  "delivery.risk_assessed",
  "drone.recommended",
  "vision.detected",
  "landing_zone.evaluated",
  "swarm.plan_created",
  "swarm.assignment_changed",
  "swarm.disbanded",
  "digital_twin.simulation_started",
  "digital_twin.simulation_completed",
  "advanced_risk.detected",
]);
export type RealtimeEventType = z.infer<typeof realtimeEventTypeSchema>;

/** A versioned, minimal envelope — `data` only ever carries the fields the receiving room is authorized to see (see `RealtimeBroadcasterService`), never a full staff-only mission/drone record. */
export const realtimeEnvelopeSchema = z.object({
  v: z.literal(1),
  type: realtimeEventTypeSchema,
  ts: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type RealtimeEnvelope = z.infer<typeof realtimeEnvelopeSchema>;

export const droneLocationEventDataSchema = z.object({
  droneId: z.string(),
  lat: z.number(),
  lng: z.number(),
  missionId: z.string().optional(),
  deliveryId: z.string().optional(),
});
export type DroneLocationEventData = z.infer<typeof droneLocationEventDataSchema>;

export const droneBatteryEventDataSchema = z.object({
  droneId: z.string(),
  batteryPercent: z.number(),
  missionId: z.string().optional(),
  deliveryId: z.string().optional(),
});
export type DroneBatteryEventData = z.infer<typeof droneBatteryEventDataSchema>;

export const droneStatusEventDataSchema = z.object({
  droneId: z.string(),
  fromStatus: z.string().nullable().optional(),
  toStatus: z.string(),
});
export type DroneStatusEventData = z.infer<typeof droneStatusEventDataSchema>;

export const missionLifecycleEventDataSchema = z.object({
  missionId: z.string(),
  deliveryId: z.string(),
  reason: z.string().optional(),
  droneId: z.string().optional(),
});
export type MissionLifecycleEventData = z.infer<typeof missionLifecycleEventDataSchema>;

/** Ops-only payload — full reasons/zone names, never sent to a customer's `/tracking` room. */
export const weatherSafetyEventDataSchema = z.object({
  missionId: z.string(),
  deliveryId: z.string(),
  reasons: z.array(z.string()),
});
export type WeatherSafetyEventData = z.infer<typeof weatherSafetyEventDataSchema>;

/** Ops-only payload — full zone names, never sent to a customer's `/tracking` room. */
export const geofenceViolationEventDataSchema = z.object({
  missionId: z.string().optional(),
  deliveryId: z.string(),
  zoneNames: z.array(z.string()),
  zoneIds: z.array(z.string()).optional(),
});
export type GeofenceViolationEventData = z.infer<typeof geofenceViolationEventDataSchema>;

export const missionSafetyCategorySchema = z.enum(["WEATHER", "GEOFENCE"]);
export type MissionSafetyCategory = z.infer<typeof missionSafetyCategorySchema>;

/** Full ops payload for `mission.safety_blocked`. The customer-facing `/tracking` copy of this event carries only `{ deliveryId, category }` plus a generic, pre-written safe message — never this `reason` string (see `RealtimeBroadcasterService`). */
export const missionSafetyBlockedEventDataSchema = z.object({
  missionId: z.string(),
  deliveryId: z.string(),
  category: missionSafetyCategorySchema,
  reason: z.string(),
});
export type MissionSafetyBlockedEventData = z.infer<typeof missionSafetyBlockedEventDataSchema>;

export const missionSafetyClearedEventDataSchema = z.object({
  missionId: z.string(),
  deliveryId: z.string(),
});
export type MissionSafetyClearedEventData = z.infer<typeof missionSafetyClearedEventDataSchema>;

export const deliveryStatusChangedEventDataSchema = z.object({
  deliveryId: z.string(),
  fromStatus: deliveryStatusSchema.nullable(),
  toStatus: deliveryStatusSchema,
  note: z.string().nullable(),
});
export type DeliveryStatusChangedEventData = z.infer<typeof deliveryStatusChangedEventDataSchema>;

// --- Phase 9 AI events -----------------------------------------------
// Ops-only unless noted — see the doc comment on realtimeEventTypeSchema.

export const routeOptimizedEventDataSchema = z.object({
  missionId: z.string(),
  deliveryId: z.string(),
  routeId: z.string(),
  distanceMeters: z.number(),
  alternativesConsidered: z.number(),
});
export type RouteOptimizedEventData = z.infer<typeof routeOptimizedEventDataSchema>;

/** Emitted at mission-creation time when no candidate route clears geofencing — no `missionId` yet, since the mission is never created. */
export const routeRejectedEventDataSchema = z.object({
  deliveryId: z.string(),
  reasons: z.array(z.string()),
});
export type RouteRejectedEventData = z.infer<typeof routeRejectedEventDataSchema>;

export const routeRerouteEventDataSchema = z.object({
  missionId: z.string(),
  deliveryId: z.string(),
  routeId: z.string(),
  distanceMeters: z.number(),
  reason: z.string(),
});
export type RouteRerouteEventData = z.infer<typeof routeRerouteEventDataSchema>;

export const etaConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type EtaConfidence = z.infer<typeof etaConfidenceSchema>;

/** Full ops payload. The customer-facing `/tracking` copy of this event carries only `{ deliveryId, etaAt }` — never `confidence`/`factors` (see `RealtimeBroadcasterService`). */
export const etaPredictedEventDataSchema = z.object({
  missionId: z.string(),
  deliveryId: z.string(),
  etaAt: z.string(),
  confidence: etaConfidenceSchema,
  factors: z.array(z.string()),
});
export type EtaPredictedEventData = z.infer<typeof etaPredictedEventDataSchema>;

export const aiRiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type AiRiskLevel = z.infer<typeof aiRiskLevelSchema>;

/** Ops-only — internal risk score/reasons must never reach a customer (phase-09 security requirement). */
export const deliveryRiskAssessedEventDataSchema = z.object({
  missionId: z.string(),
  deliveryId: z.string(),
  score: z.number(),
  level: aiRiskLevelSchema,
  requiresApproval: z.boolean(),
  reasons: z.array(z.string()),
});
export type DeliveryRiskAssessedEventData = z.infer<typeof deliveryRiskAssessedEventDataSchema>;

/** Ops-only — internal fleet-scoring detail must never reach a customer (phase-09 security requirement). */
export const droneRecommendedEventDataSchema = z.object({
  missionId: z.string(),
  deliveryId: z.string(),
  droneId: z.string(),
  droneName: z.string(),
  score: z.number(),
});
export type DroneRecommendedEventData = z.infer<typeof droneRecommendedEventDataSchema>;

// --- Phase 11 advanced-intelligence events ----------------------------
// All ops-only (never relayed to a customer's `/tracking` room) — see
// docs/ARCHITECTURE.md's "Advanced Drone Intelligence" section. Every
// payload is bounded: ids, counts, and scores only, never a raw detection
// array or a full simulation trace.

export const visionDetectedEventDataSchema = z.object({
  analysisId: z.string(),
  droneId: z.string().nullable(),
  missionId: z.string().nullable(),
  objectCount: z.number(),
  obstructed: z.boolean(),
  humanDetected: z.boolean(),
});
export type VisionDetectedEventData = z.infer<typeof visionDetectedEventDataSchema>;

export const landingZoneEvaluatedEventDataSchema = z.object({
  evaluationId: z.string(),
  missionId: z.string().nullable(),
  deliveryId: z.string().nullable(),
  verdict: z.enum(["SUITABLE", "MARGINAL", "UNSUITABLE"]),
  suitabilityScore: z.number(),
});
export type LandingZoneEvaluatedEventData = z.infer<typeof landingZoneEvaluatedEventDataSchema>;

export const swarmPlanCreatedEventDataSchema = z.object({
  swarmId: z.string(),
  planId: z.string(),
  assignmentCount: z.number(),
  unassignedCount: z.number(),
});
export type SwarmPlanCreatedEventData = z.infer<typeof swarmPlanCreatedEventDataSchema>;

export const swarmAssignmentChangedEventDataSchema = z.object({
  planId: z.string(),
  assignmentId: z.string(),
  droneId: z.string(),
});
export type SwarmAssignmentChangedEventData = z.infer<typeof swarmAssignmentChangedEventDataSchema>;

export const digitalTwinSimulationStartedEventDataSchema = z.object({
  scenarioId: z.string(),
  startedAt: z.string(),
});
export type DigitalTwinSimulationStartedEventData = z.infer<typeof digitalTwinSimulationStartedEventDataSchema>;

export const digitalTwinSimulationCompletedEventDataSchema = z.object({
  scenarioId: z.string(),
  runId: z.string(),
  status: z.string(),
  riskFindingCount: z.number(),
});
export type DigitalTwinSimulationCompletedEventData = z.infer<typeof digitalTwinSimulationCompletedEventDataSchema>;

export const advancedRiskDetectedEventDataSchema = z.object({
  source: z.string(),
  missionId: z.string().nullable().optional(),
  deliveryId: z.string().nullable().optional(),
  scenarioId: z.string().optional(),
  runId: z.string().optional(),
  severity: z.string(),
  message: z.string(),
});
export type AdvancedRiskDetectedEventData = z.infer<typeof advancedRiskDetectedEventDataSchema>;
