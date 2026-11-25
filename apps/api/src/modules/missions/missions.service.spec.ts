import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { EnvConfig } from "../../config/env.validation";
import type { DroneAdapter, DroneTelemetrySnapshot } from "../drones/adapters/drone-adapter.interface";
import { DronesService } from "../drones/drones.service";
import { DeliveryService } from "../delivery/delivery.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { TelemetryService } from "../telemetry/telemetry.service";
import type { GeofencingService } from "../geofencing/geofencing.service";
import type { WeatherService } from "../weather/weather.service";
import type { AiService } from "../ai/ai.service";
import { MissionsService } from "./missions.service";

const actor = { sub: "coordinator-1", email: "c@example.com", roles: ["delivery_coordinator"], permissions: ["missions.create", "missions.assign", "missions.update", "missions.override"] };

function baseMission(overrides: Record<string, unknown> = {}) {
  return {
    id: "mission-1",
    deliveryId: "delivery-1",
    droneId: "drone-1",
    operatorId: null,
    type: "DELIVERY",
    status: "DISPATCHED",
    safetyState: "NOMINAL",
    originLat: 44.9778,
    originLng: -93.265,
    destinationLat: 44.99,
    destinationLng: -93.25,
    rthTriggered: false,
    abortReason: null,
    plannedAt: new Date(),
    startedAt: new Date(),
    arrivedAt: null,
    completedAt: null,
    abortedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    waypoints: [
      { id: "wp-1", missionId: "mission-1", sequence: 1, lat: 44.98, lng: -93.26, altitudeMeters: 60, status: "PENDING", reachedAt: null },
      { id: "wp-2", missionId: "mission-1", sequence: 2, lat: 44.985, lng: -93.255, altitudeMeters: 60, status: "PENDING", reachedAt: null },
      { id: "wp-3", missionId: "mission-1", sequence: 3, lat: 44.99, lng: -93.25, altitudeMeters: 60, status: "PENDING", reachedAt: null },
    ],
    drone: { id: "drone-1", name: "Falcon One" },
    events: [],
    ...overrides,
  };
}

function baseTelemetry(overrides: Partial<DroneTelemetrySnapshot> = {}): DroneTelemetrySnapshot {
  return {
    droneId: "drone-1",
    lat: 44.981,
    lng: -93.258,
    altitudeMeters: 60,
    speedMps: 12,
    headingDegrees: 45,
    batteryPercent: 80,
    signalStrengthPercent: 95,
    emergency: false,
    timestamp: new Date(),
    ...overrides,
  };
}

