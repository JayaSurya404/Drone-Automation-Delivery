import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FleetSimulator } from "../fleet.js";
import type { MissionPlan, SimulatedTelemetry } from "../types.js";

describe("Simulator / Multi-Drone Fleet Manager & Lifecycle", () => {
  const warehouse = { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 };
  const dest1 = { latitude: 37.7780, longitude: -122.4194, altitudeMeters: 50 };
  const dest2 = { latitude: 37.7749, longitude: -122.4150, altitudeMeters: 50 };

  const mission1: MissionPlan = {
    missionId: "11111111-1111-1111-1111-111111111111",
    organizationId: "00000000-0000-0000-0000-000000000001",
    droneId: "SKY-001",
    origin: warehouse,
    destination: dest1,
    waypoints: [{ id: "m1-wp1", sequence: 1, position: dest1, targetSpeedMetersPerSecond: 15, targetAltitudeMeters: 50 }]
  };

  const mission2: MissionPlan = {
    missionId: "22222222-2222-2222-2222-222222222222",
    organizationId: "00000000-0000-0000-0000-000000000001",
    droneId: "SKY-002",
    origin: warehouse,
    destination: dest2,
    waypoints: [{ id: "m2-wp1", sequence: 1, position: dest2, targetSpeedMetersPerSecond: 20, targetAltitudeMeters: 50 }]
  };

  it("registers and manages multiple distinct drones independently", () => {
    const fleet = new FleetSimulator();
    const d1 = fleet.registerDrone("SKY-001", "00000000-0000-0000-0000-000000000001", warehouse);
    const d2 = fleet.registerDrone("SKY-002", "00000000-0000-0000-0000-000000000001", warehouse);
    const d3 = fleet.registerDrone("SKY-003", "00000000-0000-0000-0000-000000000001", warehouse);

    assert.equal(fleet.getAllDrones().length, 3);
    assert.equal(fleet.getDrone("SKY-001")?.id, "SKY-001");
    assert.equal(fleet.getDrone("SKY-002")?.id, "SKY-002");
    assert.equal(fleet.getDrone("SKY-003")?.id, "SKY-003");

    // Assign mission to SKY-001 only
    fleet.assignMission(mission1);
    assert.equal(d1.state, "ASSIGNED");
    // SKY-002 and SKY-003 remain IDLE
    assert.equal(d2.state, "IDLE");
    assert.equal(d3.state, "IDLE");
  });

  it("advances all drones in lockstep via deterministic clock ticks", () => {
    const fleet = new FleetSimulator({ climbRateMetersPerSecond: 10.0 });
    fleet.registerDrone("SKY-001", "00000000-0000-0000-0000-000000000001", warehouse);
    fleet.registerDrone("SKY-002", "00000000-0000-0000-0000-000000000001", warehouse);

    fleet.assignMission(mission1);
    fleet.assignMission(mission2);

    fleet.startMission("SKY-001");
    fleet.startMission("SKY-002");

    assert.equal(fleet.getDrone("SKY-001")?.state, "TAKEOFF");
    assert.equal(fleet.getDrone("SKY-002")?.state, "TAKEOFF");

    // Advance 5 seconds (5s * 10m/s = 50m altitude -> EN_ROUTE)
    fleet.tick(5);

    assert.equal(fleet.getDrone("SKY-001")?.state, "EN_ROUTE");
    assert.equal(fleet.getDrone("SKY-002")?.state, "EN_ROUTE");

    // Advance 10 seconds -> drones fly along their distinct trajectories
    fleet.tick(10);

    const d1Pos = fleet.getDrone("SKY-001")?.kinematics.position;
    const d2Pos = fleet.getDrone("SKY-002")?.kinematics.position;

    // D1 flew North (higher latitude), D2 flew East (higher longitude)
    assert.ok(d1Pos && d1Pos.latitude > warehouse.latitude);
    assert.ok(d2Pos && d2Pos.longitude > warehouse.longitude);
  });

  it("supports fleet pause, resume, and reset lifecycle", () => {
    const fleet = new FleetSimulator({ climbRateMetersPerSecond: 10.0 });
    fleet.assignMission(mission1);
    fleet.startMission("SKY-001");

    fleet.tick(2); // Climb to 20m
    assert.equal(fleet.getDrone("SKY-001")?.kinematics.position.altitudeMeters, 20);

    fleet.pause();
    assert.equal(fleet.isPaused, true);

    // Ticks while paused have no effect
    fleet.tick(5);
    assert.equal(fleet.getDrone("SKY-001")?.kinematics.position.altitudeMeters, 20);

    fleet.resume();
    assert.equal(fleet.isPaused, false);

    fleet.tick(3); // Climb to 50m -> EN_ROUTE
    assert.equal(fleet.getDrone("SKY-001")?.kinematics.position.altitudeMeters, 50);

    fleet.reset();
    assert.equal(fleet.getDrone("SKY-001")?.state, "IDLE");
    assert.equal(fleet.getDrone("SKY-001")?.kinematics.position.altitudeMeters, 0);
  });

  it("aggregates fleet-wide telemetry frames", () => {
    const fleet = new FleetSimulator();
    fleet.assignMission(mission1);
    fleet.assignMission(mission2);

    const collectedTelemetry: SimulatedTelemetry[] = [];
    fleet.onTelemetry((t) => collectedTelemetry.push(t));

    fleet.tick(1);

    const drone1Frames = collectedTelemetry.filter((t) => t.droneId === "SKY-001");
    const drone2Frames = collectedTelemetry.filter((t) => t.droneId === "SKY-002");

    assert.ok(drone1Frames.length >= 1);
    assert.ok(drone2Frames.length >= 1);
  });
});
