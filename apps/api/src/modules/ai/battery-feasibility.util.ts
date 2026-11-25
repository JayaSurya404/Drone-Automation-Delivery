export type BatteryFeasibilityLevel = "SUFFICIENT" | "MARGINAL" | "INSUFFICIENT";

export interface BatteryFeasibilityInput {
  batteryPercent: number;
  distanceMeters: number;
  drainPercentPerKm: number;
  /** Usually `DRONE_LOW_BATTERY_THRESHOLD_PERCENT` (Phase 6) — the point the mission engine auto-triggers RTH at. */
  lowBatteryThresholdPercent: number;
  /** Extra buffer on top of the RTH trigger threshold — `AI_BATTERY_SAFETY_MARGIN_PERCENT`. */
  safetyMarginPercent: number;
}

export interface BatteryFeasibilityResult {
  level: BatteryFeasibilityLevel;
  estimatedConsumptionPercent: number;
  estimatedArrivalPercent: number;
  requiredReservePercent: number;
  reasons: string[];
}

/**
 * A route "cannot safely return to home" (the phase-09 hard requirement)
 * precisely when it would arrive at or below the RTH auto-trigger
 * threshold — at that point the mission engine's *existing* Phase 6 safety
 * behavior takes over immediately, which only works if there's still
 * enough charge left to actually fly home. `requiredReservePercent` is
 * that threshold plus a configured safety margin: any route landing the
 * drone below it is `INSUFFICIENT` and must never be selected.
 * `MARGINAL` is a widening band above that floor — feasible, but closer
 * to the edge than `SUFFICIENT`, and factored into `DeliveryRiskAnalyzer`'s
 * score rather than blocked outright.
 */
export function evaluateBatteryFeasibility(input: BatteryFeasibilityInput): BatteryFeasibilityResult {
  const estimatedConsumptionPercent = (input.distanceMeters / 1000) * input.drainPercentPerKm;
  const estimatedArrivalPercent = input.batteryPercent - estimatedConsumptionPercent;
  const requiredReservePercent = input.lowBatteryThresholdPercent + input.safetyMarginPercent;
  const comfortableReservePercent = requiredReservePercent + input.safetyMarginPercent;

  const reasons: string[] = [
    `Estimated consumption ${estimatedConsumptionPercent.toFixed(1)}% for ${(input.distanceMeters / 1000).toFixed(2)} km`,
    `Estimated arrival battery ${estimatedArrivalPercent.toFixed(1)}% (required reserve ${requiredReservePercent.toFixed(1)}%)`,
  ];

  let level: BatteryFeasibilityLevel;
  if (estimatedArrivalPercent < requiredReservePercent) {
    level = "INSUFFICIENT";
    reasons.push("Below the required return-to-home reserve — this route must not be selected");
  } else if (estimatedArrivalPercent < comfortableReservePercent) {
    level = "MARGINAL";
    reasons.push("Above the required reserve but within the safety margin — feasible with reduced buffer");
  } else {
    level = "SUFFICIENT";
    reasons.push("Comfortably above the required reserve");
  }

  return { level, estimatedConsumptionPercent, estimatedArrivalPercent, requiredReservePercent, reasons };
}
