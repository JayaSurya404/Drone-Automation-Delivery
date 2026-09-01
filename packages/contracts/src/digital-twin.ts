import { z } from "zod";
import { cameraSourceSchema, landingZoneSuitabilitySchema, destinationVerificationStatusSchema } from "./vision.js";

export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitudeMeters: z.number().optional(),
  address: z.string().optional()
});
export type Coordinate = z.infer<typeof coordinateSchema>;

export const telemetryFreshnessSchema = z.enum(["LIVE", "DEGRADED", "STALE", "OFFLINE"]);
export type TelemetryFreshness = z.infer<typeof telemetryFreshnessSchema>;

export const droneStatusSchema = z.enum([
  "IDLE",
  "AVAILABLE",
  "ASSIGNED",
  "CHARGING",
  "IN_FLIGHT",
  "RETURNING",
  "LANDED",
  "MAINTENANCE",
  "EMERGENCY",
  "OFFLINE"
]);
export type DroneStatus = z.infer<typeof droneStatusSchema>;

// ============================================================================
// Digital Twin Health & Reconciliation Enums
// ============================================================================

export const twinHealthStatusSchema = z.enum([
  "HEALTHY",
  "DEGRADED",
  "CRITICAL",
  "INCONSISTENT",
  "OFFLINE"
]);
export type TwinHealthStatus = z.infer<typeof twinHealthStatusSchema>;

export const twinIssueSeveritySchema = z.enum([
  "INFO",
  "WARNING",
  "ERROR",
  "CRITICAL"
]);
export type TwinIssueSeverity = z.infer<typeof twinIssueSeveritySchema>;

export const twinDiagnosticIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: twinIssueSeveritySchema,
  timestamp: z.string().datetime(),
  details: z.record(z.unknown()).optional()
});
export type TwinDiagnosticIssue = z.infer<typeof twinDiagnosticIssueSchema>;

// ============================================================================
// Drone Twin Domain Model
// ============================================================================

export const droneTwinBatterySchema = z.object({
  percent: z.number().min(0).max(100),
  voltageVolts: z.number().positive().optional(),
  temperatureCelsius: z.number().optional(),
  isLow: z.boolean(),
  isCritical: z.boolean(),
  healthStatus: z.enum(["NORMAL", "DEGRADED", "CRITICAL"])
});
export type DroneTwinBattery = z.infer<typeof droneTwinBatterySchema>;

export const droneTwinPayloadSchema = z.object({
  weightGrams: z.number().nonnegative(),
  maxCapacityGrams: z.number().positive(),
  currentPackageId: z.string().optional(),
  isLoaded: z.boolean()
});
export type DroneTwinPayload = z.infer<typeof droneTwinPayloadSchema>;

export const droneTwinMissionContextSchema = z.object({
  missionId: z.string(),
  orderId: z.string(),
  state: z.string(),
  currentWaypointIndex: z.number().int().nonnegative(),
  totalWaypoints: z.number().int().nonnegative(),
  distanceToTargetMeters: z.number().nonnegative(),
  etaSeconds: z.number().nonnegative().optional()
});
export type DroneTwinMissionContext = z.infer<typeof droneTwinMissionContextSchema>;

export const perceptionTwinStateSchema = z.object({
  lastVisionTimestamp: z.string().datetime(),
  cameraSource: cameraSourceSchema,
  sceneType: z.string(),
  landingSuitability: landingZoneSuitabilitySchema,
  isTargetVerified: z.boolean(),
  hazardsDetectedCount: z.number().int().nonnegative(),
  detectionsSummary: z.array(z.string()),
  advisorySafetyStatus: z.string(),
  modelVersion: z.string()
});
export type PerceptionTwinState = z.infer<typeof perceptionTwinStateSchema>;

