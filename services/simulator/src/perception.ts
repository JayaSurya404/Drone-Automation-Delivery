import type {
  VisionFrameAnalysisResponse,
  CameraSource,
  LandingZoneSuitability,
  DestinationVerificationStatus
} from "@skynav/contracts";
import type { GeoCoordinate } from "./types.js";

export interface SimulatedPerceptionConfig {
  droneId: string;
  organizationId: string;
  cameraSource?: CameraSource;
  syntheticSceneType?: "URBAN" | "SUBURBAN" | "INDUSTRIAL" | "RURAL" | "OPEN_FIELD";
  hasObstructedLandingZone?: boolean;
  hasOverheadWires?: boolean;
  hasActivePedestrian?: boolean;
}

export class SimulatedPerceptionSensor {
  private readonly config: SimulatedPerceptionConfig;

  constructor(config: SimulatedPerceptionConfig) {
    this.config = {
      cameraSource: "DOWNWARD_NAV_CAM",
      syntheticSceneType: "SUBURBAN",
      hasObstructedLandingZone: false,
      hasOverheadWires: false,
      hasActivePedestrian: false,
      ...config
    };
  }

  /**
   * Generates a deterministic simulated vision frame based on current kinematic altitude and position.
   */
  public captureFrame(
    position: GeoCoordinate,
    frameIndex: number = 1
  ): VisionFrameAnalysisResponse {
    const isDescent = position.altitudeMeters <= 5.0;
    const isObstructed =
      this.config.hasObstructedLandingZone ||
      this.config.hasActivePedestrian ||
      this.config.hasOverheadWires;

    const suitability: LandingZoneSuitability = isObstructed
      ? "UNSAFE"
      : isDescent
      ? "SAFE"
      : "CAUTION";

    const verificationStatus: DestinationVerificationStatus = isObstructed
      ? "OBSTRUCTED"
      : "VERIFIED";

    const detections = [];
    if (this.config.hasActivePedestrian) {
      detections.push({
        id: `sim-det-ped-${frameIndex}`,
        label: "Simulated Pedestrian",
        category: "PERSON" as const,
        confidence: 0.93,
        boundingBox: { xMin: 0.45, yMin: 0.45, xMax: 0.55, yMax: 0.70 },
        severity: "CRITICAL" as const,
        approximateDistanceMeters: position.altitudeMeters,
        details: "Pedestrian in target drop radius."
      });
    }

    if (this.config.hasOverheadWires) {
      detections.push({
        id: `sim-det-wire-${frameIndex}`,
        label: "Simulated Power Lines",
        category: "OBSTACLE" as const,
        confidence: 0.89,
        boundingBox: { xMin: 0.10, yMin: 0.20, xMax: 0.90, yMax: 0.25 },
        severity: "CRITICAL" as const,
        approximateDistanceMeters: Math.max(2.0, position.altitudeMeters * 0.8),
        details: "Aerial wires crossing path."
      });
    }

    if (!isObstructed) {
      detections.push({
        id: `sim-det-pad-${frameIndex}`,
        label: "SkyNav Landing Target Pad",
        category: "LANDING_PAD" as const,
        confidence: 0.97,
        boundingBox: { xMin: 0.40, yMin: 0.40, xMax: 0.60, yMax: 0.60 },
        severity: "LOW" as const,
        approximateDistanceMeters: position.altitudeMeters,
        details: "Standard SkyNav fiducial marker."
      });
    }

    return {
      frameId: `sim-frame-${this.config.droneId}-${frameIndex}`,
      droneId: this.config.droneId,
      timestamp: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      modelVersion: "vision-sim-sensor-v1.0.0",
      inferenceLatencyMs: 4.2,
      cameraSource: this.config.cameraSource || "DOWNWARD_NAV_CAM",
      sceneClassification: {
        sceneType: this.config.syntheticSceneType || "SUBURBAN",
        confidence: 0.95,
        secondaryScenes: [],
        description: `Simulated ${this.config.syntheticSceneType?.toLowerCase() || "suburban"} environment.`
      },
      detections,
      landingZoneAssessment: {
        suitability,
        confidence: 0.94,
        usableAreaSquareMeters: isObstructed ? 0.0 : 18.5,
        surfaceType: "CONCRETE",
        obstructionsDetected: isObstructed ? ["Simulated hazard detected in drop zone"] : [],
        peopleDetectedCount: this.config.hasActivePedestrian ? 1 : 0,
        vehiclesDetectedCount: 0,
        slopeDegrees: 0.5,
        reasons: isObstructed
          ? ["Simulated obstruction detected in drop envelope."]
          : ["Clear landing zone identified."],
        recommendations: isObstructed
          ? ["Abort descent", "Hold at safe standoff altitude"]
          : ["Proceed with controlled descent"]
      },
      destinationVerification: {
        status: verificationStatus,
        isTargetVisible: true,
        targetPadDetected: !isObstructed,
        confidence: 0.96,
        offsetMeters: { dxMeters: 0.05, dyMeters: -0.08 },
        reasons: [
          isObstructed
            ? "Target visible but obstructed by obstacle."
            : "Target landing pad verified and centered."
        ]
      },
      advisorySafetyStatus: isObstructed ? "ADVISORY_ABORT_RECOMMENDED" : "CLEAR",
      advisoryDisclaimer: "Simulated perception data is advisory. Deterministic safety rules remain authoritative."
    };
  }
}
