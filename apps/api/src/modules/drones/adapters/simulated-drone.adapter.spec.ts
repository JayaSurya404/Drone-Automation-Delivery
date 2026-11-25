import { SimulatedDroneAdapter } from "./simulated-drone.adapter";

describe("SimulatedDroneAdapter fault injection", () => {
  let adapter: SimulatedDroneAdapter;
  const droneId = "fault-drone-1";

  beforeEach(() => {
    adapter = new SimulatedDroneAdapter();
    adapter.registerDrone(droneId, { lat: 44.9778, lng: -93.265, batteryPercent: 100, homeLat: 44.9778, homeLng: -93.265 });
  });

  it("forces battery down to a low level on the next telemetry read", async () => {
    await adapter.connect(droneId);
    await adapter.arm(droneId);
    await adapter.takeoff(droneId, 60);
    await adapter.gotoWaypoint(droneId, { lat: 45.5, lng: -92.5, altitudeMeters: 60 });

    adapter.injectFault(droneId, "LOW_BATTERY");
    const telemetry = await adapter.getTelemetry(droneId);

    expect(telemetry.batteryPercent).toBeLessThanOrEqual(15);
  });

  it("reports zero signal strength for exactly one step after a signal-loss fault", async () => {
    await adapter.connect(droneId);
    adapter.injectFault(droneId, "SIGNAL_LOSS");
    const duringFault = await adapter.getTelemetry(droneId);
    const afterFault = await adapter.getTelemetry(droneId);

    expect(duringFault.signalStrengthPercent).toBe(0);
    expect(afterFault.signalStrengthPercent).toBeGreaterThan(0);
  });

  it("enters an unrecoverable emergency state on a crash fault and stops moving", async () => {
    await adapter.connect(droneId);
    await adapter.arm(droneId);
    await adapter.takeoff(droneId, 60);
    await adapter.gotoWaypoint(droneId, { lat: 45.5, lng: -92.5, altitudeMeters: 60 });
    await adapter.getTelemetry(droneId);

    adapter.injectFault(droneId, "CRASH");
    const crashed = await adapter.getTelemetry(droneId);
    const positionAtCrash = { lat: crashed.lat, lng: crashed.lng };

    expect(crashed.emergency).toBe(true);

    const after = await adapter.getTelemetry(droneId);
    expect(after.lat).toBeCloseTo(positionAtCrash.lat, 6);
    expect(after.lng).toBeCloseTo(positionAtCrash.lng, 6);
    expect(after.emergency).toBe(true);
  });

  it("throws if a command targets a drone that was never registered", async () => {
    await expect(adapter.connect("unknown-drone")).rejects.toThrow(/not registered/);
  });
});
