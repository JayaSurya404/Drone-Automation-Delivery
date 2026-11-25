import { round2 } from "./analytics-math.util";

export interface CostModelInput {
  /** Average real distance flown per completed mission in the window, computed from actual origin/waypoint/destination geometry — never assumed. */
  avgDistanceKm: number | null;
  /** `ANALYTICS_COST_PER_KM_USD` — an estimated per-kilometer operating cost (energy + amortized hardware wear), configurable, not a measured accounting figure. */
  costPerKmUsd: number;
  /** `ANALYTICS_FIXED_COST_PER_MISSION_USD` — an estimated fixed per-mission overhead (dispatch/ground ops), configurable. */
  fixedCostPerMissionUsd: number;
}

/**
 * `costPerDelivery = fixedCostPerMission + avgDistanceKm * costPerKm` — an
 * explicit, documented estimate model (phase-10's explicit requirement),
 * never presented as real financial accounting. Evaluating the linear
 * formula once against the fleet-wide average distance is mathematically
 * equivalent to averaging a per-mission cost across every mission, and far
 * cheaper to compute. Returns `null` when there's no completed-mission
 * distance data to estimate from in the window (never a fabricated `0`).
 */
export function estimateCostPerDelivery(input: CostModelInput): number | null {
  if (input.avgDistanceKm === null) {
    return null;
  }
  return round2(input.fixedCostPerMissionUsd + input.avgDistanceKm * input.costPerKmUsd);
}
