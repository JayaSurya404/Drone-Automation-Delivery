import type { DroneAdapter } from "./drone-adapter.interface";
import { SimulatedDroneAdapter } from "./simulated-drone.adapter";

/**
 * Shared contract test suite for any `DroneAdapter` implementation — per the
 * phase-06 prompt: "this same suite must later pass unchanged against
 * `MavlinkDroneAdapter`." Only exercises the 9 interface methods, never
 * `SimulatedDroneAdapter`-only extensions (`registerDrone`/`injectFault`),
 * so it stays implementation-agnostic.
 */
function runDroneAdapterContractTests(
  name: string,
  createAdapter: () => { adapter: DroneAdapter; droneId: string },
) {
  describe(`DroneAdapter contract — ${name}`, () => {
    it("connects without throwing", async () => {
      const { adapter, droneId } = createAdapter();
      await expect(adapter.connect(droneId)).resolves.toBeUndefined();
    });

    it("arms without throwing", async () => {
      const { adapter, droneId } = createAdapter();
      await adapter.connect(droneId);
      await expect(adapter.arm(droneId)).resolves.toBeUndefined();
    });

    it("takes off to the requested altitude", async () => {
      const { adapter, droneId } = createAdapter();
      await adapter.connect(droneId);
      await adapter.arm(droneId);
      await adapter.takeoff(droneId, 60);
      const telemetry = await adapter.getTelemetry(droneId);
      expect(telemetry.altitudeMeters).toBe(60);
    });

    it("moves toward a waypoint over successive telemetry reads", async () => {
      const { adapter, droneId } = createAdapter();
      await adapter.connect(droneId);
      await adapter.arm(droneId);
      await adapter.takeoff(droneId, 60);
      const before = await adapter.getTelemetry(droneId);

      await adapter.gotoWaypoint(droneId, { lat: before.lat + 0.05, lng: before.lng + 0.05, altitudeMeters: 60 });
      const after = await adapter.getTelemetry(droneId);

      const distanceBefore = Math.hypot(before.lat + 0.05 - before.lat, before.lng + 0.05 - before.lng);
      const distanceAfter = Math.hypot(before.lat + 0.05 - after.lat, before.lng + 0.05 - after.lng);
      expect(distanceAfter).toBeLessThan(distanceBefore);
    });

    it("drains battery while moving", async () => {
      const { adapter, droneId } = createAdapter();
      await adapter.connect(droneId);
      await adapter.arm(droneId);
      await adapter.takeoff(droneId, 60);
      const before = await adapter.getTelemetry(droneId);

      await adapter.gotoWaypoint(droneId, { lat: before.lat + 0.05, lng: before.lng, altitudeMeters: 60 });
      const after = await adapter.getTelemetry(droneId);

      expect(after.batteryPercent).toBeLessThan(before.batteryPercent);
    });

    it("returns to home when commanded", async () => {
      const { adapter, droneId } = createAdapter();
      await adapter.connect(droneId);
      await adapter.arm(droneId);
      await adapter.takeoff(droneId, 60);
      await adapter.gotoWaypoint(droneId, { lat: 99, lng: 99, altitudeMeters: 60 });
      await adapter.getTelemetry(droneId);

      await expect(adapter.returnToHome(droneId)).resolves.toBeUndefined();
    });

    it("lands, zeroing altitude", async () => {
      const { adapter, droneId } = createAdapter();
      await adapter.connect(droneId);
      await adapter.arm(droneId);
      await adapter.takeoff(droneId, 60);
      await adapter.land(droneId);
      const telemetry = await adapter.getTelemetry(droneId);
      expect(telemetry.altitudeMeters).toBe(0);
    });

    it("stops responding to movement commands after an emergency stop", async () => {
      const { adapter, droneId } = createAdapter();
      await adapter.connect(droneId);
      await adapter.arm(droneId);
      await adapter.takeoff(droneId, 60);
      const before = await adapter.getTelemetry(droneId);

      await adapter.emergencyStop(droneId);
      await adapter.gotoWaypoint(droneId, { lat: before.lat + 1, lng: before.lng + 1, altitudeMeters: 60 });
      const after = await adapter.getTelemetry(droneId);

      expect(after.lat).toBeCloseTo(before.lat, 5);
      expect(after.lng).toBeCloseTo(before.lng, 5);
    });

    it("notifies telemetry subscribers on every getTelemetry call", async () => {
      const { adapter, droneId } = createAdapter();
      await adapter.connect(droneId);
      const received: number[] = [];
      const unsubscribe = adapter.subscribeTelemetry(droneId, (t) => received.push(t.batteryPercent));

      await adapter.getTelemetry(droneId);
      await adapter.getTelemetry(droneId);
      expect(received).toHaveLength(2);

      unsubscribe();
      await adapter.getTelemetry(droneId);
      expect(received).toHaveLength(2);
    });
  });
}

runDroneAdapterContractTests("SimulatedDroneAdapter", () => {
  const adapter = new SimulatedDroneAdapter();
  const droneId = "contract-drone-1";
  adapter.registerDrone(droneId, { lat: 44.9778, lng: -93.265, batteryPercent: 100, homeLat: 44.9778, homeLng: -93.265 });
  return { adapter, droneId };
});

// MavlinkDroneAdapter is intentionally excluded — every method throws
// NotImplementedException by design (see mavlink-drone.adapter.ts), so
// running this behavioral suite against it would only assert "throws",
// which mavlink-drone.adapter.spec.ts already covers directly. Re-run this
// exact suite against MavlinkDroneAdapter once it has a real implementation.
