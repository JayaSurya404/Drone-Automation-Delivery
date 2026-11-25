import type { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import type { GeofencingService } from "../geofencing/geofencing.service";
import { HeuristicRouteOptimizer } from "./heuristic-route-optimizer";
import type { RouteOptimizerInput } from "./interfaces/route-optimizer.interface";

const CONFIG_VALUES: Record<string, number> = {
  AI_BATTERY_DRAIN_PERCENT_PER_KM: 6.75,
  DRONE_LOW_BATTERY_THRESHOLD_PERCENT: 20,
  AI_BATTERY_SAFETY_MARGIN_PERCENT: 5,
};

function makeConfigService(overrides: Record<string, number> = {}): ConfigService<EnvConfig, true> {
  const values = { ...CONFIG_VALUES, ...overrides };
  return { get: (key: string) => values[key] } as unknown as ConfigService<EnvConfig, true>;
}

const BASE_INPUT: RouteOptimizerInput = {
  origin: { lat: 44.9778, lng: -93.265 },
  destination: { lat: 44.99, lng: -93.25 },
  droneMaxSpeedMps: 15,
  droneMaxRangeKm: 10,
  weather: { windSpeedMps: 2, condition: "CLEAR", safetyLevel: "SAFE" },
};

describe("HeuristicRouteOptimizer", () => {
  let geofencingService: { findRouteViolations: jest.Mock };
  let optimizer: HeuristicRouteOptimizer;

  beforeEach(() => {
    geofencingService = { findRouteViolations: jest.fn().mockResolvedValue([]) };
    optimizer = new HeuristicRouteOptimizer(geofencingService as unknown as GeofencingService, makeConfigService());
  });

  it("selects the direct route when it clears geofencing (cheaper than any penalized detour)", async () => {
    const result = await optimizer.optimize(BASE_INPUT);
    expect(result.selected).not.toBeNull();
    expect(result.selected!.isDirect).toBe(true);
    expect(result.selected!.geofenceCleared).toBe(true);
    expect(result.reasons[0]).toMatch(/Direct route selected/);
  });

  it("evaluates 5 candidates: the direct line plus 4 fixed detours", async () => {
    const result = await optimizer.optimize(BASE_INPUT);
    expect(geofencingService.findRouteViolations).toHaveBeenCalledTimes(5);
    expect(result.alternatives.length + 1).toBe(5);
  });

  it("is deterministic — identical inputs produce identical selected/alternatives/reasons", async () => {
    const first = await optimizer.optimize(BASE_INPUT);
    const second = await optimizer.optimize(BASE_INPUT);
    expect(first).toEqual(second);
  });

  it("falls back to a detour when the direct route is geofence-blocked", async () => {
    geofencingService.findRouteViolations
      .mockResolvedValueOnce([{ id: "geo-1", name: "Restricted Zone", type: "RESTRICTED" }]) // direct
      .mockResolvedValue([]); // every detour clears

    const result = await optimizer.optimize(BASE_INPUT);
    expect(result.selected).not.toBeNull();
    expect(result.selected!.isDirect).toBe(false);
    expect(result.reasons[0]).toMatch(/Direct route was blocked/);
  });

  it("returns selected: null with a geofence-specific reason when every candidate is blocked", async () => {
    geofencingService.findRouteViolations.mockResolvedValue([{ id: "geo-1", name: "No-Fly Zone", type: "NO_FLY" }]);

    const result = await optimizer.optimize(BASE_INPUT);
    expect(result.selected).toBeNull();
    expect(result.alternatives).toHaveLength(5);
    expect(result.reasons[0]).toMatch(/No candidate route avoids the restricted\/no-fly zone/);
    expect(result.reasons[0]).toContain("No-Fly Zone");
  });

  it("treats battery as informational (not a hard filter) when droneBatteryPercent is omitted, even if the assumed-100% estimate would be INSUFFICIENT", async () => {
    // An enormous drain rate makes even a 100%-battery estimate INSUFFICIENT for this short hop.
    const drainHeavyOptimizer = new HeuristicRouteOptimizer(geofencingService as unknown as GeofencingService, makeConfigService({ AI_BATTERY_DRAIN_PERCENT_PER_KM: 500 }));
    const result = await drainHeavyOptimizer.optimize(BASE_INPUT);
    expect(result.selected).not.toBeNull();
  });

  it("treats battery as an authoritative hard filter once droneBatteryPercent is provided, rejecting every candidate that can't safely return home", async () => {
    const result = await optimizer.optimize({ ...BASE_INPUT, droneBatteryPercent: 5 });
    expect(result.selected).toBeNull();
    expect(result.reasons[0]).toMatch(/sufficient battery reserve/);
  });

  it("selects a battery-feasible candidate when droneBatteryPercent is authoritative and sufficient", async () => {
    const result = await optimizer.optimize({ ...BASE_INPUT, droneBatteryPercent: 100 });
    expect(result.selected).not.toBeNull();
    expect(result.selected!.batteryFeasibility.level).toBe("SUFFICIENT");
  });
});
