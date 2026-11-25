import type { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import type { MissionsService } from "../missions/missions.service";
import type { OpsGateway } from "./ops.gateway";
import { RealtimeBroadcasterService } from "./realtime-broadcaster.service";
import type { TrackingGateway } from "./tracking.gateway";

function fakeServer() {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  return { server: { to } as unknown, to, emit };
}

describe("RealtimeBroadcasterService", () => {
  let ops: ReturnType<typeof fakeServer>;
  let tracking: ReturnType<typeof fakeServer>;
  let missionsService: { findActiveMissionByDroneId: jest.Mock };
  let broadcaster: RealtimeBroadcasterService;

  beforeEach(() => {
    jest.useFakeTimers();
    ops = fakeServer();
    tracking = fakeServer();
    missionsService = { findActiveMissionByDroneId: jest.fn().mockResolvedValue(null) };
    const configService = { get: jest.fn().mockReturnValue(500) } as unknown as ConfigService<EnvConfig, true>;

    broadcaster = new RealtimeBroadcasterService(
      { server: tracking.server } as unknown as TrackingGateway,
      { server: ops.server } as unknown as OpsGateway,
      missionsService as unknown as MissionsService,
      configService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("relays drone.created to the ops:fleet room only", () => {
    broadcaster.onDroneCreated({ droneId: "d1" });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(ops.emit).toHaveBeenCalledWith("event", expect.objectContaining({ type: "drone.created", data: { droneId: "d1" } }));
    expect(tracking.to).not.toHaveBeenCalled();
  });

  it("relays drone.status_changed to ops:fleet and the drone room, and skips the customer room when the drone has no active mission", async () => {
    await broadcaster.onDroneStatusChanged({ droneId: "d1", fromStatus: "IDLE", toStatus: "ASSIGNED" });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(ops.to).toHaveBeenCalledWith("drone:d1");
    expect(tracking.to).not.toHaveBeenCalled();
  });

  it("also forwards drone.status_changed to the customer's delivery room when the drone is actively flying a mission", async () => {
    missionsService.findActiveMissionByDroneId.mockResolvedValue({ missionId: "m1", deliveryId: "del1" });

    await broadcaster.onDroneStatusChanged({ droneId: "d1", fromStatus: "ASSIGNED", toStatus: "IN_FLIGHT" });

    expect(tracking.to).toHaveBeenCalledWith("delivery:del1");
  });

  it("coalesces rapid drone.location_updated events for the same drone into one broadcast per window", () => {
    broadcaster.onDroneLocationUpdated({ droneId: "d1", lat: 1, lng: 1 });
    broadcaster.onDroneLocationUpdated({ droneId: "d1", lat: 2, lng: 2 });
    broadcaster.onDroneLocationUpdated({ droneId: "d1", lat: 3, lng: 3 });

    // Leading call fires immediately, broadcast to both ops:fleet and drone:d1 (2 emits, no active mission).
    expect(ops.emit).toHaveBeenCalledTimes(2);
    expect(ops.emit).toHaveBeenCalledWith("event", expect.objectContaining({ data: { droneId: "d1", lat: 1, lng: 1 } }));

    jest.advanceTimersByTime(500);

    // Trailing call carries the latest coordinates, not every intermediate update — one more 2-room broadcast, not three.
    expect(ops.emit).toHaveBeenCalledTimes(4);
    expect(ops.emit).toHaveBeenLastCalledWith("event", expect.objectContaining({ data: { droneId: "d1", lat: 3, lng: 3 } }));
  });

  it("relays mission lifecycle events to both the ops mission room and the customer's delivery room", () => {
    broadcaster.onMissionStarted({ missionId: "m1", deliveryId: "del1" });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(ops.to).toHaveBeenCalledWith("mission:m1");
    expect(tracking.to).toHaveBeenCalledWith("delivery:del1");
  });

  it("relays drone.return_to_home as a safety event to ops and the customer's delivery room", () => {
    broadcaster.onDroneReturnToHome({ missionId: "m1", deliveryId: "del1", droneId: "d1", reason: "Low battery (15%)" });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(ops.to).toHaveBeenCalledWith("mission:m1");
    expect(ops.to).toHaveBeenCalledWith("drone:d1");
    expect(tracking.to).toHaveBeenCalledWith("delivery:del1");
  });

  it("relays delivery.status_changed only to the customer's delivery room, never to ops", () => {
    broadcaster.onDeliveryStatusChanged({ deliveryId: "del1", fromStatus: "HUB_ASSIGNED", toStatus: "MISSION_PLANNED", note: null });

    expect(tracking.to).toHaveBeenCalledWith("delivery:del1");
    expect(ops.to).not.toHaveBeenCalled();
  });

  it("relays weather.warning and weather.unsafe to ops only, never to the customer tracking room", () => {
    broadcaster.onWeatherWarning({ missionId: "m1", deliveryId: "del1", reasons: ["Wind speed 9.0 m/s exceeds the caution threshold"] });
    broadcaster.onWeatherUnsafe({ missionId: "m1", deliveryId: "del1", reasons: ["Wind speed 15.0 m/s exceeds the unsafe threshold"] });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(ops.to).toHaveBeenCalledWith("mission:m1");
    expect(tracking.to).not.toHaveBeenCalled();
  });

  it("relays geofence.violation to ops only, never to the customer tracking room", () => {
    broadcaster.onGeofenceViolation({ missionId: "m1", deliveryId: "del1", zoneNames: ["Airport No-Fly"] });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(ops.to).toHaveBeenCalledWith("mission:m1");
    expect(tracking.to).not.toHaveBeenCalled();
  });

  it("relays mission.safety_blocked to ops with the full reason and to tracking with a sanitized customer-safe message only", () => {
    broadcaster.onMissionSafetyBlocked({ missionId: "m1", deliveryId: "del1", category: "WEATHER", reason: "Wind speed 15.0 m/s exceeds the unsafe threshold (12 m/s)" });

    expect(ops.emit).toHaveBeenCalledWith(
      "event",
      expect.objectContaining({ type: "mission.safety_blocked", data: expect.objectContaining({ reason: expect.stringContaining("Wind speed") }) }),
    );
    expect(tracking.emit).toHaveBeenCalledWith(
      "event",
      expect.objectContaining({
        type: "mission.safety_blocked",
        data: { deliveryId: "del1", category: "WEATHER", message: expect.any(String) },
      }),
    );
    const trackingCall = tracking.emit.mock.calls.find((call) => call[1]?.type === "mission.safety_blocked");
    expect(trackingCall?.[1]?.data.message).not.toMatch(/Wind speed/);
    expect(trackingCall?.[1]?.data.message).not.toMatch(/m\/s/);
  });

  it("relays mission.safety_cleared to both rooms with only ids, no internal detail", () => {
    broadcaster.onMissionSafetyCleared({ missionId: "m1", deliveryId: "del1" });

    expect(ops.to).toHaveBeenCalledWith("mission:m1");
    expect(tracking.to).toHaveBeenCalledWith("delivery:del1");
  });

  it("relays route.optimized to ops only, never to the customer tracking room", () => {
    broadcaster.onRouteOptimized({ missionId: "m1", deliveryId: "del1", routeId: "direct", distanceMeters: 1000, alternativesConsidered: 4 });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(ops.to).toHaveBeenCalledWith("mission:m1");
    expect(tracking.to).not.toHaveBeenCalled();
  });

  it("relays route.rejected to ops only, without a mission room (no mission exists yet)", () => {
    broadcaster.onRouteRejected({ deliveryId: "del1", reasons: ["No candidate route avoids the restricted/no-fly zone(s): Airport No-Fly"] });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(tracking.to).not.toHaveBeenCalled();
  });

  it("relays route.rerouted to ops only, never to the customer tracking room", () => {
    broadcaster.onRouteRerouted({ missionId: "m1", deliveryId: "del1", routeId: "detour-a-0.01", distanceMeters: 900, reason: "Geofence breach: entered Restricted Zone" });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(ops.to).toHaveBeenCalledWith("mission:m1");
    expect(tracking.to).not.toHaveBeenCalled();
  });

  it("relays eta.predicted to ops with full detail and to tracking with only deliveryId/etaAt, never confidence/factors", () => {
    broadcaster.onEtaPredicted({ missionId: "m1", deliveryId: "del1", etaAt: "2026-09-04T13:00:00.000Z", confidence: "HIGH", factors: ["Distance 1.00 km"] });

    expect(ops.emit).toHaveBeenCalledWith(
      "event",
      expect.objectContaining({ type: "eta.predicted", data: expect.objectContaining({ confidence: "HIGH", factors: ["Distance 1.00 km"] }) }),
    );
    expect(tracking.emit).toHaveBeenCalledWith(
      "event",
      expect.objectContaining({ type: "eta.predicted", data: { deliveryId: "del1", etaAt: "2026-09-04T13:00:00.000Z" } }),
    );
    const trackingCall = tracking.emit.mock.calls.find((call) => call[1]?.type === "eta.predicted");
    expect(trackingCall?.[1]?.data.confidence).toBeUndefined();
    expect(trackingCall?.[1]?.data.factors).toBeUndefined();
  });

  it("relays delivery.risk_assessed to ops only, never to the customer tracking room", () => {
    broadcaster.onDeliveryRiskAssessed({ missionId: "m1", deliveryId: "del1", score: 82, level: "HIGH", requiresApproval: true, reasons: ["Battery reserve is marginal for this route"] });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(ops.to).toHaveBeenCalledWith("mission:m1");
    expect(tracking.to).not.toHaveBeenCalled();
  });

  it("relays drone.recommended to ops only, never to the customer tracking room", () => {
    broadcaster.onDroneRecommended({ missionId: "m1", deliveryId: "del1", droneId: "d1", droneName: "Falcon One", score: 88 });

    expect(ops.to).toHaveBeenCalledWith("ops:fleet");
    expect(ops.to).toHaveBeenCalledWith("mission:m1");
    expect(tracking.to).not.toHaveBeenCalled();
  });

  it("does not throw when a gateway's server is not yet attached (module still initializing)", () => {
    const broadcasterWithoutServers = new RealtimeBroadcasterService(
      { server: undefined } as unknown as TrackingGateway,
      { server: undefined } as unknown as OpsGateway,
      missionsService as unknown as MissionsService,
      { get: jest.fn().mockReturnValue(500) } as unknown as ConfigService<EnvConfig, true>,
    );

    expect(() => broadcasterWithoutServers.onDroneCreated({ droneId: "d1" })).not.toThrow();
  });
});