describe("MissionsService", () => {
  let service: MissionsService;
  let prisma: {
    mission: { create: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    missionEvent: { create: jest.Mock };
    waypoint: { update: jest.Mock; updateMany: jest.Mock; createMany: jest.Mock };
    drone: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let deliveryService: {
    getDeliverySnapshotForMission: jest.Mock;
    markInTransit: jest.Mock;
    markDeliveredPendingVerification: jest.Mock;
    markReturnedToHubFromMission: jest.Mock;
    refineEstimatedDelivery: jest.Mock;
  };
  let dronesService: { getById: jest.Mock; getHubCoordinates: jest.Mock; setStatus: jest.Mock; assignIfAvailable: jest.Mock; ensureSimulatedAdapterRegistered: jest.Mock };
  let telemetryService: { ingest: jest.Mock };
  let geofencingService: { findRouteViolations: jest.Mock; findPointViolations: jest.Mock; checkServiceArea: jest.Mock };
  let weatherService: { getCurrentWeather: jest.Mock; evaluateSafety: jest.Mock; zoneKeyFor: jest.Mock };
  let aiService: {
    optimizeRoute: jest.Mock;
    rerouteAround: jest.Mock;
    predictEta: jest.Mock;
    assessRisk: jest.Mock;
    recommendDrones: jest.Mock;
    peekDroneRecommendations: jest.Mock;
    evaluateBatteryFeasibility: jest.Mock;
    getDecisionLogForMission: jest.Mock;
    getDecisionLogForDelivery: jest.Mock;
  };
  let droneAdapter: jest.Mocked<DroneAdapter>;

  beforeEach(() => {
    prisma = {
      mission: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      missionEvent: { create: jest.fn().mockResolvedValue({}) },
      waypoint: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
      drone: { findUniqueOrThrow: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    auditService = { log: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    deliveryService = {
      getDeliverySnapshotForMission: jest.fn(),
      markInTransit: jest.fn().mockResolvedValue(undefined),
      markDeliveredPendingVerification: jest.fn().mockResolvedValue(undefined),
      markReturnedToHubFromMission: jest.fn().mockResolvedValue(undefined),
      refineEstimatedDelivery: jest.fn().mockResolvedValue(undefined),
    };
    dronesService = {
      getById: jest.fn(),
      getHubCoordinates: jest.fn(),
      setStatus: jest.fn().mockResolvedValue(undefined),
      assignIfAvailable: jest.fn(),
      ensureSimulatedAdapterRegistered: jest.fn(),
    };
    telemetryService = { ingest: jest.fn().mockResolvedValue({}) };
    geofencingService = {
      findRouteViolations: jest.fn().mockResolvedValue([]),
      findPointViolations: jest.fn().mockResolvedValue([]),
      checkServiceArea: jest.fn().mockResolvedValue({ inServiceArea: true, zoneName: null, hasServiceAreaZones: false }),
    };
    weatherService = {
      getCurrentWeather: jest.fn().mockResolvedValue({ windSpeedMps: 3, precipitationMm: 0, condition: "CLEAR" }),
      evaluateSafety: jest.fn().mockReturnValue({ level: "SAFE", reasons: ["Conditions are within all safety thresholds"] }),
      zoneKeyFor: jest.fn((lat: number, lng: number) => `geo:${lat}:${lng}`),
    };
    aiService = {
      optimizeRoute: jest.fn().mockResolvedValue({
        selected: {
          id: "direct",
          isDirect: true,
          waypoints: [{ lat: 44.99, lng: -93.255, altitudeMeters: 60 }],
          distanceMeters: 1000,
          durationSeconds: 300,
          batteryFeasibility: { level: "SUFFICIENT", estimatedConsumptionPercent: 6.75, estimatedArrivalPercent: 93.25, reasons: [] },
          geofenceCleared: true,
          geofenceViolationZoneNames: [],
        },
        alternatives: [],
        reasons: ["Direct route selected — 1.00 km, no geofence conflicts"],
      }),
      rerouteAround: jest.fn().mockResolvedValue({ selected: null, alternatives: [], reasons: [] }),
      predictEta: jest.fn().mockResolvedValue({ etaAt: new Date(), durationSeconds: 300, confidence: "HIGH", factors: [], predictedAt: new Date() }),
      assessRisk: jest.fn().mockResolvedValue({ score: 10, level: "LOW", reasons: [] }),
      recommendDrones: jest.fn().mockResolvedValue([]),
      peekDroneRecommendations: jest.fn().mockResolvedValue([]),
      evaluateBatteryFeasibility: jest.fn().mockReturnValue({ level: "SUFFICIENT", estimatedConsumptionPercent: 6.75, estimatedArrivalPercent: 93.25, reasons: [] }),
      getDecisionLogForMission: jest.fn().mockResolvedValue([]),
      getDecisionLogForDelivery: jest.fn().mockResolvedValue([]),
    };
    droneAdapter = {
      connect: jest.fn().mockResolvedValue(undefined),
      arm: jest.fn().mockResolvedValue(undefined),
      takeoff: jest.fn().mockResolvedValue(undefined),
      gotoWaypoint: jest.fn().mockResolvedValue(undefined),
      returnToHome: jest.fn().mockResolvedValue(undefined),
      land: jest.fn().mockResolvedValue(undefined),
      emergencyStop: jest.fn().mockResolvedValue(undefined),
      getTelemetry: jest.fn(),
      subscribeTelemetry: jest.fn(),
    };

    service = new MissionsService(
      prisma as unknown as PrismaService,
      { get: (key: string) => (key === "DRONE_LOW_BATTERY_THRESHOLD_PERCENT" ? 20 : key === "DRONE_SIMULATION_AUTOPLAY" ? false : undefined) } as unknown as ConfigService<EnvConfig, true>,
      auditService as unknown as AuditService,
      eventEmitter as unknown as EventEmitter2,
      deliveryService as unknown as DeliveryService,
      dronesService as unknown as DronesService,
      telemetryService as unknown as TelemetryService,
      geofencingService as unknown as GeofencingService,
      weatherService as unknown as WeatherService,
      aiService as unknown as AiService,
      droneAdapter,
    );

    // getById() is called at the end of most mutating methods to build the response view.
    prisma.mission.findUnique.mockResolvedValue(baseMission());
  });

  describe("createForDelivery", () => {
    it("requires the delivery to already have a hub assigned", async () => {
      deliveryService.getDeliverySnapshotForMission.mockResolvedValueOnce({ deliveryId: "delivery-1", hubId: "hub-1", status: "PENDING_ASSIGNMENT" });
      await expect(service.createForDelivery({ deliveryId: "delivery-1" }, actor)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.mission.create).not.toHaveBeenCalled();
    });

    it("creates a mission with a straight-line route and emits mission.created", async () => {
      deliveryService.getDeliverySnapshotForMission.mockResolvedValueOnce({ deliveryId: "delivery-1", hubId: "hub-1", status: "HUB_ASSIGNED" });
      dronesService.getHubCoordinates.mockResolvedValueOnce({ lat: 44.9778, lng: -93.265 });
      prisma.mission.create.mockResolvedValueOnce({ id: "mission-1" });

      await service.createForDelivery({ deliveryId: "delivery-1" }, actor);

      expect(prisma.mission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryId: "delivery-1",
            waypoints: expect.objectContaining({ create: expect.arrayContaining([expect.objectContaining({ sequence: 1 })]) }),
          }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith("mission.created", { missionId: "mission-1", deliveryId: "delivery-1" });
    });

    it("rejects when the hub has no resolvable location", async () => {
      deliveryService.getDeliverySnapshotForMission.mockResolvedValueOnce({ deliveryId: "delivery-1", hubId: "hub-1", status: "HUB_ASSIGNED" });
      dronesService.getHubCoordinates.mockResolvedValueOnce(null);
      await expect(service.createForDelivery({ deliveryId: "delivery-1" }, actor)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("blocks mission creation outright when the planned route crosses a NO_FLY/RESTRICTED zone", async () => {
      deliveryService.getDeliverySnapshotForMission.mockResolvedValueOnce({ deliveryId: "delivery-1", hubId: "hub-1", status: "HUB_ASSIGNED" });
      dronesService.getHubCoordinates.mockResolvedValueOnce({ lat: 44.9778, lng: -93.265 });
      geofencingService.findRouteViolations.mockResolvedValueOnce([{ id: "geo-1", name: "Airport No-Fly", type: "NO_FLY" }]);

      await expect(service.createForDelivery({ deliveryId: "delivery-1" }, actor)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.mission.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith("geofence.violation", expect.objectContaining({ deliveryId: "delivery-1" }));
    });

    it("blocks mission creation when the destination falls outside every configured service area", async () => {
      deliveryService.getDeliverySnapshotForMission.mockResolvedValueOnce({ deliveryId: "delivery-1", hubId: "hub-1", status: "HUB_ASSIGNED" });
      dronesService.getHubCoordinates.mockResolvedValueOnce({ lat: 44.9778, lng: -93.265 });
      geofencingService.checkServiceArea.mockResolvedValueOnce({ inServiceArea: false, zoneName: null, hasServiceAreaZones: true });

      await expect(service.createForDelivery({ deliveryId: "delivery-1" }, actor)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.mission.create).not.toHaveBeenCalled();
    });

    it("creates the mission on WEATHER_HOLD (not blocked) when weather is unsafe at the origin", async () => {
      deliveryService.getDeliverySnapshotForMission.mockResolvedValueOnce({ deliveryId: "delivery-1", hubId: "hub-1", status: "HUB_ASSIGNED" });
      dronesService.getHubCoordinates.mockResolvedValueOnce({ lat: 44.9778, lng: -93.265 });
      prisma.mission.create.mockResolvedValueOnce({ id: "mission-1" });
      prisma.mission.findUniqueOrThrow.mockResolvedValueOnce(baseMission({ safetyState: "NOMINAL" }));
      weatherService.evaluateSafety.mockReturnValueOnce({ level: "UNSAFE", reasons: ["Wind speed 20.0 m/s exceeds the unsafe threshold (12 m/s)"] });

      await service.createForDelivery({ deliveryId: "delivery-1" }, actor);

      expect(prisma.mission.create).toHaveBeenCalled();
      expect(prisma.mission.update).toHaveBeenCalledWith({ where: { id: "mission-1" }, data: { safetyState: "WEATHER_HOLD" } });
      expect(eventEmitter.emit).toHaveBeenCalledWith("weather.unsafe", expect.objectContaining({ missionId: "mission-1" }));
      expect(eventEmitter.emit).toHaveBeenCalledWith("mission.safety_blocked", expect.objectContaining({ missionId: "mission-1", category: "WEATHER" }));
    });

    it("routes through the AI optimizer and emits route.optimized/eta.predicted/drone.recommended, refining the delivery's ETA", async () => {
      deliveryService.getDeliverySnapshotForMission.mockResolvedValueOnce({ deliveryId: "delivery-1", hubId: "hub-1", status: "HUB_ASSIGNED" });
      dronesService.getHubCoordinates.mockResolvedValueOnce({ lat: 44.9778, lng: -93.265 });
      prisma.mission.create.mockResolvedValueOnce({ id: "mission-1" });
      const etaAt = new Date("2026-09-04T13:00:00.000Z");
      aiService.predictEta.mockResolvedValueOnce({ etaAt, durationSeconds: 300, confidence: "HIGH", factors: ["Distance 1.00 km"], predictedAt: new Date() });
      aiService.recommendDrones.mockResolvedValueOnce([{ droneId: "drone-9", droneName: "Falcon Nine", score: 88, eligible: true, reasons: [] }]);

      await service.createForDelivery({ deliveryId: "delivery-1" }, actor);

      expect(aiService.optimizeRoute).toHaveBeenCalledWith(
        expect.objectContaining({ origin: { lat: 44.9778, lng: -93.265 } }),
        { deliveryId: "delivery-1" },
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith("route.optimized", expect.objectContaining({ missionId: "mission-1", deliveryId: "delivery-1" }));
      expect(deliveryService.refineEstimatedDelivery).toHaveBeenCalledWith("delivery-1", etaAt);
      expect(eventEmitter.emit).toHaveBeenCalledWith("eta.predicted", expect.objectContaining({ missionId: "mission-1", confidence: "HIGH" }));
      expect(eventEmitter.emit).toHaveBeenCalledWith("drone.recommended", expect.objectContaining({ missionId: "mission-1", droneId: "drone-9", score: 88 }));
    });

    it("blocks mission creation and emits route.rejected when the AI optimizer finds no feasible route", async () => {
      deliveryService.getDeliverySnapshotForMission.mockResolvedValueOnce({ deliveryId: "delivery-1", hubId: "hub-1", status: "HUB_ASSIGNED" });
      dronesService.getHubCoordinates.mockResolvedValueOnce({ lat: 44.9778, lng: -93.265 });
      aiService.optimizeRoute.mockResolvedValueOnce({
        selected: null,
        alternatives: [{ id: "direct", isDirect: true, waypoints: [], distanceMeters: 1000, durationSeconds: 300, batteryFeasibility: { level: "SUFFICIENT", estimatedConsumptionPercent: 0, estimatedArrivalPercent: 0, requiredReservePercent: 0, reasons: [] }, geofenceCleared: false, geofenceViolationZoneNames: ["Airport No-Fly"] }],
        reasons: ["No candidate route avoids the restricted/no-fly zone(s): Airport No-Fly"],
      });

      await expect(service.createForDelivery({ deliveryId: "delivery-1" }, actor)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.mission.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith("route.rejected", expect.objectContaining({ deliveryId: "delivery-1" }));
      expect(eventEmitter.emit).toHaveBeenCalledWith("geofence.violation", expect.objectContaining({ deliveryId: "delivery-1", zoneNames: ["Airport No-Fly"] }));
    });
  });

  describe("assignDrone", () => {
    it("rejects a drone that is not IDLE", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "PLANNED", droneId: null }));
      dronesService.getById.mockResolvedValueOnce({ id: "drone-2", name: "Falcon Two", status: "IN_FLIGHT", isMaintenanceMode: false });

      await expect(service.assignDrone("mission-1", { droneId: "drone-2" }, actor)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects assignment once the mission has moved past PLANNED", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "DISPATCHED" }));
      await expect(service.assignDrone("mission-1", { droneId: "drone-2" }, actor)).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects assignment when a concurrent request already claimed the drone (Phase 12 race fix)", async () => {
      // The precondition check (getById) can still see IDLE while a second,
      // concurrent caller's atomic compare-and-swap has already claimed the
      // drone — assignIfAvailable is the layer that must catch this, not
      // the earlier read.
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "PLANNED", droneId: null }));
      dronesService.getById.mockResolvedValueOnce({ id: "drone-2", name: "Falcon Two", status: "IDLE", isMaintenanceMode: false });
      dronesService.assignIfAvailable.mockRejectedValueOnce(new ConflictException("Drone is no longer available for assignment"));

      await expect(service.assignDrone("mission-1", { droneId: "drone-2" }, actor)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.mission.update).not.toHaveBeenCalled();
    });

    it("assesses and records risk once a real drone is known, leaving requiresApproval false for a LOW-risk pairing", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "PLANNED", droneId: null }));
      deliveryService.getDeliverySnapshotForMission.mockResolvedValueOnce({ deliveryId: "delivery-1", hubId: "hub-1", status: "HUB_ASSIGNED", priority: "STANDARD" });
      dronesService.getById.mockResolvedValue({ id: "drone-2", name: "Falcon Two", status: "IDLE", isMaintenanceMode: false, batteryPercent: 95, batteryHealthPercent: 98, maxRangeKm: 10 });
      dronesService.assignIfAvailable.mockResolvedValue({ id: "drone-2", name: "Falcon Two", status: "ASSIGNED", isMaintenanceMode: false, batteryPercent: 95, batteryHealthPercent: 98, maxRangeKm: 10 });
      aiService.assessRisk.mockResolvedValueOnce({ score: 12, level: "LOW", reasons: ["Weather conditions are safe"] });

      await service.assignDrone("mission-1", { droneId: "drone-2" }, actor);

      expect(aiService.assessRisk).toHaveBeenCalledWith(
        expect.objectContaining({ droneMaxRangeKm: 10, droneBatteryHealthPercent: 98 }),
        expect.objectContaining({ missionId: "mission-1" }),
      );
      expect(prisma.mission.update).toHaveBeenCalledWith({ where: { id: "mission-1" }, data: { riskScore: 12, riskLevel: "LOW", requiresApproval: false } });
      expect(eventEmitter.emit).toHaveBeenCalledWith("delivery.risk_assessed", expect.objectContaining({ missionId: "mission-1", level: "LOW", requiresApproval: false }));
    });

    it("sets requiresApproval when the computed risk level is HIGH", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "PLANNED", droneId: null }));
      deliveryService.getDeliverySnapshotForMission.mockResolvedValueOnce({ deliveryId: "delivery-1", hubId: "hub-1", status: "HUB_ASSIGNED", priority: "EXPRESS" });
      dronesService.getById.mockResolvedValue({ id: "drone-2", name: "Falcon Two", status: "IDLE", isMaintenanceMode: false, batteryPercent: 40, batteryHealthPercent: 60, maxRangeKm: 10 });
      dronesService.assignIfAvailable.mockResolvedValue({ id: "drone-2", name: "Falcon Two", status: "ASSIGNED", isMaintenanceMode: false, batteryPercent: 40, batteryHealthPercent: 60, maxRangeKm: 10 });
      aiService.assessRisk.mockResolvedValueOnce({ score: 82, level: "HIGH", reasons: ["Battery reserve is marginal for this route"] });

      await service.assignDrone("mission-1", { droneId: "drone-2" }, actor);

      expect(prisma.mission.update).toHaveBeenCalledWith({ where: { id: "mission-1" }, data: { riskScore: 82, riskLevel: "HIGH", requiresApproval: true } });
      expect(eventEmitter.emit).toHaveBeenCalledWith("delivery.risk_assessed", expect.objectContaining({ requiresApproval: true }));
    });
  });

  describe("start", () => {
    it("issues connect/arm/takeoff/gotoWaypoint to the drone adapter in order and dispatches", async () => {
      prisma.mission.findUnique
        .mockResolvedValueOnce(baseMission({ status: "PLANNED" })) // getMissionWithWaypointsOrThrow
        .mockResolvedValueOnce(baseMission({ status: "DISPATCHED" })); // getById after
      prisma.drone.findUniqueOrThrow.mockResolvedValueOnce({ id: "drone-1", adapterType: "SIMULATED" });

      await service.start("mission-1", actor);

      expect(droneAdapter.connect).toHaveBeenCalledWith("drone-1");
      expect(droneAdapter.arm).toHaveBeenCalledWith("drone-1");
      expect(droneAdapter.takeoff).toHaveBeenCalledWith("drone-1", 60);
      expect(droneAdapter.gotoWaypoint).toHaveBeenCalledWith("drone-1", { lat: 44.98, lng: -93.26, altitudeMeters: 60 });
      expect(dronesService.setStatus).toHaveBeenCalledWith("drone-1", "IN_FLIGHT", expect.any(String));
      expect(eventEmitter.emit).toHaveBeenCalledWith("mission.started", { missionId: "mission-1", deliveryId: "delivery-1" });
    });

    it("refuses to start a mission with no drone assigned", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "PLANNED", droneId: null }));
      await expect(service.start("mission-1", actor)).rejects.toBeInstanceOf(ConflictException);
    });

    it("refuses to dispatch — and never commands the drone — when weather is unsafe, however the endpoint is called", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "PLANNED" }));
      prisma.mission.findUniqueOrThrow.mockResolvedValueOnce(baseMission({ status: "PLANNED", safetyState: "NOMINAL" }));
      weatherService.evaluateSafety.mockReturnValueOnce({ level: "UNSAFE", reasons: ["Wind too high"] });

      await expect(service.start("mission-1", actor)).rejects.toBeInstanceOf(ConflictException);

      expect(droneAdapter.connect).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith("mission.safety_blocked", expect.objectContaining({ missionId: "mission-1", category: "WEATHER" }));
    });

    it("refuses to dispatch when the route crosses a geofence, without commanding the drone", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "PLANNED" }));
      prisma.mission.findUniqueOrThrow.mockResolvedValueOnce(baseMission({ status: "PLANNED", safetyState: "NOMINAL" }));
      geofencingService.findRouteViolations.mockResolvedValueOnce([{ id: "geo-1", name: "Restricted Zone", type: "RESTRICTED" }]);

      await expect(service.start("mission-1", actor)).rejects.toBeInstanceOf(ConflictException);
      expect(droneAdapter.connect).not.toHaveBeenCalled();
    });

    it("clears a prior WEATHER_HOLD and proceeds to dispatch once conditions are safe again", async () => {
      prisma.mission.findUnique
        .mockResolvedValueOnce(baseMission({ status: "PLANNED", safetyState: "WEATHER_HOLD" }))
        .mockResolvedValueOnce(baseMission({ status: "DISPATCHED" }));
      prisma.drone.findUniqueOrThrow.mockResolvedValueOnce({ id: "drone-1", adapterType: "SIMULATED" });

      await service.start("mission-1", actor);

      expect(eventEmitter.emit).toHaveBeenCalledWith("mission.safety_cleared", expect.objectContaining({ missionId: "mission-1" }));
      expect(droneAdapter.connect).toHaveBeenCalledWith("drone-1");
    });

    it("refuses to dispatch a HIGH-risk mission that has not been approved, without commanding the drone", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "PLANNED", riskLevel: "HIGH", riskScore: 82, requiresApproval: true, approvedAt: null }));

      await expect(service.start("mission-1", actor)).rejects.toBeInstanceOf(ConflictException);
      expect(droneAdapter.connect).not.toHaveBeenCalled();
      expect(geofencingService.findRouteViolations).not.toHaveBeenCalled();
    });

    it("dispatches a HIGH-risk mission once it has been approved", async () => {
      prisma.mission.findUnique
        .mockResolvedValueOnce(baseMission({ status: "PLANNED", riskLevel: "HIGH", riskScore: 82, requiresApproval: true, approvedAt: new Date(), approvedById: "coordinator-1" }))
        .mockResolvedValueOnce(baseMission({ status: "DISPATCHED" }));
      prisma.drone.findUniqueOrThrow.mockResolvedValueOnce({ id: "drone-1", adapterType: "SIMULATED" });

      await service.start("mission-1", actor);

      expect(droneAdapter.connect).toHaveBeenCalledWith("drone-1");
    });
  });

  describe("approve", () => {
    it("rejects approving a mission that does not require approval", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ requiresApproval: false }));
      await expect(service.approve("mission-1", actor)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.mission.update).not.toHaveBeenCalled();
    });

    it("rejects approving a mission that has already been approved", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ requiresApproval: true, approvedAt: new Date() }));
      await expect(service.approve("mission-1", actor)).rejects.toBeInstanceOf(ConflictException);
    });

    it("records the approver and timestamp, and audits the sign-off", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ requiresApproval: true, approvedAt: null, riskLevel: "HIGH", riskScore: 82 }));

      await service.approve("mission-1", actor);

      expect(prisma.mission.update).toHaveBeenCalledWith({
        where: { id: "mission-1" },
        data: { approvedById: actor.sub, approvedAt: expect.any(Date) },
      });
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: "mission.risk_approved", targetId: "mission-1" }));
    });
  });

  describe("progress", () => {
    it("moves DISPATCHED to IN_PROGRESS on the first tick and emits mission.progressed (DeliveryMissionEventsListener drives the delivery transition)", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "DISPATCHED" }));
      droneAdapter.getTelemetry.mockResolvedValueOnce(baseTelemetry());

      await service.progress("mission-1", actor);

      expect(prisma.mission.update).toHaveBeenCalledWith({ where: { id: "mission-1" }, data: { status: "IN_PROGRESS" } });
      expect(eventEmitter.emit).toHaveBeenCalledWith("mission.progressed", { missionId: "mission-1", deliveryId: "delivery-1" });
      expect(deliveryService.markInTransit).not.toHaveBeenCalled();
    });

    it("triggers return-to-home once battery drops to the low-battery threshold", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));
      droneAdapter.getTelemetry.mockResolvedValueOnce(baseTelemetry({ batteryPercent: 18 }));

      await service.progress("mission-1");

      expect(droneAdapter.returnToHome).toHaveBeenCalledWith("drone-1");
      expect(prisma.mission.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "RETURNING", rthTriggered: true }) }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith("drone.return_to_home", expect.objectContaining({ missionId: "mission-1" }));
    });

    it("triggers return-to-home when the drone's current position enters a no-fly/restricted zone", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));
      droneAdapter.getTelemetry.mockResolvedValueOnce(baseTelemetry());
      geofencingService.findPointViolations.mockResolvedValueOnce([{ id: "geo-1", name: "Restricted Zone", type: "RESTRICTED" }]);

      await service.progress("mission-1");

      expect(droneAdapter.returnToHome).toHaveBeenCalledWith("drone-1");
      expect(prisma.mission.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "RETURNING", safetyState: "GEOFENCE_BREACH" }) }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith("geofence.violation", expect.objectContaining({ missionId: "mission-1" }));
    });

    it("reroutes around a geofence breach instead of returning home when the AI optimizer finds a safe alternative", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));
      droneAdapter.getTelemetry.mockResolvedValueOnce(baseTelemetry());
      geofencingService.findPointViolations.mockResolvedValueOnce([{ id: "geo-1", name: "Restricted Zone", type: "RESTRICTED" }]);
      aiService.rerouteAround.mockResolvedValueOnce({
        selected: {
          id: "detour-a-0.01",
          isDirect: false,
          waypoints: [{ lat: 44.987, lng: -93.257, altitudeMeters: 60 }],
          distanceMeters: 900,
          durationSeconds: 250,
          batteryFeasibility: { level: "SUFFICIENT", estimatedConsumptionPercent: 5, estimatedArrivalPercent: 75, requiredReservePercent: 25, reasons: [] },
          geofenceCleared: true,
          geofenceViolationZoneNames: [],
        },
        alternatives: [],
        reasons: ["Rerouted around the restricted zone"],
      });

      await service.progress("mission-1");

      expect(droneAdapter.returnToHome).not.toHaveBeenCalled();
      expect(prisma.waypoint.updateMany).toHaveBeenCalledWith({ where: { missionId: "mission-1", status: "PENDING" }, data: { status: "SKIPPED" } });
      expect(prisma.waypoint.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ lat: 44.987, lng: -93.257 })]) }),
      );
      expect(droneAdapter.gotoWaypoint).toHaveBeenCalledWith("drone-1", { lat: 44.987, lng: -93.257, altitudeMeters: 60 });
      expect(eventEmitter.emit).toHaveBeenCalledWith("route.rerouted", expect.objectContaining({ missionId: "mission-1", routeId: "detour-a-0.01" }));
    });

    it("falls back to return-to-home when no safe reroute alternative exists", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));
      droneAdapter.getTelemetry.mockResolvedValueOnce(baseTelemetry());
      geofencingService.findPointViolations.mockResolvedValueOnce([{ id: "geo-1", name: "Restricted Zone", type: "RESTRICTED" }]);
      aiService.rerouteAround.mockResolvedValueOnce({ selected: null, alternatives: [], reasons: ["No safe alternative"] });

      await service.progress("mission-1");

      expect(droneAdapter.returnToHome).toHaveBeenCalledWith("drone-1");
      expect(prisma.waypoint.updateMany).not.toHaveBeenCalled();
    });

    it("never attempts a reroute for a weather escalation — falls straight to return-to-home", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));
      droneAdapter.getTelemetry.mockResolvedValueOnce(baseTelemetry());
      weatherService.evaluateSafety.mockReturnValueOnce({ level: "UNSAFE", reasons: ["Storm rolling in"] });

      await service.progress("mission-1");

      expect(aiService.rerouteAround).not.toHaveBeenCalled();
      expect(droneAdapter.returnToHome).toHaveBeenCalledWith("drone-1");
    });

    it("triggers return-to-home on in-flight weather escalation", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));
      droneAdapter.getTelemetry.mockResolvedValueOnce(baseTelemetry());
      weatherService.evaluateSafety.mockReturnValueOnce({ level: "UNSAFE", reasons: ["Storm rolling in"] });

      await service.progress("mission-1");

      expect(droneAdapter.returnToHome).toHaveBeenCalledWith("drone-1");
      expect(prisma.mission.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "RETURNING", safetyState: "WEATHER_HOLD" }) }),
      );
    });

    it("aborts the mission immediately on a simulated emergency", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));
      prisma.mission.findUniqueOrThrow.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));
      droneAdapter.getTelemetry.mockResolvedValueOnce(baseTelemetry({ emergency: true }));

      await service.progress("mission-1");

      expect(prisma.mission.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "ABORTED" }) }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith("mission.aborted", expect.objectContaining({ missionId: "mission-1" }));
      expect(deliveryService.markReturnedToHubFromMission).not.toHaveBeenCalled();
    });

    it("completes the mission once the drone reaches the final waypoint", async () => {
      const finalApproachMission = baseMission({
        status: "IN_PROGRESS",
        waypoints: [
          { id: "wp-1", missionId: "mission-1", sequence: 1, lat: 44.98, lng: -93.26, altitudeMeters: 60, status: "REACHED", reachedAt: new Date() },
          { id: "wp-2", missionId: "mission-1", sequence: 2, lat: 44.985, lng: -93.255, altitudeMeters: 60, status: "REACHED", reachedAt: new Date() },
          { id: "wp-3", missionId: "mission-1", sequence: 3, lat: 44.99, lng: -93.25, altitudeMeters: 60, status: "PENDING", reachedAt: null },
        ],
      });
      prisma.mission.findUnique.mockResolvedValueOnce(finalApproachMission);
      droneAdapter.getTelemetry.mockResolvedValueOnce(baseTelemetry({ lat: 44.99, lng: -93.25 }));

      await service.progress("mission-1");

      expect(droneAdapter.land).toHaveBeenCalledWith("drone-1");
      expect(prisma.mission.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith("mission.completed", { missionId: "mission-1", deliveryId: "delivery-1" });
      expect(deliveryService.markDeliveredPendingVerification).not.toHaveBeenCalled();
    });

    it("refuses to progress a mission that hasn't been dispatched", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "PLANNED" }));
      await expect(service.progress("mission-1")).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("override", () => {
    it("requires a mandatory reason (enforced at the DTO layer) and rejects an invalid action for the current status without writing any audit trail", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "COMPLETED" }));
      await expect(service.override("mission-1", { action: "ABORT", reason: "test" }, actor)).rejects.toBeInstanceOf(ConflictException);
      expect(auditService.log).not.toHaveBeenCalled();
      expect(prisma.missionEvent.create).not.toHaveBeenCalled();
    });

    it("aborts via emergencyStop and audits the operator override", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));
      prisma.mission.findUniqueOrThrow.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));

      await service.override("mission-1", { action: "ABORT", reason: "Operator judgment call" }, actor);

      expect(droneAdapter.emergencyStop).toHaveBeenCalledWith("drone-1");
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "mission.operator_override", metadata: { action: "ABORT", reason: "Operator judgment call" } }),
      );
    });

    it("triggers RTH on operator command", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ status: "IN_PROGRESS" }));

      await service.override("mission-1", { action: "RETURN_TO_HOME", reason: "Weather concern" }, actor);

      expect(droneAdapter.returnToHome).toHaveBeenCalledWith("drone-1");
    });

    it("rejects an override for a mission with no drone assigned", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(baseMission({ droneId: null }));
      await expect(service.override("mission-1", { action: "ABORT", reason: "test" }, actor)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("getById", () => {
    it("throws NotFoundException for an unknown mission", async () => {
      prisma.mission.findUnique.mockResolvedValueOnce(null);
      await expect(service.getById("missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
