import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { EnvConfig } from "../../config/env.validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SimulatedDroneAdapter } from "./adapters/simulated-drone.adapter";
import { DronesService } from "./drones.service";

const actor = { sub: "staff-1", email: "staff@example.com", roles: ["fleet_manager"], permissions: ["drones.create", "drones.update", "drones.maintenance"] };

describe("DronesService", () => {
  let service: DronesService;
  let prisma: {
    drone: { create: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock; updateMany: jest.Mock; delete: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    droneHealthLog: { create: jest.Mock };
    batteryLog: { create: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let simulatedAdapter: { registerDrone: jest.Mock; unregisterDrone: jest.Mock };

  beforeEach(() => {
    prisma = {
      drone: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      droneHealthLog: { create: jest.fn().mockResolvedValue({}) },
      batteryLog: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    auditService = { log: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    simulatedAdapter = { registerDrone: jest.fn(), unregisterDrone: jest.fn() };

    service = new DronesService(
      prisma as unknown as PrismaService,
      { get: (key: string) => (key === "DRONE_LOW_BATTERY_THRESHOLD_PERCENT" ? 20 : undefined) } as unknown as ConfigService<EnvConfig, true>,
      auditService as unknown as AuditService,
      eventEmitter as unknown as EventEmitter2,
      simulatedAdapter as unknown as SimulatedDroneAdapter,
    );
  });

  describe("register", () => {
    it("rejects a homeHubId that doesn't resolve to a known hub", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await expect(
        service.register({ serialNumber: "SN-1", name: "D1", model: "X1", homeHubId: "bad-hub" }, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("registers the drone with the simulated adapter using the hub's coordinates", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ lat: 44.9, lng: -93.2 }]);
      prisma.drone.create.mockResolvedValueOnce({
        id: "drone-1",
        serialNumber: "SN-1",
        name: "D1",
        model: "X1",
        adapterType: "SIMULATED",
        status: "IDLE",
        homeHubId: "hub-1",
        batteryPercent: 100,
        batteryHealthPercent: 100,
        batteryCycles: 0,
        currentLat: 44.9,
        currentLng: -93.2,
        altitudeMeters: null,
        speedMps: null,
        headingDegrees: null,
        signalStrengthPercent: null,
        maxPayloadKg: 2.5,
        maxRangeKm: 10,
        maxSpeedMps: 15,
        maxAltitudeMeters: 120,
        isMaintenanceMode: false,
        maintenanceNote: null,
        lastTelemetryAt: null,
        totalFlightHours: 0,
        totalMissionsCompleted: 0,
        createdAt: new Date(),
      });

      const view = await service.register({ serialNumber: "SN-1", name: "D1", model: "X1", homeHubId: "hub-1" }, actor);

      expect(simulatedAdapter.registerDrone).toHaveBeenCalledWith("drone-1", expect.objectContaining({ lat: 44.9, lng: -93.2 }));
      expect(view.id).toBe("drone-1");
      expect(eventEmitter.emit).toHaveBeenCalledWith("drone.created", { droneId: "drone-1" });
    });
  });

  describe("setMaintenance", () => {
    it("refuses to flag an in-flight drone for maintenance", async () => {
      prisma.drone.findUnique.mockResolvedValueOnce({ id: "drone-1", status: "IN_FLIGHT" });
      await expect(service.setMaintenance("drone-1", { enabled: true }, actor)).rejects.toBeInstanceOf(ConflictException);
    });

    it("404s for an unknown drone", async () => {
      prisma.drone.findUnique.mockResolvedValueOnce(null);
      await expect(service.setMaintenance("missing", { enabled: true }, actor)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("assignIfAvailable", () => {
    it("atomically claims an IDLE, non-maintenance drone and returns its view", async () => {
      prisma.drone.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.drone.findUnique.mockResolvedValueOnce({
        id: "drone-1",
        serialNumber: "SN-1",
        name: "Falcon",
        model: "X1",
        adapterType: "SIMULATED",
        status: "ASSIGNED",
        homeHubId: null,
        batteryPercent: 90,
        batteryHealthPercent: 100,
        batteryCycles: 0,
        currentLat: null,
        currentLng: null,
        altitudeMeters: null,
        speedMps: null,
        headingDegrees: null,
        signalStrengthPercent: null,
        maxPayloadKg: 2.5,
        maxRangeKm: 10,
        maxSpeedMps: 15,
        maxAltitudeMeters: 120,
        isMaintenanceMode: false,
        maintenanceNote: null,
        lastTelemetryAt: null,
        totalFlightHours: 0,
        totalMissionsCompleted: 0,
        createdAt: new Date(),
      });

      const result = await service.assignIfAvailable("drone-1", "Assigned to mission mission-1");

      expect(prisma.drone.updateMany).toHaveBeenCalledWith({
        where: { id: "drone-1", status: "IDLE", isMaintenanceMode: false },
        data: { status: "ASSIGNED" },
      });
      expect(result.status).toBe("ASSIGNED");
      expect(eventEmitter.emit).toHaveBeenCalledWith("drone.status_changed", { droneId: "drone-1", fromStatus: "IDLE", toStatus: "ASSIGNED" });
    });

    it("throws ConflictException (never a silent no-op) when the compare-and-swap matches zero rows — the drone lost the race or is unavailable", async () => {
      prisma.drone.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.assignIfAvailable("drone-1", "note")).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.droneHealthLog.create).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("refuses to remove a drone that is currently flying", async () => {
      prisma.drone.findUnique.mockResolvedValueOnce({ id: "drone-1", status: "IN_FLIGHT" });
      await expect(service.remove("drone-1", actor)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("applyTelemetryUpdate", () => {
    it("writes a BatteryLog row and emits drone.battery_updated only when the battery level actually changed", async () => {
      prisma.drone.findUniqueOrThrow.mockResolvedValueOnce({ id: "drone-1", batteryPercent: 90, status: "IN_FLIGHT" });
      prisma.drone.update.mockResolvedValueOnce({ id: "drone-1", batteryPercent: 85 });

      await service.applyTelemetryUpdate("drone-1", { lat: 1, lng: 1, batteryPercent: 85 });

      expect(prisma.batteryLog.create).toHaveBeenCalledWith({ data: { droneId: "drone-1", batteryPercent: 85 } });
      expect(eventEmitter.emit).toHaveBeenCalledWith("drone.battery_updated", { droneId: "drone-1", batteryPercent: 85 });
      expect(eventEmitter.emit).toHaveBeenCalledWith("drone.location_updated", { droneId: "drone-1", lat: 1, lng: 1 });
    });

    it("skips the BatteryLog write when the battery level is unchanged", async () => {
      prisma.drone.findUniqueOrThrow.mockResolvedValueOnce({ id: "drone-1", batteryPercent: 85, status: "IN_FLIGHT" });
      prisma.drone.update.mockResolvedValueOnce({ id: "drone-1", batteryPercent: 85 });

      await service.applyTelemetryUpdate("drone-1", { lat: 1, lng: 1, batteryPercent: 85 });

      expect(prisma.batteryLog.create).not.toHaveBeenCalled();
    });
  });
});