export const aiTwinStateSchema = z.object({
  lastScoredTimestamp: z.string().datetime(),
  routeScore: z.number().min(0).max(100).optional(),
  predictedEtaSeconds: z.number().nonnegative().optional(),
  batteryConsumptionPredictionPercent: z.number().nonnegative().optional(),
  maintenanceRiskRating: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  advisoryDisclaimer: z.string().default("AI recommendations are advisory only.")
});
export type AiTwinState = z.infer<typeof aiTwinStateSchema>;

export const droneTwinSchema = z.object({
  droneId: z.string(),
  organizationId: z.string(),
  callSign: z.string(),
  model: z.string(),
  operationalState: z.string(),
  authoritativeStatus: droneStatusSchema.optional(),
  position: coordinateSchema.extend({
    altitudeMeters: z.number().nonnegative()
  }),
  headingDegrees: z.number().min(0).max(360),
  groundSpeedMps: z.number().nonnegative(),
  verticalSpeedMps: z.number(),
  battery: droneTwinBatterySchema,
  payload: droneTwinPayloadSchema,
  currentMission: droneTwinMissionContextSchema.optional(),
  telemetryFreshness: telemetryFreshnessSchema,
  lastTelemetryTimestamp: z.string().datetime().optional(),
  lastSyncTimestamp: z.string().datetime(),
  perceptionState: perceptionTwinStateSchema.optional(),
  aiAdvisoryState: aiTwinStateSchema.optional(),
  health: twinHealthStatusSchema,
  reconciliationWarnings: z.array(z.string()),
  revision: z.number().int().nonnegative()
});
export type DroneTwin = z.infer<typeof droneTwinSchema>;

// ============================================================================
// Mission Twin Domain Model
// ============================================================================

export const missionTwinBatteryProjectionSchema = z.object({
  estimatedConsumptionPercent: z.number().nonnegative(),
  remainingReservePercent: z.number().min(0).max(100),
  isReserveCompliant: z.boolean()
});
export type MissionTwinBatteryProjection = z.infer<typeof missionTwinBatteryProjectionSchema>;

export const missionTwinReconciliationSchema = z.object({
  isConsistent: z.boolean(),
  discrepancies: z.array(z.string())
});
export type MissionTwinReconciliation = z.infer<typeof missionTwinReconciliationSchema>;

export const missionTwinSchema = z.object({
  missionId: z.string(),
  organizationId: z.string(),
  orderId: z.string(),
  droneId: z.string().optional(),
  authoritativeState: z.string(),
  twinState: z.string(),
  origin: coordinateSchema.extend({ altitudeMeters: z.number().nonnegative().optional() }),
  destination: coordinateSchema.extend({ altitudeMeters: z.number().nonnegative().optional() }),
  currentWaypointIndex: z.number().int().nonnegative(),
  totalWaypoints: z.number().int().nonnegative(),
  progressPercent: z.number().min(0).max(100),
  distanceRemainingMeters: z.number().nonnegative(),
  etaSeconds: z.number().nonnegative().optional(),
  batteryProjection: missionTwinBatteryProjectionSchema.optional(),
  safetyStatus: z.enum(["CLEAR", "WARNING", "FAILSAFE_TRIGGERED", "GEOFENCE_PROXIMITY"]),
  perceptionStatus: landingZoneSuitabilitySchema.optional(),
  aiRouteScore: z.number().min(0).max(100).optional(),
  lastTelemetryTimestamp: z.string().datetime().optional(),
  lastSyncTimestamp: z.string().datetime(),
  reconciliation: missionTwinReconciliationSchema
});
export type MissionTwin = z.infer<typeof missionTwinSchema>;

// ============================================================================
// Fleet Twin Domain Model
// ============================================================================

export const fleetTwinBatterySummarySchema = z.object({
  averagePercent: z.number().min(0).max(100),
  lowBatteryCount: z.number().int().nonnegative(),
  criticalBatteryCount: z.number().int().nonnegative()
});
export type FleetTwinBatterySummary = z.infer<typeof fleetTwinBatterySummarySchema>;

