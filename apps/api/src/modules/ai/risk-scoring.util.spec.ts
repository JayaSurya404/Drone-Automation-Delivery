import { scoreDeliveryRisk, type RiskScoreInput } from "./risk-scoring.util";

const BASE: RiskScoreInput = {
  weatherSafetyLevel: "SAFE",
  batteryFeasibilityLevel: "SUFFICIENT",
  distanceMeters: 500,
  droneMaxRangeKm: 10,
  droneBatteryHealthPercent: 100,
  priority: "STANDARD",
  mediumThreshold: 40,
  highThreshold: 70,
};

describe("scoreDeliveryRisk", () => {
  it("scores 0 for an ideal, low-risk delivery and is LOW", () => {
    const result = scoreDeliveryRisk(BASE);
    expect(result.score).toBe(0);
    expect(result.level).toBe("LOW");
  });

  it("is deterministic for identical inputs", () => {
    expect(scoreDeliveryRisk(BASE)).toEqual(scoreDeliveryRisk(BASE));
  });

  it("adds 40 points for UNSAFE weather and 20 for CAUTION", () => {
    expect(scoreDeliveryRisk({ ...BASE, weatherSafetyLevel: "UNSAFE" }).score).toBe(40);
    expect(scoreDeliveryRisk({ ...BASE, weatherSafetyLevel: "CAUTION" }).score).toBe(20);
  });

  it("adds 30 points for INSUFFICIENT battery feasibility and 15 for MARGINAL", () => {
    expect(scoreDeliveryRisk({ ...BASE, batteryFeasibilityLevel: "INSUFFICIENT" }).score).toBe(30);
    expect(scoreDeliveryRisk({ ...BASE, batteryFeasibilityLevel: "MARGINAL" }).score).toBe(15);
  });

  it("adds up to 15 points as route distance approaches the drone's rated range", () => {
    // 9km of a 10km range = 90% -> ratio 0.9, well past the 0.3-0.8 scaling band -> full 15 points.
    const result = scoreDeliveryRisk({ ...BASE, distanceMeters: 9000, droneMaxRangeKm: 10 });
    expect(result.score).toBe(15);
  });

  it("adds no distance points when well within range (below the 0.3 ratio floor)", () => {
    const result = scoreDeliveryRisk({ ...BASE, distanceMeters: 1000, droneMaxRangeKm: 10 });
    expect(result.score).toBe(0);
  });

  it("adds up to 15 points as drone battery health degrades", () => {
    const result = scoreDeliveryRisk({ ...BASE, droneBatteryHealthPercent: 0 });
    expect(result.score).toBe(15);
  });

  it("adds 5 points for EXPRESS priority, 0 for STANDARD", () => {
    expect(scoreDeliveryRisk({ ...BASE, priority: "EXPRESS" }).score).toBe(5);
    expect(scoreDeliveryRisk({ ...BASE, priority: "STANDARD" }).score).toBe(0);
  });

  it("caps the composite score at 100 even when every component is maxed", () => {
    const result = scoreDeliveryRisk({
      ...BASE,
      weatherSafetyLevel: "UNSAFE",
      batteryFeasibilityLevel: "INSUFFICIENT",
      distanceMeters: 9000,
      droneMaxRangeKm: 10,
      droneBatteryHealthPercent: 0,
      priority: "EXPRESS",
    });
    expect(result.score).toBe(100);
    expect(result.level).toBe("HIGH");
  });

  it("classifies LOW/MEDIUM/HIGH against the configured thresholds", () => {
    expect(scoreDeliveryRisk({ ...BASE, weatherSafetyLevel: "CAUTION", batteryFeasibilityLevel: "MARGINAL" }).score).toBe(35);
    expect(scoreDeliveryRisk({ ...BASE, weatherSafetyLevel: "CAUTION", batteryFeasibilityLevel: "MARGINAL" }).level).toBe("LOW");

    const mediumScored = scoreDeliveryRisk({ ...BASE, weatherSafetyLevel: "UNSAFE" }); // score 40 == mediumThreshold
    expect(mediumScored.level).toBe("MEDIUM");

    const highScored = scoreDeliveryRisk({ ...BASE, weatherSafetyLevel: "UNSAFE", batteryFeasibilityLevel: "INSUFFICIENT" }); // score 70 == highThreshold
    expect(highScored.level).toBe("HIGH");
  });

  it("explains every scored component in reasons, including zero-scoring ones", () => {
    const result = scoreDeliveryRisk(BASE);
    expect(result.reasons.some((r) => r.includes("Weather conditions are safe"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("Battery reserve is sufficient"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("within the drone's rated range"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("Drone battery health is excellent"))).toBe(true);
  });
});
