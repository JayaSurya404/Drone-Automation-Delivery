import type { WeatherCondition } from "@prisma/client";
import type { WeatherSafetyLevel } from "../../weather/weather-safety.util";
import type { EtaConfidence } from "../eta.util";

export interface EtaPredictorInput {
  distanceMeters: number;
  droneMaxSpeedMps: number;
  windSpeedMps: number;
  weatherCondition: WeatherCondition;
  weatherSafetyLevel: WeatherSafetyLevel;
}

export interface EtaPredictionResult {
  etaAt: Date;
  durationSeconds: number;
  confidence: EtaConfidence;
  factors: string[];
  predictedAt: Date;
}

/**
 * The `ETAPredictor` adapter (blueprint Section T) — replaces Phase 5's
 * flat `EtaEstimator` placeholder. `HeuristicEtaPredictor` (v1) is a pure
 * distance/speed/wind model (`eta.util.ts`'s `estimateEta()`); a future
 * regression model trained on completed-mission data (Phase 11+) would
 * implement this same interface.
 */
export interface EtaPredictor {
  predict(input: EtaPredictorInput): EtaPredictionResult;
}

/** DI token — `ai.module.ts` binds this to `HeuristicEtaPredictor`. */
export const ETA_PREDICTOR = Symbol("ETA_PREDICTOR");
