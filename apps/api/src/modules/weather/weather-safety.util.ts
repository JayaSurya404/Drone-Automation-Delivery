import type { WeatherCondition } from "@prisma/client";

export type WeatherSafetyLevel = "SAFE" | "CAUTION" | "UNSAFE";

export interface WeatherThresholds {
  cautionWindMps: number;
  unsafeWindMps: number;
  cautionPrecipitationMm: number;
  unsafePrecipitationMm: number;
  /** Conditions that are unsafe regardless of the numeric wind/precipitation thresholds (e.g. a storm at low measured wind is still a storm). */
  unsafeConditions: WeatherCondition[];
  cautionConditions: WeatherCondition[];
}

export interface WeatherSafetyResult {
  level: WeatherSafetyLevel;
  reasons: string[];
}

/**
 * Pure, deterministic three-tier safety evaluation (SAFE/CAUTION/UNSAFE) —
 * the phase-08 requirement's "deterministic safety evaluation layer,"
 * exercised directly by `WeatherService` and unit-testable without a
 * database or a running app, the same `mission-state-machine.ts`/`route.util.ts`
 * pure-function precedent from Phase 6. Every reason string is
 * ops-facing detail (exact readings vs. thresholds) — callers that forward
 * this to a customer must summarize it into safe, generic language instead
 * (see `RealtimeBroadcasterService`'s `mission.safety_blocked` handling).
 */
export function evaluateWeatherSafety(
  weather: { windSpeedMps: number; precipitationMm: number; condition: WeatherCondition },
  thresholds: WeatherThresholds,
): WeatherSafetyResult {
  const reasons: string[] = [];
  let level: WeatherSafetyLevel = "SAFE";

  function escalate(next: WeatherSafetyLevel) {
    if (next === "UNSAFE" || (next === "CAUTION" && level === "SAFE")) {
      level = next;
    }
  }

  if (thresholds.unsafeConditions.includes(weather.condition)) {
    reasons.push(`Unsafe weather condition: ${weather.condition}`);
    escalate("UNSAFE");
  } else if (thresholds.cautionConditions.includes(weather.condition)) {
    reasons.push(`Weather condition requires caution: ${weather.condition}`);
    escalate("CAUTION");
  }

  if (weather.windSpeedMps >= thresholds.unsafeWindMps) {
    reasons.push(`Wind speed ${weather.windSpeedMps.toFixed(1)} m/s exceeds the unsafe threshold (${thresholds.unsafeWindMps} m/s)`);
    escalate("UNSAFE");
  } else if (weather.windSpeedMps >= thresholds.cautionWindMps) {
    reasons.push(`Wind speed ${weather.windSpeedMps.toFixed(1)} m/s exceeds the caution threshold (${thresholds.cautionWindMps} m/s)`);
    escalate("CAUTION");
  }

  if (weather.precipitationMm >= thresholds.unsafePrecipitationMm) {
    reasons.push(`Precipitation ${weather.precipitationMm.toFixed(1)} mm/h exceeds the unsafe threshold (${thresholds.unsafePrecipitationMm} mm/h)`);
    escalate("UNSAFE");
  } else if (weather.precipitationMm >= thresholds.cautionPrecipitationMm) {
    reasons.push(`Precipitation ${weather.precipitationMm.toFixed(1)} mm/h exceeds the caution threshold (${thresholds.cautionPrecipitationMm} mm/h)`);
    escalate("CAUTION");
  }

  if (reasons.length === 0) {
    reasons.push("Conditions are within all safety thresholds");
  }
  return { level, reasons };
}
