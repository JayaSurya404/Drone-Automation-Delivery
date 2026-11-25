import { evaluateWeatherSafety, type WeatherThresholds } from "./weather-safety.util";

const THRESHOLDS: WeatherThresholds = {
  cautionWindMps: 8,
  unsafeWindMps: 12,
  cautionPrecipitationMm: 1.5,
  unsafePrecipitationMm: 4,
  unsafeConditions: ["STORM", "SNOW"],
  cautionConditions: ["FOG", "RAIN"],
};

describe("evaluateWeatherSafety", () => {
  it("is SAFE for calm, clear conditions", () => {
    const result = evaluateWeatherSafety({ windSpeedMps: 3, precipitationMm: 0, condition: "CLEAR" }, THRESHOLDS);
    expect(result.level).toBe("SAFE");
    expect(result.reasons).toEqual(["Conditions are within all safety thresholds"]);
  });

  it("escalates to CAUTION at the wind caution threshold", () => {
    const result = evaluateWeatherSafety({ windSpeedMps: 9, precipitationMm: 0, condition: "CLEAR" }, THRESHOLDS);
    expect(result.level).toBe("CAUTION");
    expect(result.reasons[0]).toMatch(/Wind speed/);
  });

  it("escalates to UNSAFE at the wind unsafe threshold", () => {
    const result = evaluateWeatherSafety({ windSpeedMps: 15, precipitationMm: 0, condition: "CLEAR" }, THRESHOLDS);
    expect(result.level).toBe("UNSAFE");
  });

  it("escalates to CAUTION at the precipitation caution threshold", () => {
    const result = evaluateWeatherSafety({ windSpeedMps: 3, precipitationMm: 2, condition: "CLEAR" }, THRESHOLDS);
    expect(result.level).toBe("CAUTION");
  });

  it("escalates to UNSAFE at the precipitation unsafe threshold", () => {
    const result = evaluateWeatherSafety({ windSpeedMps: 3, precipitationMm: 5, condition: "CLEAR" }, THRESHOLDS);
    expect(result.level).toBe("UNSAFE");
  });

  it("treats an unsafe-listed condition (STORM) as UNSAFE even with calm numeric readings", () => {
    const result = evaluateWeatherSafety({ windSpeedMps: 1, precipitationMm: 0, condition: "STORM" }, THRESHOLDS);
    expect(result.level).toBe("UNSAFE");
    expect(result.reasons[0]).toMatch(/Unsafe weather condition/);
  });

  it("treats a caution-listed condition (FOG) as CAUTION even with calm numeric readings", () => {
    const result = evaluateWeatherSafety({ windSpeedMps: 1, precipitationMm: 0, condition: "FOG" }, THRESHOLDS);
    expect(result.level).toBe("CAUTION");
  });

  it("never downgrades UNSAFE back to CAUTION when a later check is only caution-level", () => {
    // Unsafe wind (checked first) followed by a caution-level condition — level must stay UNSAFE.
    const result = evaluateWeatherSafety({ windSpeedMps: 15, precipitationMm: 0, condition: "FOG" }, THRESHOLDS);
    expect(result.level).toBe("UNSAFE");
  });

  it("collects every applicable reason, not just the first", () => {
    const result = evaluateWeatherSafety({ windSpeedMps: 15, precipitationMm: 5, condition: "STORM" }, THRESHOLDS);
    expect(result.reasons).toHaveLength(3);
  });
});
