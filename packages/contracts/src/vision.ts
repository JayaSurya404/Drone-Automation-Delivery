import { z } from "zod";

export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitudeMeters: z.number().optional(),
  address: z.string().optional()
});
export type Coordinate = z.infer<typeof coordinateSchema>;

// ============================================================================
// Core Vision Enums
// ============================================================================

export const detectionCategorySchema = z.enum([
  "LANDING_ZONE",
  "LANDING_PAD",
  "OBSTACLE",
  "PERSON",
  "VEHICLE",
  "STRUCTURE",
  "WATER",
  "VEGETATION",
  "UNKNOWN_HAZARD"
]);
export type DetectionCategory = z.infer<typeof detectionCategorySchema>;

export const hazardSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type HazardSeverity = z.infer<typeof hazardSeveritySchema>;

export const sceneTypeSchema = z.enum([
  "URBAN",
  "SUBURBAN",
  "INDUSTRIAL",
  "RURAL",
  "OPEN_FIELD",
  "UNKNOWN"
]);
export type SceneType = z.infer<typeof sceneTypeSchema>;

export const landingZoneSuitabilitySchema = z.enum([
  "SAFE",
  "CAUTION",
  "UNSAFE",
  "UNKNOWN"
]);
export type LandingZoneSuitability = z.infer<typeof landingZoneSuitabilitySchema>;

export const destinationVerificationStatusSchema = z.enum([
  "VERIFIED",
  "UNVERIFIED",
  "OBSTRUCTED",
  "NOT_FOUND"
]);
export type DestinationVerificationStatus = z.infer<typeof destinationVerificationStatusSchema>;

export const cameraSourceSchema = z.enum([
  "DOWNWARD_NAV_CAM",
  "FORWARD_OBSTACLE_CAM",
  "PERCEPTION_PAYLOAD_CAM",
  "SYNTHETIC_SIMULATOR_FEED"
]);
export type CameraSource = z.infer<typeof cameraSourceSchema>;

export const advisorySafetyStatusSchema = z.enum([
  "CLEAR",
  "ADVISORY_CAUTION",
  "ADVISORY_ABORT_RECOMMENDED"
]);
export type AdvisorySafetyStatus = z.infer<typeof advisorySafetyStatusSchema>;

// ============================================================================
// Bounding Box and Vision Detection
// ============================================================================

export const visionBoundingBoxSchema = z.object({
  xMin: z.number().min(0).max(1),
  yMin: z.number().min(0).max(1),
  xMax: z.number().min(0).max(1),
  yMax: z.number().min(0).max(1)
});
export type VisionBoundingBox = z.infer<typeof visionBoundingBoxSchema>;

export const visionDetectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: detectionCategorySchema,
  confidence: z.number().min(0).max(1),
  boundingBox: visionBoundingBoxSchema.optional(),
  severity: hazardSeveritySchema.default("LOW"),
  approximateDistanceMeters: z.number().nonnegative().optional(),
  details: z.string().optional()
});
export type VisionDetection = z.infer<typeof visionDetectionSchema>;

// ============================================================================
// Scene Classification & Landing Assessment Sub-Models
// ============================================================================

export const sceneClassificationResultSchema = z.object({
  sceneType: sceneTypeSchema,
  confidence: z.number().min(0).max(1),
  secondaryScenes: z.array(sceneTypeSchema).default([]),
  description: z.string()
});
export type SceneClassificationResult = z.infer<typeof sceneClassificationResultSchema>;

export const landingZoneAssessmentResultSchema = z.object({
  suitability: landingZoneSuitabilitySchema,
  confidence: z.number().min(0).max(1),
  usableAreaSquareMeters: z.number().nonnegative(),
  surfaceType: z.enum(["PAVEMENT", "CONCRETE", "GRASS", "ROOF_DECK", "WATER", "UNEVEN_TERRAIN", "UNKNOWN"]),
  obstructionsDetected: z.array(z.string()).default([]),
  peopleDetectedCount: z.number().int().nonnegative().default(0),
  vehiclesDetectedCount: z.number().int().nonnegative().default(0),
  slopeDegrees: z.number().nonnegative().default(0),
  reasons: z.array(z.string()),
  recommendations: z.array(z.string())
});
export type LandingZoneAssessmentResult = z.infer<typeof landingZoneAssessmentResultSchema>;

export const destinationVerificationResultSchema = z.object({
  status: destinationVerificationStatusSchema,
  isTargetVisible: z.boolean(),
  targetPadDetected: z.boolean(),
  confidence: z.number().min(0).max(1),
  offsetMeters: z.object({
    dxMeters: z.number(),
    dyMeters: z.number()
  }).optional(),
  reasons: z.array(z.string())
});
export type DestinationVerificationResult = z.infer<typeof destinationVerificationResultSchema>;

// ============================================================================
// API Requests & Responses
// ============================================================================

