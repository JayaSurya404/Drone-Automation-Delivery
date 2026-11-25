import { deriveSimulationRiskFindings, type DeriveSimulationRiskFindingsInput } from "./digital-twin-risk.util";

const CLEAN_INPUT: DeriveSimulationRiskFindingsInput = {
  droneAvailable: true,
  payloadExceedsCapacity: false,
  routeSelected: true,
  geofenceBlocked: false,
  batteryFeasibilityLevel: "SUFFICIENT",
  weatherSafetyLevel: "SAFE",
  landingZoneVerdict: "SUITABLE",
  obstructionDetected: false,
};

describe("deriveSimulationRiskFindings", () => {
  it("returns no findings for a fully clean scenario", () => {
    expect(deriveSimulationRiskFindings(CLEAN_INPUT)).toEqual([]);
  });

  it("flags DRONE_AVAILABILITY_CONFLICT when no drone was available", () => {
    const findings = deriveSimulationRiskFindings({ ...CLEAN_INPUT, droneAvailable: false });
    expect(findings.some((f) => f.category === "DRONE_AVAILABILITY_CONFLICT" && f.severity === "HIGH")).toBe(true);
  });

  it("flags PAYLOAD_CONSTRAINT when payload exceeds capacity", () => {
    const findings = deriveSimulationRiskFindings({ ...CLEAN_INPUT, payloadExceedsCapacity: true });
    expect(findings.some((f) => f.category === "PAYLOAD_CONSTRAINT")).toBe(true);
  });

  it("flags GEOFENCE_CONFLICT when no route was selected, even without an explicit geofenceBlocked flag", () => {
    const findings = deriveSimulationRiskFindings({ ...CLEAN_INPUT, routeSelected: false });
    expect(findings.some((f) => f.category === "GEOFENCE_CONFLICT")).toBe(true);
  });

  it("distinguishes MARGINAL (MEDIUM) from INSUFFICIENT (HIGH) battery", () => {
    const marginal = deriveSimulationRiskFindings({ ...CLEAN_INPUT, batteryFeasibilityLevel: "MARGINAL" });
    expect(marginal.find((f) => f.category === "LOW_BATTERY")?.severity).toBe("MEDIUM");

    const insufficient = deriveSimulationRiskFindings({ ...CLEAN_INPUT, batteryFeasibilityLevel: "INSUFFICIENT" });
    expect(insufficient.find((f) => f.category === "LOW_BATTERY")?.severity).toBe("HIGH");
  });

  it("distinguishes CAUTION (MEDIUM) from UNSAFE (HIGH) weather", () => {
    const caution = deriveSimulationRiskFindings({ ...CLEAN_INPUT, weatherSafetyLevel: "CAUTION" });
    expect(caution.find((f) => f.category === "WEATHER_CONFLICT")?.severity).toBe("MEDIUM");

    const unsafe = deriveSimulationRiskFindings({ ...CLEAN_INPUT, weatherSafetyLevel: "UNSAFE" });
    expect(unsafe.find((f) => f.category === "WEATHER_CONFLICT")?.severity).toBe("HIGH");
  });

  it("distinguishes MARGINAL (MEDIUM) from UNSUITABLE (HIGH) landing zones, and null as no finding", () => {
    const marginal = deriveSimulationRiskFindings({ ...CLEAN_INPUT, landingZoneVerdict: "MARGINAL" });
    expect(marginal.find((f) => f.category === "UNSAFE_LANDING_ZONE")?.severity).toBe("MEDIUM");

    const unsuitable = deriveSimulationRiskFindings({ ...CLEAN_INPUT, landingZoneVerdict: "UNSUITABLE" });
    expect(unsuitable.find((f) => f.category === "UNSAFE_LANDING_ZONE")?.severity).toBe("HIGH");

    const none = deriveSimulationRiskFindings({ ...CLEAN_INPUT, landingZoneVerdict: null });
    expect(none.some((f) => f.category === "UNSAFE_LANDING_ZONE")).toBe(false);
  });

  it("flags ROUTE_OBSTRUCTION when an obstruction was detected", () => {
    const findings = deriveSimulationRiskFindings({ ...CLEAN_INPUT, obstructionDetected: true });
    expect(findings.some((f) => f.category === "ROUTE_OBSTRUCTION")).toBe(true);
  });

  it("can accumulate multiple simultaneous findings", () => {
    const findings = deriveSimulationRiskFindings({
      ...CLEAN_INPUT,
      droneAvailable: false,
      weatherSafetyLevel: "UNSAFE",
      obstructionDetected: true,
    });
    expect(findings).toHaveLength(3);
  });
});
