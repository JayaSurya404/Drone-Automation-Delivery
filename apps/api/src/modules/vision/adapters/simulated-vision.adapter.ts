import { Injectable } from "@nestjs/common";
import type { ComputerVisionAdapter, VisionAnalysisResult, VisionFrameInput } from "../interfaces/computer-vision-adapter.interface";
import { frameSeed, hasHumanDetection, isObstructed, synthesizeDetections, synthesizeLandingZoneCandidates } from "../vision.util";

/**
 * V1 `ComputerVisionAdapter` — deterministic, simulation-only (Part 1's
 * explicit instruction: "do not claim a real production computer-vision
 * model exists unless an actual model is installed, loaded, and tested").
 * No frame/image ever exists; detections are synthesized purely from the
 * request's own inputs via `vision.util.ts`'s seeded hash functions, the
 * same "deterministic pull-based simulation" precedent `SimulatedDroneAdapter`
 * and `LocalWeatherProvider` already established.
 */
@Injectable()
export class SimulatedVisionAdapter implements ComputerVisionAdapter {
  async analyzeFrame(input: VisionFrameInput): Promise<VisionAnalysisResult> {
    const seed = frameSeed(input.droneId, input.lat, input.lng, input.altitudeMeters);
    const objects = synthesizeDetections(seed);
    const landingZoneCandidates = synthesizeLandingZoneCandidates(seed, input.lat, input.lng);
    return Promise.resolve({
      objects,
      landingZoneCandidates,
      obstructed: isObstructed(objects),
      humanDetected: hasHumanDetection(objects),
      modelProvider: "SIMULATED",
      capturedAt: new Date(),
    });
  }
}
