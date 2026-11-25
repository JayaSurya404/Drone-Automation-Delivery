import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import type { BatteryFeasibilityLevel } from "./battery-feasibility.util";
import { scoreDeliveryRisk, type RiskScoreResult } from "./risk-scoring.util";
import type { WeatherSafetyLevel } from "../weather/weather-safety.util";

export interface RiskAnalysisInput {
  weatherSafetyLevel: WeatherSafetyLevel;
  batteryFeasibilityLevel: BatteryFeasibilityLevel;
  distanceMeters: number;
  droneMaxRangeKm: number;
  droneBatteryHealthPercent: number;
  priority: "STANDARD" | "EXPRESS";
}

/** Thin config-reading wrapper around `scoreDeliveryRisk()` — the `DeliveryRiskAnalyzer` capability from blueprint Section T. */
@Injectable()
export class DeliveryRiskAnalyzerService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  assess(input: RiskAnalysisInput): RiskScoreResult {
    return scoreDeliveryRisk({
      ...input,
      mediumThreshold: this.configService.get("AI_RISK_MEDIUM_THRESHOLD", { infer: true }),
      highThreshold: this.configService.get("AI_RISK_HIGH_THRESHOLD", { infer: true }),
    });
  }
}