export const fleetTwinTelemetrySummarySchema = z.object({
  liveCount: z.number().int().nonnegative(),
  degradedCount: z.number().int().nonnegative(),
  staleCount: z.number().int().nonnegative(),
  offlineCount: z.number().int().nonnegative()
});
export type FleetTwinTelemetrySummary = z.infer<typeof fleetTwinTelemetrySummarySchema>;

export const fleetTwinMaintenanceSummarySchema = z.object({
  healthyCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  urgentCount: z.number().int().nonnegative()
});
export type FleetTwinMaintenanceSummary = z.infer<typeof fleetTwinMaintenanceSummarySchema>;

export const fleetTwinSchema = z.object({
  organizationId: z.string(),
  totalDrones: z.number().int().nonnegative(),
  availableDrones: z.number().int().nonnegative(),
  activeDrones: z.number().int().nonnegative(),
  returningDrones: z.number().int().nonnegative(),
  emergencyDrones: z.number().int().nonnegative(),
  offlineDrones: z.number().int().nonnegative(),
  maintenanceDrones: z.number().int().nonnegative(),
  activeMissionsCount: z.number().int().nonnegative(),
  batteryHealthSummary: fleetTwinBatterySummarySchema,
  telemetryFreshnessSummary: fleetTwinTelemetrySummarySchema,
  maintenanceRiskSummary: fleetTwinMaintenanceSummarySchema,
  reconciliationDiscrepanciesCount: z.number().int().nonnegative(),
  lastSyncTimestamp: z.string().datetime()
});
export type FleetTwin = z.infer<typeof fleetTwinSchema>;

// ============================================================================
// Environment Twin Domain Model
// ============================================================================

export const environmentTwinSchema = z.object({
  organizationId: z.string(),
  activeGeofencesCount: z.number().int().nonnegative(),
  noFlyZonesCount: z.number().int().nonnegative(),
  airspaceRiskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  activeWeatherConditions: z.object({
    windSpeedMps: z.number().nonnegative(),
    precipitationMmPerHour: z.number().nonnegative(),
    visibilityMeters: z.number().nonnegative(),
    isGroundingAlertActive: z.boolean()
  }).optional(),
  lastUpdated: z.string().datetime()
});
export type EnvironmentTwin = z.infer<typeof environmentTwinSchema>;

// ============================================================================
// Digital Twin Snapshot & Health DTOs
// ============================================================================

export const digitalTwinSnapshotSchema = z.object({
  organizationId: z.string(),
  fleet: fleetTwinSchema,
  drones: z.array(droneTwinSchema),
  missions: z.array(missionTwinSchema),
  environment: environmentTwinSchema,
  snapshotTimestamp: z.string().datetime(),
  version: z.string()
});
export type DigitalTwinSnapshot = z.infer<typeof digitalTwinSnapshotSchema>;

export const twinHealthReportSchema = z.object({
  organizationId: z.string(),
  overallStatus: twinHealthStatusSchema,
  totalDronesTracked: z.number().int().nonnegative(),
  totalMissionsTracked: z.number().int().nonnegative(),
  activeDiscrepanciesCount: z.number().int().nonnegative(),
  issues: z.array(twinDiagnosticIssueSchema),
  evaluatedAt: z.string().datetime()
});
export type TwinHealthReport = z.infer<typeof twinHealthReportSchema>;

// ============================================================================
// Realtime WebSocket Twin Events
// ============================================================================

export const wsTwinUpdateMessageSchema = z.object({
  type: z.literal("TWIN_UPDATE"),
  channel: z.string(),
  subType: z.enum(["DRONE", "MISSION", "FLEET", "HEALTH_ALERT", "RECONCILIATION_WARNING"]),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime()
});
export type WsTwinUpdateMessage = z.infer<typeof wsTwinUpdateMessageSchema>;
