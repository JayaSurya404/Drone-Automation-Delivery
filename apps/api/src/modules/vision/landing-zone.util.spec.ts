import { scoreLandingZone, type LandingZoneScoreInput } from "./landing-zone.util";

const BASE_INPUT: LandingZoneScoreInput = {
  radiusMeters: 5,
  requiredRadiusMeters: 5,
  clearanceScore: 90,
  obstructed: false,
  humanDetected: false,
  geofenceViolationCount: 0,
  distanceFromTargetMeters: null,
  suitableThreshold: 70,
  marginalThreshold: 40,
};

describe("scoreLandingZone", () => {
  it("scores a clear, adequately sized, geofence-free zone as SUITABLE", () => {
    const result = scoreLandingZone(BASE_INPUT);
    expect(result.verdict).toBe("SUITABLE");
    expect(result.safetyScore).toBe(100);
    expect(result.sizeScore).toBe(100);
  });

  it("forces UNSUITABLE on any geofence violation regardless of other scores", () => {
    const result = scoreLandingZone({ ...BASE_INPUT, geofenceViolationCount: 1 });
    expect(result.safetyScore).toBe(0);
    expect(result.verdict).toBe("UNSUITABLE");
  });

  it("forces UNSUITABLE when a human is detected, even with a perfect safety score", () => {
    const result = scoreLandingZone({ ...BASE_INPUT, humanDetected: true });
    expect(result.obstructionScore).toBe(0);
    expect(result.verdict).toBe("UNSUITABLE");
  });

  it("caps the obstruction score when obstructed, without zeroing it out", () => {
    const result = scoreLandingZone({ ...BASE_INPUT, obstructed: true, clearanceScore: 90 });
    expect(result.obstructionScore).toBeLessThanOrEqual(30);
  });

  it("scores an undersized candidate radius below 100", () => {
    const result = scoreLandingZone({ ...BASE_INPUT, radiusMeters: 2, requiredRadiusMeters: 5 });
    expect(result.sizeScore).toBe(40);
  });

  it("treats a missing target as full proximity score", () => {
    const result = scoreLandingZone({ ...BASE_INPUT, distanceFromTargetMeters: null });
    expect(result.proximityScore).toBe(100);
  });

  it("reduces proximity score with distance from the target, floored at 0", () => {
    const near = scoreLandingZone({ ...BASE_INPUT, distanceFromTargetMeters: 10 });
    const far = scoreLandingZone({ ...BASE_INPUT, distanceFromTargetMeters: 500 });
    expect(near.proximityScore).toBe(90);
    expect(far.proximityScore).toBe(0);
  });

  it("falls to MARGINAL between the two thresholds and UNSUITABLE below both", () => {
    // radius 0 -> sizeScore 0; clearance 50 obstructed -> obstructionScore capped 30; no geofence -> safety 100; no target -> proximity 100
    // suitability = 0*0.25 + 30*0.3 + 100*0.35 + 100*0.1 = 9 + 35 + 10 = 54 -> MARGINAL (>=40, <70)
    const marginal = scoreLandingZone({ ...BASE_INPUT, radiusMeters: 0, obstructed: true, clearanceScore: 50 });
    expect(marginal.verdict).toBe("MARGINAL");

    // Drive suitability below 40 as well.
    const unsuitable = scoreLandingZone({ ...BASE_INPUT, radiusMeters: 0, obstructed: true, clearanceScore: 0, distanceFromTargetMeters: 100 });
    expect(unsuitable.verdict).toBe("UNSUITABLE");
  });

  it("always includes a reason for size, obstruction, and safety (proximity only when a target was given)", () => {
    const result = scoreLandingZone(BASE_INPUT);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
    const withTarget = scoreLandingZone({ ...BASE_INPUT, distanceFromTargetMeters: 10 });
    expect(withTarget.reasons.length).toBe(result.reasons.length + 1);
  });
});
