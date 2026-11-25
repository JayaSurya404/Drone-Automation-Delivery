import { estimateEta, type EtaEstimateInput } from "./eta.util";

const NOW = new Date("2026-09-04T12:00:00.000Z");

const BASE: EtaEstimateInput = {
  distanceMeters: 1000,
  droneMaxSpeedMps: 15,
  windSpeedMps: 0,
  weatherCondition: "CLEAR",
  weatherSafetyLevel: "SAFE",
  now: NOW,
};

describe("estimateEta", () => {
  it("is deterministic for identical inputs", () => {
    expect(estimateEta(BASE)).toEqual(estimateEta(BASE));
  });

  it("computes duration from cruise speed (80% of max) plus fixed handling overhead, with no wind", () => {
    const result = estimateEta(BASE);
    // effective speed = 15 * 0.8 = 12 m/s; travel = 1000/12 ≈ 83.33s; +90s overhead ≈ 173s.
    expect(result.durationSeconds).toBe(Math.round(1000 / 12 + 90));
    expect(result.etaAt.getTime()).toBe(NOW.getTime() + result.durationSeconds * 1000);
    expect(result.predictedAt).toBe(NOW);
  });

  it("increases duration as wind speed increases", () => {
    const calm = estimateEta(BASE);
    const windy = estimateEta({ ...BASE, windSpeedMps: 5 });
    expect(windy.durationSeconds).toBeGreaterThan(calm.durationSeconds);
  });

  it("caps the wind penalty at half of cruise speed rather than letting it dominate", () => {
    // baseSpeed = 15*0.8=12 m/s; penalty capped at 12*0.5=6 m/s -> effective speed floors at 6, not lower, however strong the wind.
    const moderate = estimateEta({ ...BASE, windSpeedMps: 20 });
    const extreme = estimateEta({ ...BASE, windSpeedMps: 1000 });
    expect(moderate.durationSeconds).toBe(extreme.durationSeconds);
    expect(extreme.durationSeconds).toBe(Math.round(1000 / 6 + 90));
  });

  it("never lets effective speed drop below the absolute minimum floor for a slow drone in extreme wind", () => {
    // droneMaxSpeedMps=5 -> baseSpeed=4, wind penalty cap=2 -> effective=4-2=2, below the 3 m/s floor -> clamps to 3.
    const extreme = estimateEta({ ...BASE, droneMaxSpeedMps: 5, windSpeedMps: 1000 });
    expect(extreme.durationSeconds).toBe(Math.round(1000 / 3 + 90));
  });

  it("is HIGH confidence only for safe weather and a short distance", () => {
    expect(estimateEta({ ...BASE, distanceMeters: 2000, weatherSafetyLevel: "SAFE" }).confidence).toBe("HIGH");
    expect(estimateEta({ ...BASE, distanceMeters: 4000, weatherSafetyLevel: "SAFE" }).confidence).toBe("MEDIUM");
  });

  it("is MEDIUM confidence for caution-level weather under 8km, never HIGH", () => {
    const result = estimateEta({ ...BASE, distanceMeters: 2000, weatherSafetyLevel: "CAUTION" });
    expect(result.confidence).toBe("MEDIUM");
  });

  it("is LOW confidence for unsafe weather regardless of distance", () => {
    const result = estimateEta({ ...BASE, distanceMeters: 500, weatherSafetyLevel: "UNSAFE" });
    expect(result.confidence).toBe("LOW");
  });

  it("is LOW confidence once distance reaches 8km even in safe weather", () => {
    const result = estimateEta({ ...BASE, distanceMeters: 8000, weatherSafetyLevel: "SAFE" });
    expect(result.confidence).toBe("LOW");
  });

  it("explains itself with distance, speed, wind, weather condition, and handling overhead factors", () => {
    const result = estimateEta({ ...BASE, windSpeedMps: 4 });
    expect(result.factors.some((f) => f.includes("Distance"))).toBe(true);
    expect(result.factors.some((f) => f.includes("Cruise speed"))).toBe(true);
    expect(result.factors.some((f) => f.includes("Wind"))).toBe(true);
    expect(result.factors.some((f) => f.includes("Weather condition: CLEAR"))).toBe(true);
    expect(result.factors.some((f) => f.includes("Handling overhead"))).toBe(true);
  });

  it("notes calm winds explicitly rather than a zero-value wind factor", () => {
    const result = estimateEta(BASE);
    expect(result.factors.some((f) => f.includes("Calm winds"))).toBe(true);
  });
});