export const visionTelemetryContextSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitudeMeters: z.number().default(0),
  headingDegrees: z.number().min(0).max(360).default(0),
  pitchDegrees: z.number().default(0),
  rollDegrees: z.number().default(0)
});
export type VisionTelemetryContext = z.infer<typeof visionTelemetryContextSchema>;

export const visionFrameAnalysisRequestSchema = z.object({
  organizationId: z.string(),
  droneId: z.string(),
  missionId: z.string().optional(),
  orderId: z.string().optional(),
  frameId: z.string(),
  cameraSource: cameraSourceSchema.default("DOWNWARD_NAV_CAM"),
  imageWidth: z.number().int().positive().default(1920),
  imageHeight: z.number().int().positive().default(1080),
  imageBase64: z.string().optional(),
  syntheticSceneDescription: z.string().optional(),
  telemetry: visionTelemetryContextSchema,
  targetDeliveryLocation: coordinateSchema.optional()
});
export type VisionFrameAnalysisRequest = z.infer<typeof visionFrameAnalysisRequestSchema>;

export const visionFrameAnalysisResponseSchema = z.object({
  frameId: z.string(),
  droneId: z.string(),
  timestamp: z.string(),
  processedAt: z.string(),
  modelVersion: z.string(),
  inferenceLatencyMs: z.number().nonnegative(),
  cameraSource: cameraSourceSchema,
  sceneClassification: sceneClassificationResultSchema,
  detections: z.array(visionDetectionSchema),
  landingZoneAssessment: landingZoneAssessmentResultSchema,
  destinationVerification: destinationVerificationResultSchema,
  advisorySafetyStatus: advisorySafetyStatusSchema,
  advisoryDisclaimer: z.string()
});
export type VisionFrameAnalysisResponse = z.infer<typeof visionFrameAnalysisResponseSchema>;

// Standalone Landing Assessment Request/Response
export const assessLandingZoneRequestSchema = z.object({
  organizationId: z.string(),
  droneId: z.string(),
  missionId: z.string().optional(),
  cameraSource: cameraSourceSchema.default("DOWNWARD_NAV_CAM"),
  telemetry: visionTelemetryContextSchema,
  expectedRadiusMeters: z.number().positive().default(3.0)
});
export type AssessLandingZoneRequest = z.infer<typeof assessLandingZoneRequestSchema>;

export const assessLandingZoneResponseSchema = z.object({
  modelVersion: z.string(),
  evaluatedAt: z.string(),
  droneId: z.string(),
  assessment: landingZoneAssessmentResultSchema,
  advisorySafetyStatus: advisorySafetyStatusSchema,
  advisoryDisclaimer: z.string()
});
export type AssessLandingZoneResponse = z.infer<typeof assessLandingZoneResponseSchema>;

// Standalone Destination Verification Request/Response
export const verifyDestinationRequestSchema = z.object({
  organizationId: z.string(),
  droneId: z.string(),
  destination: coordinateSchema,
  telemetry: visionTelemetryContextSchema,
  cameraSource: cameraSourceSchema.default("DOWNWARD_NAV_CAM")
});
export type VerifyDestinationRequest = z.infer<typeof verifyDestinationRequestSchema>;

export const verifyDestinationResponseSchema = z.object({
  modelVersion: z.string(),
  evaluatedAt: z.string(),
  droneId: z.string(),
  verification: destinationVerificationResultSchema,
  advisoryDisclaimer: z.string()
});
export type VerifyDestinationResponse = z.infer<typeof verifyDestinationResponseSchema>;

// Standalone Hazard Detection Request/Response
export const detectHazardsRequestSchema = z.object({
  organizationId: z.string(),
  droneId: z.string(),
  cameraSource: cameraSourceSchema.default("FORWARD_OBSTACLE_CAM"),
  telemetry: visionTelemetryContextSchema,
  minimumConfidence: z.number().min(0).max(1).default(0.5)
});
export type DetectHazardsRequest = z.infer<typeof detectHazardsRequestSchema>;

export const detectHazardsResponseSchema = z.object({
  modelVersion: z.string(),
  evaluatedAt: z.string(),
  droneId: z.string(),
  hazardsCount: z.number().int().nonnegative(),
  detections: z.array(visionDetectionSchema),
  advisorySafetyStatus: advisorySafetyStatusSchema,
  advisoryDisclaimer: z.string()
});
export type DetectHazardsResponse = z.infer<typeof detectHazardsResponseSchema>;

// Realtime Perception Event Envelope
export const perceptionEventSchema = z.object({
  type: z.literal("PERCEPTION_UPDATE"),
  organizationId: z.string(),
  droneId: z.string(),
  missionId: z.string().optional(),
  timestamp: z.string(),
  cameraSource: cameraSourceSchema,
  landingSuitability: landingZoneSuitabilitySchema,
  hazardsDetectedCount: z.number().int().nonnegative(),
  isTargetVerified: z.boolean(),
  advisorySafetyStatus: advisorySafetyStatusSchema,
  summary: z.string()
});
export type PerceptionEvent = z.infer<typeof perceptionEventSchema>;
