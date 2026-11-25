import type { LandingZoneVerdict } from "../vision/landing-zone.util";
import type { BatteryFeasibilityLevel } from "../ai/battery-feasibility.util";
import type { WeatherSafetyLevel } from "../weather/weather-safety.util";

export type SimulationRiskCategory =
  | "LOW_BATTERY"
  | "UNSAFE_LANDING_ZONE"
  | "ROUTE_OBSTRUCTION"
  | "GEOFENCE_CONFLICT"
  | "WEATHER_CONFLICT"
  | "PAYLOAD_CONSTRAINT"
  | "DRONE_AVAILABILITY_CONFLICT";

export type SimulationRiskSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface SimulationRiskFindingResult {
  category: SimulationRiskCategory;
  severity: SimulationRiskSeverity;
  message: string;
}

export interface DeriveSimulationRiskFindingsInput {
  droneAvailable: boolean;
  payloadExceedsCapacity: boolean;
  routeSelected: boolean;
  /** True when no candidate route ever cleared geofences — distinct from `!routeSelected` alone, since a route can also be rejected purely on battery. */
  geofenceBlocked: boolean;
  batteryFeasibilityLevel: BatteryFeasibilityLevel | null;
  weatherSafetyLevel: WeatherSafetyLevel;
  landingZoneVerdict: LandingZoneVerdict | null;
  obstructionDetected: boolean;
}

/**
 * Part 7 — simulation-time risk identification. A pure mapping from
 * already-computed conditions (never a second, parallel risk model) onto
 * named findings — every condition here is produced by an *existing*
 * service (`RouteOptimizer`'s battery feasibility, `WeatherService`'s
 * safety evaluation, `LandingZoneService`'s verdict, `DronesService`'s
 * availability), so this never duplicates the authoritative safety rules
 * those services already enforce (Part 7's explicit instruction).
 */
export function deriveSimulationRiskFindings(input: DeriveSimulationRiskFindingsInput): SimulationRiskFindingResult[] {
  const findings: SimulationRiskFindingResult[] = [];

  if (!input.droneAvailable) {
    findings.push({ category: "DRONE_AVAILABILITY_CONFLICT", severity: "HIGH", message: "No eligible drone was available for this scenario" });
  }
  if (input.payloadExceedsCapacity) {
    findings.push({ category: "PAYLOAD_CONSTRAINT", severity: "HIGH", message: "Scenario payload exceeds the selected drone's rated capacity" });
  }
  if (input.geofenceBlocked || !input.routeSelected) {
    findings.push({ category: "GEOFENCE_CONFLICT", severity: "HIGH", message: "No candidate route cleared active geofences" });
  }
  if (input.batteryFeasibilityLevel === "INSUFFICIENT") {
    findings.push({ category: "LOW_BATTERY", severity: "HIGH", message: "Estimated arrival battery is below the required return-to-home reserve" });
  } else if (input.batteryFeasibilityLevel === "MARGINAL") {
    findings.push({ category: "LOW_BATTERY", severity: "MEDIUM", message: "Estimated arrival battery is within the safety margin but not comfortable" });
  }
  if (input.weatherSafetyLevel === "UNSAFE") {
    findings.push({ category: "WEATHER_CONFLICT", severity: "HIGH", message: "Weather conditions at the origin are unsafe for flight" });
  } else if (input.weatherSafetyLevel === "CAUTION") {
    findings.push({ category: "WEATHER_CONFLICT", severity: "MEDIUM", message: "Weather conditions at the origin require caution" });
  }
  if (input.landingZoneVerdict === "UNSUITABLE") {
    findings.push({ category: "UNSAFE_LANDING_ZONE", severity: "HIGH", message: "The evaluated landing zone at the destination is unsuitable" });
  } else if (input.landingZoneVerdict === "MARGINAL") {
    findings.push({ category: "UNSAFE_LANDING_ZONE", severity: "MEDIUM", message: "The evaluated landing zone at the destination is only marginally suitable" });
  }
  if (input.obstructionDetected) {
    findings.push({ category: "ROUTE_OBSTRUCTION", severity: "MEDIUM", message: "Computer-vision analysis detected an obstruction near the destination" });
  }

  return findings;
}
