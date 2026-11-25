import { estimateCostPerDelivery } from "./analytics-cost.util";

describe("estimateCostPerDelivery", () => {
  it("returns null when there is no distance data to estimate from", () => {
    expect(estimateCostPerDelivery({ avgDistanceKm: null, costPerKmUsd: 0.35, fixedCostPerMissionUsd: 1.5 })).toBeNull();
  });

  it("computes fixedCost + avgDistanceKm * costPerKm", () => {
    const result = estimateCostPerDelivery({ avgDistanceKm: 2, costPerKmUsd: 0.35, fixedCostPerMissionUsd: 1.5 });
    expect(result).toBe(2.2); // 1.5 + 2*0.35
  });

  it("returns exactly the fixed cost when distance is 0", () => {
    const result = estimateCostPerDelivery({ avgDistanceKm: 0, costPerKmUsd: 0.35, fixedCostPerMissionUsd: 1.5 });
    expect(result).toBe(1.5);
  });

  it("is deterministic for identical inputs", () => {
    const input = { avgDistanceKm: 3.7, costPerKmUsd: 0.42, fixedCostPerMissionUsd: 2.1 };
    expect(estimateCostPerDelivery(input)).toBe(estimateCostPerDelivery(input));
  });

  it("rounds the result to 2 decimal places", () => {
    const result = estimateCostPerDelivery({ avgDistanceKm: 1, costPerKmUsd: 0.333, fixedCostPerMissionUsd: 1 });
    expect(result).toBe(1.33);
  });
});
