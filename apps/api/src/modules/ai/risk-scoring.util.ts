import type { WeatherSafetyLevel } from "../weather/weather-safety.util";
import type { BatteryFeasibilityLevel } from "./battery-feasibility.util";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface RiskScoreInput {
  weatherSafetyLevel: WeatherSafetyLevel;
  batteryFeasibilityLevel: BatteryFeasibilityLevel;
  distanceMeters: number;
  droneMaxRangeKm: number;
  droneBatteryHealthPercent: number;
  priority: "STANDARD" | "EXPRESS";
  mediumThreshold: number;
  highThreshold: number;
}

export interface RiskScoreResult {
  score: number;
  level: RiskLevel;
  reasons: string[];
}

/**
 * Composite, explainable 0-100 risk score (higher = riskier) —
 * `DeliveryRiskAnalyzer`'s deterministic v1. Each component is capped
 * independently so no single factor can single-handedly force `HIGH`
 * except an outright `INSUFFICIENT` battery feasibility, which already
 * can't happen for a selected route (`RouteOptimizer` never selects one) —
 * it only shows up here when risk is (re)assessed for a *specific* drone
 * at assignment time, where a marginal-but-technically-feasible pairing is
 * exactly the "borderline" case operator approval exists for.
 */
export function scoreDeliveryRisk(input: RiskScoreInput): RiskScoreResult {
  const reasons: string[] = [];

  let weatherComponent = 0;
  if (input.weatherSafetyLevel === "UNSAFE") {
    weatherComponent = 40;
    reasons.push("Weather conditions are unsafe (40/40 risk points)");
  } else if (input.weatherSafetyLevel === "CAUTION") {
    weatherComponent = 20;
    reasons.push("Weather conditions require caution (20/40 risk points)");
  } else {
    reasons.push("Weather conditions are safe (0/40 risk points)");
  }

  let batteryComponent = 0;
  if (input.batteryFeasibilityLevel === "INSUFFICIENT") {
    batteryComponent = 30;
    reasons.push("Battery reserve is insufficient for this route (30/30 risk points)");
  } else if (input.batteryFeasibilityLevel === "MARGINAL") {
    batteryComponent = 15;
    reasons.push("Battery reserve is marginal for this route (15/30 risk points)");
  } else {
    reasons.push("Battery reserve is sufficient (0/30 risk points)");
  }

  const rangeRatio = input.droneMaxRangeKm > 0 ? input.distanceMeters / 1000 / input.droneMaxRangeKm : 1;
  const distanceComponent = Math.round(Math.min(1, Math.max(0, (rangeRatio - 0.3) / 0.5)) * 15);
  if (distanceComponent > 0) {
    reasons.push(`Route distance is ${(rangeRatio * 100).toFixed(0)}% of the drone's rated range (${distanceComponent}/15 risk points)`);
  } else {
    reasons.push("Route distance is well within the drone's rated range (0/15 risk points)");
  }

  const healthComponent = Math.round(Math.min(15, Math.max(0, (100 - input.droneBatteryHealthPercent) * 0.15)));
  if (healthComponent > 0) {
    reasons.push(`Drone battery health is ${input.droneBatteryHealthPercent}% (${healthComponent}/15 risk points)`);
  } else {
    reasons.push("Drone battery health is excellent (0/15 risk points)");
  }

  const priorityComponent = input.priority === "EXPRESS" ? 5 : 0;
  if (priorityComponent > 0) {
    reasons.push("Express priority reduces scheduling margin (5/5 risk points)");
  }

  const score = Math.min(100, weatherComponent + batteryComponent + distanceComponent + healthComponent + priorityComponent);

  let level: RiskLevel;
  if (score >= input.highThreshold) {
    level = "HIGH";
  } else if (score >= input.mediumThreshold) {
    level = "MEDIUM";
  } else {
    level = "LOW";
  }

  return { score, level, reasons };
}
