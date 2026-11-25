import type { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import { BatteryAwareRouterService } from "./battery-aware-router.service";

describe("BatteryAwareRouterService", () => {
  it("reads its coefficients from ConfigService and forwards to evaluateBatteryFeasibility", () => {
    const configService = {
      get: (key: string) =>
        ({
          AI_BATTERY_DRAIN_PERCENT_PER_KM: 6.75,
          DRONE_LOW_BATTERY_THRESHOLD_PERCENT: 20,
          AI_BATTERY_SAFETY_MARGIN_PERCENT: 5,
        })[key],
    } as unknown as ConfigService<EnvConfig, true>;

    const service = new BatteryAwareRouterService(configService);
    const result = service.evaluate(100, 1000);

    expect(result.level).toBe("SUFFICIENT");
    expect(result.estimatedConsumptionPercent).toBeCloseTo(6.75, 5);
  });

  it("returns INSUFFICIENT when the configured drain rate can't be covered by the given battery", () => {
    const configService = {
      get: (key: string) =>
        ({
          AI_BATTERY_DRAIN_PERCENT_PER_KM: 6.75,
          DRONE_LOW_BATTERY_THRESHOLD_PERCENT: 20,
          AI_BATTERY_SAFETY_MARGIN_PERCENT: 5,
        })[key],
    } as unknown as ConfigService<EnvConfig, true>;

    const service = new BatteryAwareRouterService(configService);
    const result = service.evaluate(30, 5000);
    expect(result.level).toBe("INSUFFICIENT");
  });
});
