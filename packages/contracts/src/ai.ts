import { z } from "zod";

export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitudeMeters: z.number().optional(),
  address: z.string().optional()
});
export type Coordinate = z.infer<typeof coordinateSchema>;

export const riskLevelSchema = z.enum(["NORMAL", "MODERATE", "HIGH", "CRITICAL"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const batteryFeasibilitySchema = z.enum(["SAFE", "CAUTION", "HIGH_RISK", "NOT_FEASIBLE"]);
export type BatteryFeasibility = z.infer<typeof batteryFeasibilitySchema>;

export const maintenancePrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type MaintenancePriority = z.infer<typeof maintenancePrioritySchema>;

// Route Candidate input & scored candidate output
export const routeCandidateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  waypoints: z.array(coordinateSchema).min(2),
  cruiseAltitudeMeters: z.number().positive().default(60),
  targetSpeedMps: z.number().positive().default(15)
});
export type RouteCandidate = z.infer<typeof routeCandidateSchema>;

export const aiWeatherConditionsSchema = z.object({
  windSpeedMps: z.number().nonnegative().default(0),
  windDirectionDegrees: z.number().min(0).max(360).default(0),
  windGustMps: z.number().nonnegative().default(0),
  precipitationMmPerHour: z.number().nonnegative().default(0),
  visibilityMeters: z.number().nonnegative().default(10000),
  temperatureCelsius: z.number().default(20)
});
export type AiWeatherConditions = z.infer<typeof aiWeatherConditionsSchema>;

export const aiRouteScoringRequestSchema = z.object({
  organizationId: z.string(),
  missionId: z.string().optional(),
  orderId: z.string().optional(),
  droneId: z.string().optional(),
  packageWeightGrams: z.number().nonnegative(),
  droneMaxPayloadGrams: z.number().positive().default(5000),
  droneBatteryPercent: z.number().min(0).max(100).default(100),
  droneBatteryCapacityMah: z.number().positive().default(10000),
  weather: aiWeatherConditionsSchema.optional(),
  candidates: z.array(routeCandidateSchema).min(1),
  priority: z.enum(["STANDARD", "RUSH", "EMERGENCY"]).default("STANDARD")
});
export type AiRouteScoringRequest = z.infer<typeof aiRouteScoringRequestSchema>;

export const scoredRouteCandidateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  rank: z.number().int().positive(),
  score: z.number().min(0).max(100), // 0-100 advisory score
  totalDistanceMeters: z.number().nonnegative(),
  estimatedFlightTimeSeconds: z.number().nonnegative(),
  predictedEta: z.string(),
  estimatedBatteryConsumptionPercent: z.number().min(0).max(100),
  batteryFeasibility: batteryFeasibilitySchema,
  weatherRiskLevel: riskLevelSchema,
  compositeRiskScore: z.number().min(0).max(100),
  isRecommended: z.boolean(),
  recommendationReason: z.string(),
  riskFactors: z.array(z.string()),
  scoreBreakdown: z.object({
    distanceScore: z.number(),
    timeScore: z.number(),
    batteryScore: z.number(),
    weatherScore: z.number(),
    priorityBonus: z.number()
  }),
  waypoints: z.array(coordinateSchema)
});
export type ScoredRouteCandidate = z.infer<typeof scoredRouteCandidateSchema>;

export const aiRouteScoringResponseSchema = z.object({
  modelVersion: z.string(),
  generatedAt: z.string(),
  recommendedRouteId: z.string(),
  candidates: z.array(scoredRouteCandidateSchema),
  advisoryDisclaimer: z.string()
});
export type AiRouteScoringResponse = z.infer<typeof aiRouteScoringResponseSchema>;

// ETA Prediction
export const aiEtaPredictionRequestSchema = z.object({
  organizationId: z.string(),
  droneId: z.string().optional(),
  currentPosition: coordinateSchema,
  currentSpeedMps: z.number().nonnegative().default(0),
  destination: coordinateSchema,
  waypoints: z.array(coordinateSchema).optional(),
  packageWeightGrams: z.number().nonnegative().default(0),
  cruiseSpeedMps: z.number().positive().default(15),
  weather: z.object({
    windSpeedMps: z.number().nonnegative().default(0),
    windDirectionDegrees: z.number().min(0).max(360).default(0)
  }).optional()
});
export type AiEtaPredictionRequest = z.infer<typeof aiEtaPredictionRequestSchema>;

