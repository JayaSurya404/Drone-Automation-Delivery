import { z } from "zod";

export const missionTypeSchema = z.enum(["DELIVERY", "RETURN_TO_HOME"]);
export type MissionType = z.infer<typeof missionTypeSchema>;

export const missionStatusSchema = z.enum(["PLANNED", "DISPATCHED", "IN_PROGRESS", "RETURNING", "COMPLETED", "ABORTED"]);
export type MissionStatus = z.infer<typeof missionStatusSchema>;

export const missionSafetyStateSchema = z.enum(["NOMINAL", "LOW_BATTERY", "SIGNAL_LOSS", "EMERGENCY", "WEATHER_HOLD", "GEOFENCE_BREACH"]);
export type MissionSafetyState = z.infer<typeof missionSafetyStateSchema>;

export const waypointStatusSchema = z.enum(["PENDING", "REACHED", "SKIPPED"]);
export type WaypointStatus = z.infer<typeof waypointStatusSchema>;

export const waypointSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  lat: z.number(),
  lng: z.number(),
  altitudeMeters: z.number(),
  status: waypointStatusSchema,
  reachedAt: z.string().nullable(),
});
export type Waypoint = z.infer<typeof waypointSchema>;

export const missionEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  fromStatus: missionStatusSchema.nullable(),
  toStatus: missionStatusSchema.nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type MissionEvent = z.infer<typeof missionEventSchema>;

/** `DeliveryRiskAnalyzer`'s output (Phase 9) — distinct from `missionSafetyStateSchema`, which represents hard, mission-engine-detected safety conditions (see `apps/api/prisma/schema.prisma`'s doc comment on `MissionRiskLevel`). */
export const missionRiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type MissionRiskLevel = z.infer<typeof missionRiskLevelSchema>;

export const missionDetailSchema = z.object({
  id: z.string(),
  deliveryId: z.string(),
  droneId: z.string().nullable(),
  droneName: z.string().nullable(),
  operatorId: z.string().nullable(),
  type: missionTypeSchema,
  status: missionStatusSchema,
  safetyState: missionSafetyStateSchema,
  originLat: z.number(),
  originLng: z.number(),
  destinationLat: z.number(),
  destinationLng: z.number(),
  rthTriggered: z.boolean(),
  abortReason: z.string().nullable(),
  /** `AiDecisionLog`-backed risk fields (Phase 9) — see `docs/ARCHITECTURE.md`'s "AI Intelligence" section. `requiresApproval` gates `POST /missions/:id/start`; `POST /missions/:id/approve` is the only way to clear it. */
  riskScore: z.number().nullable(),
  riskLevel: missionRiskLevelSchema.nullable(),
  requiresApproval: z.boolean(),
  approvedById: z.string().nullable(),
  approvedAt: z.string().nullable(),
  plannedAt: z.string(),
  startedAt: z.string().nullable(),
  arrivedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  abortedAt: z.string().nullable(),
  waypoints: z.array(waypointSchema),
  events: z.array(missionEventSchema),
});
export type MissionDetail = z.infer<typeof missionDetailSchema>;

export const paginatedMissionsSchema = z.object({
  missions: z.array(missionDetailSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PaginatedMissions = z.infer<typeof paginatedMissionsSchema>;

export const createMissionRequestSchema = z.object({
  deliveryId: z.string(),
});
export type CreateMissionRequest = z.infer<typeof createMissionRequestSchema>;

export const assignDroneRequestSchema = z.object({
  droneId: z.string(),
  operatorId: z.string().optional(),
});
export type AssignDroneRequest = z.infer<typeof assignDroneRequestSchema>;

export const missionOverrideActionSchema = z.enum(["RETURN_TO_HOME", "ABORT", "LAND"]);
export type MissionOverrideAction = z.infer<typeof missionOverrideActionSchema>;

export const missionOverrideRequestSchema = z.object({
  action: missionOverrideActionSchema,
  reason: z.string().min(3).max(500),
});
export type MissionOverrideRequest = z.infer<typeof missionOverrideRequestSchema>;

export const weatherSafetyLevelSchema = z.enum(["SAFE", "CAUTION", "UNSAFE"]);
export type WeatherSafetyLevel = z.infer<typeof weatherSafetyLevelSchema>;

export const weatherSafetyResultSchema = z.object({
  level: weatherSafetyLevelSchema,
  reasons: z.array(z.string()),
});
export type WeatherSafetyResult = z.infer<typeof weatherSafetyResultSchema>;

/** `GET /missions/:id/safety` — Phase 8, the admin mission-detail/blocked-missions safety readout. */
export const missionSafetySnapshotSchema = z.object({
  safetyState: missionSafetyStateSchema,
  weather: z.object({
    zoneKey: z.string(),
    lat: z.number(),
    lng: z.number(),
    windSpeedMps: z.number(),
    windDirectionDegrees: z.number().nullable(),
    precipitationMm: z.number(),
    temperatureCelsius: z.number(),
    condition: z.enum(["CLEAR", "CLOUDY", "RAIN", "STORM", "SNOW", "FOG"]),
    source: z.string(),
    fetchedAt: z.string(),
  }),
  weatherSafety: weatherSafetyResultSchema,
  geofenceViolations: z.array(z.object({ id: z.string(), name: z.string(), type: z.enum(["SERVICE_AREA", "NO_FLY", "RESTRICTED"]) })),
});
export type MissionSafetySnapshot = z.infer<typeof missionSafetySnapshotSchema>;

/** `GET /missions/safety-events` — the fleet-wide safety/incident feed. */
export const missionSafetyEventSchema = missionEventSchema.extend({
  missionId: z.string(),
  deliveryId: z.string(),
  droneName: z.string().nullable(),
});
export type MissionSafetyEvent = z.infer<typeof missionSafetyEventSchema>;

export const missionSafetyEventListSchema = z.array(missionSafetyEventSchema);

// --- Phase 9 AI intelligence -------------------------------------------

export const aiDecisionTypeSchema = z.enum(["ROUTE_OPTIMIZATION", "ETA_PREDICTION", "RISK_ASSESSMENT", "DRONE_RECOMMENDATION", "REROUTE"]);
export type AiDecisionType = z.infer<typeof aiDecisionTypeSchema>;

/** `GET /missions/:id/ai` — the explainability surface: every route/ETA/risk/drone-recommendation/reroute decision logged for a mission, most recent first. Only ever *final* decisions (never transient candidates) — see `AiDecisionLog`'s doc comment in `schema.prisma`. */
export const aiDecisionLogEntrySchema = z.object({
  id: z.string(),
  type: aiDecisionTypeSchema,
  deliveryId: z.string().nullable(),
  missionId: z.string().nullable(),
  summary: z.string(),
  inputs: z.unknown(),
  outputs: z.unknown(),
  score: z.number().nullable(),
  createdAt: z.string(),
});
export type AiDecisionLogEntry = z.infer<typeof aiDecisionLogEntrySchema>;

export const aiDecisionLogListSchema = z.array(aiDecisionLogEntrySchema);

/** `GET /missions/:id/ai/drone-recommendations` — a read-only, on-demand refresh of the same ranking `AiService.recommendDrones()` computes automatically at mission creation. Never assigns a drone itself (see `DroneSelectionService`'s doc comment). */
export const droneRecommendationSchema = z.object({
  droneId: z.string(),
  droneName: z.string(),
  score: z.number(),
  eligible: z.boolean(),
  reasons: z.array(z.string()),
});
export type DroneRecommendation = z.infer<typeof droneRecommendationSchema>;

export const droneRecommendationListSchema = z.array(droneRecommendationSchema);
