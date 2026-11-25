import { Test, type TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { TelemetryService } from "./telemetry.service";
import { GazeboBridgeService } from "./gazebo-bridge.service";

describe("GazeboBridgeService", () => {
  let service: GazeboBridgeService;
  let prisma: { drone: { findFirst: jest.Mock } };
  let telemetryService: { ingest: jest.Mock };

  beforeEach(() => {
    prisma = { drone: { findFirst: jest.fn() } };
    telemetryService = { ingest: jest.fn() };
  });

  it("is disabled by default when GAZEBO_BRIDGE_ENABLED is unset", async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GazeboBridgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: TelemetryService, useValue: telemetryService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "NODE_ENV") return "development";
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GazeboBridgeService>(GazeboBridgeService);
    // Should not start interval or execute poll
    expect(service["isEnabled"]).toBe(false);
  });

  it("is forced off in production environment even if GAZEBO_BRIDGE_ENABLED=true", async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GazeboBridgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: TelemetryService, useValue: telemetryService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "NODE_ENV") return "production";
              if (key === "GAZEBO_BRIDGE_ENABLED") return "true";
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GazeboBridgeService>(GazeboBridgeService);
    expect(service["isEnabled"]).toBe(false);
  });

  it("authenticates bridge calls with x-service-key and uses configured drone id", async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GazeboBridgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: TelemetryService, useValue: telemetryService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "NODE_ENV") return "development";
              if (key === "GAZEBO_BRIDGE_ENABLED") return "true";
              if (key === "SKYNAV_INTERNAL_SERVICE_KEY") return "test-service-key-12345";
              if (key === "GAZEBO_DRONE_ID") return "DRONE-CUSTOM-007";
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GazeboBridgeService>(GazeboBridgeService);
    expect(service["isEnabled"]).toBe(true);

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        isNativeGazeboRunning: true,
        simulationMode: "REAL_GAZEBO_MODE",
        latitude: 11.1132,
        longitude: 77.0277,
        altitudeAgl: 45,
        speedKmh: 50,
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    prisma.drone.findFirst.mockResolvedValue({ id: "drone-uuid-007" });

    await service.pollGazebo();

    // Verify service key in header
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/telemetry"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-service-key": "test-service-key-12345",
        }),
      }),
    );

    // Verify configured drone identifier queried
    expect(prisma.drone.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { id: "DRONE-CUSTOM-007" },
          { name: "DRONE-CUSTOM-007" },
          { serialNumber: "DRONE-CUSTOM-007" },
        ],
      },
    });

    expect(telemetryService.ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        droneId: "drone-uuid-007",
      }),
    );
  });
});