export const aiEtaPredictionResponseSchema = z.object({
  modelVersion: z.string(),
  predictedAt: z.string(),
  predictedEta: z.string(),
  remainingDistanceMeters: z.number().nonnegative(),
  estimatedDurationSeconds: z.number().nonnegative(),
  confidenceInterval: z.object({
    p50DurationSeconds: z.number(),
    p90DurationSeconds: z.number(),
    p99DurationSeconds: z.number()
  }),
  contributingFactors: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1)
});
export type AiEtaPredictionResponse = z.infer<typeof aiEtaPredictionResponseSchema>;

// Battery Prediction
export const aiBatteryPredictionRequestSchema = z.object({
  organizationId: z.string(),
  droneId: z.string(),
  currentBatteryPercent: z.number().min(0).max(100),
  routeDistanceMeters: z.number().nonnegative(),
  packageWeightGrams: z.number().nonnegative().default(0),
  droneMaxPayloadGrams: z.number().positive().default(5000),
  headwindMps: z.number().default(0),
  isRoundTrip: z.boolean().default(true)
});
export type AiBatteryPredictionRequest = z.infer<typeof aiBatteryPredictionRequestSchema>;

export const aiBatteryPredictionResponseSchema = z.object({
  modelVersion: z.string(),
  evaluatedAt: z.string(),
  currentBatteryPercent: z.number(),
  predictedConsumptionPercent: z.number(),
  estimatedArrivalBatteryPercent: z.number(),
  estimatedReturnReservePercent: z.number(),
  estimatedFlightTimeRemainingSeconds: z.number(),
  feasibility: batteryFeasibilitySchema,
  isReserveCompliant: z.boolean(),
  reserveThresholdPercent: z.number().default(20),
  warnings: z.array(z.string())
});
export type AiBatteryPredictionResponse = z.infer<typeof aiBatteryPredictionResponseSchema>;

// Predictive Maintenance
export const aiMaintenancePredictionRequestSchema = z.object({
  organizationId: z.string(),
  droneId: z.string(),
  callSign: z.string(),
  model: z.string(),
  flightHours: z.number().nonnegative(),
  batteryCycles: z.number().nonnegative().default(0),
  batteryHealthPercent: z.number().min(0).max(100).default(100),
  emergencyEventsCount: z.number().int().nonnegative().default(0),
  lastMaintenanceAt: z.string().optional(),
  recentMaxMotorTemperatureCelsius: z.number().optional(),
  recentVibrationRms: z.number().optional()
});
export type AiMaintenancePredictionRequest = z.infer<typeof aiMaintenancePredictionRequestSchema>;

export const componentRiskAssessmentSchema = z.object({
  component: z.enum(["BATTERY", "MOTORS", "PROPULSION", "AVIONICS", "AIRFRAME"]),
  riskScore: z.number().min(0).max(100),
  healthPercent: z.number().min(0).max(100),
  status: z.enum(["HEALTHY", "MONITOR", "SERVICE_RECOMMENDED", "CRITICAL"]),
  findings: z.array(z.string())
});
export type ComponentRiskAssessment = z.infer<typeof componentRiskAssessmentSchema>;

export const aiMaintenancePredictionResponseSchema = z.object({
  modelVersion: z.string(),
  assessedAt: z.string(),
  droneId: z.string(),
  overallRiskScore: z.number().min(0).max(100),
  overallRiskLevel: riskLevelSchema,
  maintenancePriority: maintenancePrioritySchema,
  estimatedHoursToNextService: z.number().nonnegative(),
  recommendedAction: z.string(),
  components: z.array(componentRiskAssessmentSchema),
  riskFactors: z.array(z.string()),
  recommendedInspections: z.array(z.string())
});
export type AiMaintenancePredictionResponse = z.infer<typeof aiMaintenancePredictionResponseSchema>;

// Weather Risk
export const aiWeatherRiskRequestSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  windSpeedMps: z.number().nonnegative(),
  windDirectionDegrees: z.number().min(0).max(360),
  windGustMps: z.number().nonnegative().default(0),
  precipitationMmPerHour: z.number().nonnegative().default(0),
  visibilityMeters: z.number().nonnegative().default(10000),
  temperatureCelsius: z.number().default(20),
  thunderstormRisk: z.boolean().default(false)
});
export type AiWeatherRiskRequest = z.infer<typeof aiWeatherRiskRequestSchema>;

