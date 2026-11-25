import { evaluateBatteryFeasibility, type BatteryFeasibilityInput } from "./battery-feasibility.util";

const BASE: BatteryFeasibilityInput = {
  batteryPercent: 100,
  distanceMeters: 1000,
  drainPercentPerKm: 6.75,
  lowBatteryThresholdPercent: 20,
  safetyMarginPercent: 5,
};

describe("evaluateBatteryFeasibility", () => {
  it("is SUFFICIENT when arrival battery comfortably clears the required reserve", () => {
    const result = evaluateBatteryFeasibility(BASE);
    // 1km at 6.75%/km = 6.75% consumed, arriving at ~93.25% — required reserve is 25%.
    expect(result.level).toBe("SUFFICIENT");
    expect(result.estimatedConsumptionPercent).toBeCloseTo(6.75, 5);
    expect(result.estimatedArrivalPercent).toBeCloseTo(93.25, 5);
    expect(result.requiredReservePercent).toBe(25);
  });

  it("is MARGINAL when arrival battery clears the reserve but not the wider comfortable band", () => {
    // Required reserve 25%, comfortable band starts at 30%. Arrival ~27% sits in between.
    const result = evaluateBatteryFeasibility({ ...BASE, batteryPercent: 27 + 6.75, distanceMeters: 1000 });
    expect(result.level).toBe("MARGINAL");
  });

  it("is INSUFFICIENT when arrival battery falls below the required reserve", () => {
    const result = evaluateBatteryFeasibility({ ...BASE, batteryPercent: 30, distanceMeters: 5000 });
    // 5km at 6.75%/km = 33.75% consumed — battery can't even cover the trip.
    expect(result.level).toBe("INSUFFICIENT");
    expect(result.reasons.some((r) => r.includes("must not be selected"))).toBe(true);
  });

  it("is exactly on the INSUFFICIENT/MARGINAL boundary when arrival equals the required reserve", () => {
    // 25% required reserve; consumption 6.75% means starting battery of 31.75% arrives at exactly 25%.
    const result = evaluateBatteryFeasibility({ ...BASE, batteryPercent: 31.75 });
    expect(result.estimatedArrivalPercent).toBeCloseTo(25, 5);
    expect(result.level).toBe("MARGINAL");
  });

  it("is deterministic for identical inputs", () => {
    expect(evaluateBatteryFeasibility(BASE)).toEqual(evaluateBatteryFeasibility(BASE));
  });

  it("always includes an explanation of the consumption and reserve math in reasons", () => {
    const result = evaluateBatteryFeasibility(BASE);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
    expect(result.reasons[0]).toMatch(/Estimated consumption/);
    expect(result.reasons[1]).toMatch(/Estimated arrival battery/);
  });
});
