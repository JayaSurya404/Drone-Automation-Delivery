import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DronesService } from "../drones/drones.service";
import { TelemetryService } from "./telemetry.service";

describe("TelemetryService", () => {
  let service: TelemetryService;
  let prisma: { drone: { findUnique: jest.Mock }; telemetrySample: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock } };
  let dronesService: { applyTelemetryUpdate: jest.Mock };

  beforeEach(() => {
    prisma = {
      drone: { findUnique: jest.fn() },
      telemetrySample: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    };
    dronesService = { applyTelemetryUpdate: jest.fn().mockResolvedValue({}) };
    service = new TelemetryService(prisma as unknown as PrismaService, dronesService as unknown as DronesService);
  });

  it("rejects telemetry for an unknown drone", async () => {
    prisma.drone.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.ingest({ droneId: "missing", lat: 1, lng: 1, batteryPercent: 90 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dronesService.applyTelemetryUpdate).not.toHaveBeenCalled();
  });

  it("updates the drone and writes a telemetry sample for a known drone", async () => {
    prisma.drone.findUnique.mockResolvedValueOnce({ id: "drone-1" });
    prisma.telemetrySample.create.mockResolvedValueOnce({
      id: "sample-1",
      droneId: "drone-1",
      missionId: null,
      lat: 1,
      lng: 2,
      altitudeMeters: 60,
      speedMps: 12,
      headingDegrees: 90,
      batteryPercent: 88,
      signalStrengthPercent: 95,
      recordedAt: new Date(),
    });

    const result = await service.ingest({ droneId: "drone-1", lat: 1, lng: 2, altitudeMeters: 60, speedMps: 12, headingDegrees: 90, batteryPercent: 88, signalStrengthPercent: 95 });

    expect(dronesService.applyTelemetryUpdate).toHaveBeenCalledWith("drone-1", expect.objectContaining({ batteryPercent: 88 }));
    expect(result.batteryPercent).toBe(88);
  });
});