export const aiWeatherRiskResponseSchema = z.object({
  modelVersion: z.string(),
  evaluatedAt: z.string(),
  riskLevel: riskLevelSchema,
  riskScore: z.number().min(0).max(100),
  isFlightPermitted: z.boolean(),
  maxSafeAltitudeMeters: z.number().positive(),
  recommendedCruiseSpeedMps: z.number().positive(),
  activeHazards: z.array(z.string()),
  advisoryNotes: z.array(z.string())
});
export type AiWeatherRiskResponse = z.infer<typeof aiWeatherRiskResponseSchema>;

// Demand Forecasting
export const aiDemandForecastRequestSchema = z.object({
  organizationId: z.string(),
  forecastHorizonHours: z.number().int().min(1).max(72).default(24),
  baseHourlyOrders: z.number().nonnegative().default(12),
  activeFleetSize: z.number().int().positive().default(5),
  targetDate: z.string().optional()
});
export type AiDemandForecastRequest = z.infer<typeof aiDemandForecastRequestSchema>;

export const hourlyDemandSlotSchema = z.object({
  hour: z.number().int().min(0).max(23),
  predictedOrders: z.number().nonnegative(),
  surgeFactor: z.number().positive(),
  recommendedActiveDrones: z.number().int().nonnegative(),
  expectedUtilizationPercent: z.number().min(0).max(100)
});
export type HourlyDemandSlot = z.infer<typeof hourlyDemandSlotSchema>;

export const aiDemandForecastResponseSchema = z.object({
  modelVersion: z.string(),
  generatedAt: z.string(),
  organizationId: z.string(),
  forecastHorizonHours: z.number(),
  totalPredictedOrders: z.number().nonnegative(),
  peakHour: z.number().int().min(0).max(23),
  peakPredictedOrders: z.number().nonnegative(),
  recommendedFleetSize: z.number().int().positive(),
  hourlyForecast: z.array(hourlyDemandSlotSchema)
});
export type AiDemandForecastResponse = z.infer<typeof aiDemandForecastResponseSchema>;

// Deterministic Safety Gate and Evaluated Mission Plan
export const deterministicSafetyGateResultSchema = z.object({
  passed: z.boolean(),
  geofenceCheck: z.object({ passed: z.boolean(), reason: z.string() }),
  batteryReserveCheck: z.object({
    passed: z.boolean(),
    expectedReservePercent: z.number(),
    minRequiredReservePercent: z.number(),
    reason: z.string()
  }),
  payloadCheck: z.object({
    passed: z.boolean(),
    packageWeightGrams: z.number(),
    maxPayloadGrams: z.number(),
    reason: z.string()
  }),
  weatherCheck: z.object({
    passed: z.boolean(),
    windSpeedMps: z.number(),
    maxAllowedWindMps: z.number(),
    reason: z.string()
  }),
  altitudeEnvelopeCheck: z.object({
    passed: z.boolean(),
    cruiseAltitudeMeters: z.number(),
    maxAltitudeMeters: z.number(),
    reason: z.string()
  }),
  rejectionReasons: z.array(z.string())
});
export type DeterministicSafetyGateResult = z.infer<typeof deterministicSafetyGateResultSchema>;

export const missionPlanEvaluationRequestSchema = z.object({
  orderId: z.string(),
  droneId: z.string().optional(),
  packageWeightGrams: z.number().nonnegative(),
  origin: coordinateSchema,
  destination: coordinateSchema,
  candidateRoutes: z.array(routeCandidateSchema).optional()
});
export type MissionPlanEvaluationRequest = z.infer<typeof missionPlanEvaluationRequestSchema>;

export const missionPlanEvaluationResponseSchema = z.object({
  orderId: z.string(),
  evaluatedAt: z.string(),
  aiRecommendation: scoredRouteCandidateSchema.optional(),
  deterministicSafetyGate: deterministicSafetyGateResultSchema,
  isMissionAuthorized: z.boolean(),
  authorizedRoute: routeCandidateSchema.optional(),
  operatorDecisionRationale: z.string()
});
export type MissionPlanEvaluationResponse = z.infer<typeof missionPlanEvaluationResponseSchema>;
