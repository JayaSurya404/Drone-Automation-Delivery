import type { DronesService, DroneView } from "../drones/drones.service";
import { BatteryAwareRouterService } from "./battery-aware-router.service";
import { DroneSelectionService } from "./drone-selection.service";

function makeDrone(overrides: Partial<DroneView> = {}): DroneView {
  return {
    id: "drone-1",
    name: "Falcon One",
    status: "IDLE",
    batteryPercent: 100,
    batteryHealthPercent: 100,
    maxPayloadKg: 5,
    maxRangeKm: 10,
    currentLat: null,
    currentLng: null,
    ...overrides,
  } as DroneView;
}

describe("DroneSelectionService", () => {
  let dronesService: { listAvailable: jest.Mock };
  let batteryAwareRouter: { evaluate: jest.Mock };
  let service: DroneSelectionService;

  beforeEach(() => {
    dronesService = { listAvailable: jest.fn() };
    batteryAwareRouter = { evaluate: jest.fn().mockReturnValue({ level: "SUFFICIENT", estimatedConsumptionPercent: 5, estimatedArrivalPercent: 95, requiredReservePercent: 25, reasons: [] }) };
    service = new DroneSelectionService(dronesService as unknown as DronesService, batteryAwareRouter as unknown as BatteryAwareRouterService);
  });

  it("ranks eligible drones returned by DronesService.listAvailable, highest score first", async () => {
    dronesService.listAvailable.mockResolvedValue([
      makeDrone({ id: "drone-weak", batteryPercent: 20 }),
      makeDrone({ id: "drone-strong", batteryPercent: 100 }),
    ]);

    const result = await service.recommend({ origin: { lat: 44.9778, lng: -93.265 }, distanceMeters: 1000, payloadKg: 1 });

    expect(result.map((r) => r.droneId)).toEqual(["drone-strong", "drone-weak"]);
  });

  it("forwards the hub filter to DronesService.listAvailable", async () => {
    dronesService.listAvailable.mockResolvedValue([]);
    await service.recommend({ origin: { lat: 44.9778, lng: -93.265 }, distanceMeters: 1000, payloadKg: 1, hubId: "hub-1" });
    expect(dronesService.listAvailable).toHaveBeenCalledWith("hub-1");
  });

  it("computes distance from the drone's known current position rather than the mission distance when available", async () => {
    dronesService.listAvailable.mockResolvedValue([makeDrone({ currentLat: 44.9778, currentLng: -93.265 })]);
    await service.recommend({ origin: { lat: 44.99, lng: -93.25 }, distanceMeters: 1000, payloadKg: 1 });
    // With a known current position far from the origin, proximity scoring should reflect the real (larger) distance, not the flat mission distance.
    expect(batteryAwareRouter.evaluate).toHaveBeenCalledWith(100, 1000);
  });

  it("falls back to the mission distance when the drone has no known current position", async () => {
    dronesService.listAvailable.mockResolvedValue([makeDrone({ currentLat: null, currentLng: null })]);
    const result = await service.recommend({ origin: { lat: 44.9778, lng: -93.265 }, distanceMeters: 2500, payloadKg: 1 });
    expect(result[0]!.eligible).toBe(true);
  });

  it("marks a drone ineligible when its battery feasibility for this route is INSUFFICIENT", async () => {
    batteryAwareRouter.evaluate.mockReturnValue({ level: "INSUFFICIENT", estimatedConsumptionPercent: 90, estimatedArrivalPercent: 5, requiredReservePercent: 25, reasons: [] });
    dronesService.listAvailable.mockResolvedValue([makeDrone()]);
    const result = await service.recommend({ origin: { lat: 44.9778, lng: -93.265 }, distanceMeters: 9000, payloadKg: 1 });
    expect(result[0]!.eligible).toBe(false);
  });

  it("returns an empty list when no drones are available", async () => {
    dronesService.listAvailable.mockResolvedValue([]);
    const result = await service.recommend({ origin: { lat: 44.9778, lng: -93.265 }, distanceMeters: 1000, payloadKg: 1 });
    expect(result).toEqual([]);
  });
});
