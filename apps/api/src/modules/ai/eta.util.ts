import type { WeatherCondition } from "@prisma/client";
import type { WeatherSafetyLevel } from "../weather/weather-safety.util";

export type EtaConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface EtaEstimateInput {
  distanceMeters: number;
  droneMaxSpeedMps: number;
  windSpeedMps: number;
  weatherCondition: WeatherCondition;
  weatherSafetyLevel: WeatherSafetyLevel;
  now: Date;
}

export interface EtaEstimateResult {
  etaAt: Date;
  durationSeconds: number;
  confidence: EtaConfidence;
  factors: string[];
  predictedAt: Date;
}

/** Cruise speed is never a drone's rated max — the same margin `SimulatedDroneAdapter` implicitly assumes by flying well under most drones' seeded `maxSpeedMps`. */
const CRUISE_SPEED_UTILIZATION = 0.8;
/** Wind reduces effective ground speed — a simple linear headwind-equivalent derate, not a full vector wind model (no reliable route-bearing-relative wind direction is available from the deterministic weather provider). */
const WIND_SPEED_PENALTY_FACTOR = 0.5;
const MIN_EFFECTIVE_SPEED_MPS = 3;
/** Fixed connect/arm/takeoff/land/verification overhead — matches the discrete command sequence `MissionsService.start()` actually issues, not a real telemetry-derived figure. */
const HANDLING_OVERHEAD_SECONDS = 90;

/**
 * Deterministic distance/speed ETA model — replaces Phase 5's flat
 * `EtaEstimator` placeholder and Phase 6's implicit "however long the
 * simulator takes" once a route exists. Every input is a plain number/enum
 * (no I/O), so the same inputs always produce the same output — required
 * both for test determinism and for `predictedAt`/`etaAt` to be
 * meaningfully reproducible in an audit log.
 */
export function estimateEta(input: EtaEstimateInput): EtaEstimateResult {
  const baseSpeedMps = input.droneMaxSpeedMps * CRUISE_SPEED_UTILIZATION;
  const windPenaltyMps = Math.min(input.windSpeedMps * WIND_SPEED_PENALTY_FACTOR, baseSpeedMps * 0.5);
  const effectiveSpeedMps = Math.max(baseSpeedMps - windPenaltyMps, MIN_EFFECTIVE_SPEED_MPS);

  const travelSeconds = input.distanceMeters / effectiveSpeedMps;
  const durationSeconds = Math.round(travelSeconds + HANDLING_OVERHEAD_SECONDS);
  const etaAt = new Date(input.now.getTime() + durationSeconds * 1000);

  const distanceKm = input.distanceMeters / 1000;
  let confidence: EtaConfidence;
  if (input.weatherSafetyLevel === "SAFE" && distanceKm < 3) {
    confidence = "HIGH";
  } else if (input.weatherSafetyLevel !== "UNSAFE" && distanceKm < 8) {
    confidence = "MEDIUM";
  } else {
    confidence = "LOW";
  }

  const factors = [
    `Distance ${distanceKm.toFixed(2)} km`,
    `Cruise speed ${effectiveSpeedMps.toFixed(1)} m/s (${(CRUISE_SPEED_UTILIZATION * 100).toFixed(0)}% of drone max, wind-adjusted)`,
    input.windSpeedMps > 0 ? `Wind ${input.windSpeedMps.toFixed(1)} m/s reduces cruise speed` : "Calm winds — no speed penalty",
    `Weather condition: ${input.weatherCondition}`,
    `Handling overhead: ${HANDLING_OVERHEAD_SECONDS}s (arm/takeoff/land/verification)`,
  ];

  return { etaAt, durationSeconds, confidence, factors, predictedAt: input.now };
}
