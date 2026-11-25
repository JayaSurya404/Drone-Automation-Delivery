export type VisionDetectionClass = "PERSON" | "VEHICLE" | "ANIMAL" | "OBSTACLE" | "STRUCTURE" | "VEGETATION" | "OPEN_GROUND";

/** Normalized (0-1) image-plane coordinates — there is no real image behind this, only a synthetic frame, so this is a structural placeholder for where a real model's box would go. */
export interface BoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface DetectedObject {
  class: VisionDetectionClass;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface LandingZoneCandidate {
  lat: number;
  lng: number;
  radiusMeters: number;
  /** 0-100, higher = clearer of obstructions per the (simulated) frame. */
  clearanceScore: number;
}

export interface VisionFrameInput {
  droneId: string;
  lat: number;
  lng: number;
  altitudeMeters: number;
}

export interface VisionAnalysisResult {
  objects: DetectedObject[];
  landingZoneCandidates: LandingZoneCandidate[];
  obstructed: boolean;
  humanDetected: boolean;
  /** Always "SIMULATED" for `SimulatedVisionAdapter` — never claim a real model produced this unless one is actually installed, loaded, and tested (Part 1's explicit instruction). */
  modelProvider: string;
  capturedAt: Date;
}

/**
 * The `ComputerVisionAdapter` seam (Part 1) — landing-zone scoring and
 * visual-navigation hints depend on this interface, never on
 * `SimulatedVisionAdapter` directly, the same `DroneAdapter`/`RouteOptimizer`
 * convention this app already uses everywhere else. `SimulatedVisionAdapter`
 * is the only real implementation this phase ships: deterministic, seeded
 * only from the frame's own inputs (drone id + position + altitude), never
 * `Math.random()` or wall-clock time, so the same input always analyzes to
 * the same output and every result is reproducible in a test. A future
 * OpenCV/YOLO-backed implementation would implement this same interface
 * without any caller changing — see `ModelVisionAdapter` for the reserved,
 * deliberately unimplemented config seam.
 */
export interface ComputerVisionAdapter {
  analyzeFrame(input: VisionFrameInput): Promise<VisionAnalysisResult>;
}

/** DI token — `vision.module.ts` binds this to `SimulatedVisionAdapter` or `ModelVisionAdapter` based on `VISION_ADAPTER`. */
export const COMPUTER_VISION_ADAPTER = Symbol("COMPUTER_VISION_ADAPTER");
