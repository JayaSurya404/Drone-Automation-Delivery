import type { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import { DeliveryRiskAnalyzerService, type RiskAnalysisInput } from "./delivery-risk-analyzer.service";

function makeConfigService(): ConfigService<EnvConfig, true> {
  return {
    get: (key: string) =>
      ({
        AI_RISK_MEDIUM_THRESHOLD: 40,
        AI_RISK_HIGH_THRESHOLD: 70,
      })[key],
  } as unknown as ConfigService<EnvConfig, true>;
}

const BASE: RiskAnalysisInput = {
  weatherSafetyLevel: "SAFE",
  batteryFeasibilityLevel: "SUFFICIENT",
  distanceMeters: 500,
  droneMaxRangeKm: 10,
  droneBatteryHealthPercent: 100,
  priority: "STANDARD",
};

describe("DeliveryRiskAnalyzerService", () => {
  it("reads its thresholds from ConfigService and forwards to scoreDeliveryRisk", () => {
    const service = new DeliveryRiskAnalyzerService(makeConfigService());
    const result = service.assess(BASE);
    expect(result.score).toBe(0);
    expect(result.level).toBe("LOW");
  });

  it("classifies HIGH once the configured high threshold is reached", () => {
    const service = new DeliveryRiskAnalyzerService(makeConfigService());
    const result = service.assess({ ...BASE, weatherSafetyLevel: "UNSAFE", batteryFeasibilityLevel: "INSUFFICIENT" });
    expect(result.level).toBe("HIGH");
  });
});
