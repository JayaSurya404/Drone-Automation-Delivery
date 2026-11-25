import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import { evaluateBatteryFeasibility, type BatteryFeasibilityResult } from "./battery-feasibility.util";

/** Thin config-reading wrapper around the pure `evaluateBatteryFeasibility()` — the `BatteryAwareRouter` capability from blueprint Section T. No swappable interface: this is an algorithm (reserve-margin arithmetic), not something a future ML model would meaningfully replace, the same reasoning `EtaEstimator` used in Phase 5 for skipping interface ceremony until a second implementation is real. */
@Injectable()
export class BatteryAwareRouterService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  evaluate(batteryPercent: number, distanceMeters: number): BatteryFeasibilityResult {
    return evaluateBatteryFeasibility({
      batteryPercent,
      distanceMeters,
      drainPercentPerKm: this.configService.get("AI_BATTERY_DRAIN_PERCENT_PER_KM", { infer: true }),
      lowBatteryThresholdPercent: this.configService.get("DRONE_LOW_BATTERY_THRESHOLD_PERCENT", { infer: true }),
      safetyMarginPercent: this.configService.get("AI_BATTERY_SAFETY_MARGIN_PERCENT", { infer: true }),
    });
  }
}
