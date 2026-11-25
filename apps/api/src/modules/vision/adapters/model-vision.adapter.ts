import { Injectable, NotImplementedException } from "@nestjs/common";
import type { ComputerVisionAdapter, VisionAnalysisResult, VisionFrameInput } from "../interfaces/computer-vision-adapter.interface";

/**
 * `ModelVisionAdapter` — the future pluggable OpenCV/YOLO/other real-model
 * implementation Part 1 describes. Per the same `MavlinkDroneAdapter`/
 * `OpenMeteoProvider` convention, the `VISION_ADAPTER=model` config switch
 * exists now even though the implementation doesn't — it throws instead of
 * silently falling back to the simulator, so selecting it fails loudly
 * rather than pretending a real model is analyzing frames that were never
 * run through one.
 */
@Injectable()
export class ModelVisionAdapter implements ComputerVisionAdapter {
  async analyzeFrame(_input: VisionFrameInput): Promise<VisionAnalysisResult> {
    throw new NotImplementedException(
      "ModelVisionAdapter is not implemented yet — VISION_ADAPTER=model is a reserved config value for a future real OpenCV/YOLO-backed model. Use VISION_ADAPTER=simulated.",
    );
  }
}
