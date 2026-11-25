import { HeuristicEtaPredictor } from "./heuristic-eta-predictor";
import type { EtaPredictorInput } from "./interfaces/eta-predictor.interface";

describe("HeuristicEtaPredictor", () => {
  const predictor = new HeuristicEtaPredictor();
  const input: EtaPredictorInput = {
    distanceMeters: 1000,
    droneMaxSpeedMps: 15,
    windSpeedMps: 2,
    weatherCondition: "CLEAR",
    weatherSafetyLevel: "SAFE",
  };

  it("delegates to the deterministic eta.util model and returns a future ETA", () => {
    const before = Date.now();
    const result = predictor.predict(input);
    const after = Date.now();

    expect(result.durationSeconds).toBeGreaterThan(0);
    expect(result.etaAt.getTime()).toBeGreaterThan(result.predictedAt.getTime());
    // predictedAt is stamped with "now" at call time, bounded by the test's own clock window.
    expect(result.predictedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.predictedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("produces the same duration/confidence for the same distance/weather inputs (only the wall-clock timestamp varies)", () => {
    const first = predictor.predict(input);
    const second = predictor.predict(input);
    expect(first.durationSeconds).toBe(second.durationSeconds);
    expect(first.confidence).toBe(second.confidence);
    expect(first.factors).toEqual(second.factors);
  });
});
