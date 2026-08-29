import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { telemetrySchema } from "@skynav/contracts";
import { SimulatedDrone } from "../drone.js";
import type { MissionPlan, DroneEvent, SimulatedTelemetry } from "../types.js";

describe("Simulator / Drone Navigation, Battery & Mission Execution", () => {
  const origin = { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 0 };
  const wp1 = { latitude: 37.7760, longitude: -122.4194, altitudeMeters: 50 }; // ~122m North
  const destination = { latitude: 37.7770, longitude: -122.4194, altitudeMeters: 50 }; // ~233m North

  const sampleMission: MissionPlan = {
    missionId: "99999999-9999-9999-9999-999999999999",
    organizationId: "00000000-0000-0000-0000-000000000001",
    droneId: "00000000-0000-0000-0000-000000000011",
    origin,
    destination,
    waypoints: [
      { id: "wp-1", sequence: 1, position: wp1, targetSpeedMetersPerSecond: 20, targetAltitudeMeters: 50 },
      { id: "wp-2", sequence: 2, position: destination, targetSpeedMetersPerSecond: 20, targetAltitudeMeters: 50 }
    ],
    deliveryHoldDurationSeconds: 2
  };

  it("initializes drone with default IDLE state and 100% battery", () => {
    const drone = new SimulatedDrone("00000000-0000-0000-0000-000000000011", "00000000-0000-0000-0000-000000000001", origin);
    assert.equal(drone.id, "00000000-0000-0000-0000-000000000011");
    assert.equal(drone.state, "IDLE");
    assert.equal(drone.battery.percent, 100);
    assert.equal(drone.kinematics.position.altitudeMeters, 0);
    assert.equal(drone.kinematics.speedMetersPerSecond, 0);
  });

  it("advances takeoff climb until reaching target cruise altitude", () => {
    const drone = new SimulatedDrone("00000000-0000-0000-0000-000000000011", "00000000-0000-0000-0000-000000000001", origin, {
      climbRateMetersPerSecond: 5.0
    });

    drone.assignMission(sampleMission);
    assert.equal(drone.state, "ASSIGNED");

    drone.startMission();
    assert.equal(drone.state, "TAKEOFF");

    // Tick 5 seconds: 5s * 5m/s = 25m altitude
    drone.tick(5);
    assert.equal(drone.kinematics.position.altitudeMeters, 25);
    assert.equal(drone.state, "TAKEOFF");

    // Tick another 5 seconds: reaches 50m target cruise altitude -> transitions to EN_ROUTE
    drone.tick(5);
    assert.equal(drone.kinematics.position.altitudeMeters, 50);
    assert.equal(drone.state, "EN_ROUTE");
  });

  it("navigates waypoints, detects arrival, and updates heading/distance", () => {
    const drone = new SimulatedDrone("00000000-0000-0000-0000-000000000011", "00000000-0000-0000-0000-000000000001", origin, {
      climbRateMetersPerSecond: 50.0 // Instant climb for test
    });

    const events: DroneEvent[] = [];
    drone.onEvent((e) => events.push(e));

    drone.assignMission(sampleMission);
    drone.startMission();
    drone.tick(1); // Finish takeoff -> EN_ROUTE

    assert.equal(drone.state, "EN_ROUTE");
    // Head North (~0 degrees)
    assert.ok(Math.abs(drone.kinematics.headingDegrees - 0) < 1.0 || Math.abs(drone.kinematics.headingDegrees - 360) < 1.0);

    // Fly through waypoints until ARRIVED
    while (drone.state === "EN_ROUTE") {
      drone.tick(5);
    }

    const wpReachedEvents = events.filter((e) => e.type === "WAYPOINT_REACHED");
    assert.ok(wpReachedEvents.length >= 1, "Should have emitted WAYPOINT_REACHED");
    assert.equal(drone.state, "ARRIVED");

    const destEvents = events.filter((e) => e.type === "DESTINATION_ARRIVED");
    assert.equal(destEvents.length, 1);
  });

  it("executes full delivery sequence: descent, hold, ascent, and return", () => {
    const drone = new SimulatedDrone("00000000-0000-0000-0000-000000000011", "00000000-0000-0000-0000-000000000001", origin, {
      climbRateMetersPerSecond: 10.0,
      descentRateMetersPerSecond: 10.0,
      defaultDeliveryAltitudeMeters: 2.0,
      defaultCruiseAltitudeMeters: 50.0
    });

    const events: DroneEvent[] = [];
    drone.onEvent((e) => events.push(e));

    drone.assignMission(sampleMission);
    drone.startMission();

    // Fly through takeoff and route until reaching destination
    while (drone.state === "TAKEOFF" || drone.state === "EN_ROUTE") {
      drone.tick(2);
    }
    assert.equal(drone.state, "ARRIVED");

    // Tick into ARRIVED -> triggers DELIVERING & starts descent
    drone.tick(1);
    assert.equal(drone.state, "DELIVERING");

    // Descend from 50m to 2m (48m / 10m/s = 4.8s -> tick 5s)
    drone.tick(5);
    assert.equal(drone.kinematics.position.altitudeMeters, 2.0);

    // Hold for 2 seconds delivery verification
    drone.tick(2.1);

    // Ascend back to cruise altitude 50m (48m / 10m/s = 4.8s -> tick 5s)
    drone.tick(5);
    assert.equal(drone.kinematics.position.altitudeMeters, 50.0);
    assert.equal(drone.state, "RETURNING");

    const deliveryCompleted = events.some((e) => e.type === "DELIVERY_COMPLETED");
    assert.ok(deliveryCompleted, "Should have emitted DELIVERY_COMPLETED");
  });

  it("executes Return-To-Home deterministically without teleportation", () => {
    const drone = new SimulatedDrone("00000000-0000-0000-0000-000000000011", "00000000-0000-0000-0000-000000000001", origin, {
      climbRateMetersPerSecond: 20.0,
      descentRateMetersPerSecond: 10.0
    });

    drone.assignMission(sampleMission);
    drone.startMission();
    drone.tick(2.5); // Climb to 50m -> EN_ROUTE
    drone.tick(5);   // En route (partway to destination)

    assert.equal(drone.state, "EN_ROUTE");
    const midFlightPosition = { ...drone.kinematics.position };

    // Trigger Return-To-Home
    drone.returnToHome("OPERATOR_ABORT");
    assert.equal(drone.state, "RETURNING");
    // Confirm drone did not teleport back instantly
    assert.equal(drone.kinematics.position.latitude, midFlightPosition.latitude);

    // Fly return leg until touchdown
    while (drone.state === "RETURNING") {
      drone.tick(5);
    }
    assert.equal(drone.state, "LANDED");
    assert.equal(drone.kinematics.position.altitudeMeters, 0);
  });

  it("drains battery during flight and triggers critical battery failsafe RTH", () => {
    const drone = new SimulatedDrone("00000000-0000-0000-0000-000000000011", "00000000-0000-0000-0000-000000000001", origin, {
      climbRateMetersPerSecond: 50.0,
      batteryDischargeRateCruise: 1.0, // 1% per second for fast test
      batteryCriticalThreshold: 20.0
    });

    const events: DroneEvent[] = [];
    drone.onEvent((e) => events.push(e));

    drone.assignMission(sampleMission);
    drone.startMission();
    drone.tick(1); // En route

    const initialBattery = drone.battery.percent;
    // Tick 30 seconds -> drains ~30%
    drone.tick(30);
    assert.ok(drone.battery.percent < initialBattery);

    // Tick another 55 seconds -> drains to <= 20% critical threshold
    drone.tick(55);

    const criticalEvent = events.some((e) => e.type === "CRITICAL_BATTERY_ALERT");
    assert.ok(criticalEvent, "Should emit CRITICAL_BATTERY_ALERT");
    assert.equal(drone.state, "RETURNING");
  });

  it("handles emergency trigger and recovery", () => {
    const drone = new SimulatedDrone("00000000-0000-0000-0000-000000000011", "00000000-0000-0000-0000-000000000001", origin);
    drone.assignMission(sampleMission);
    drone.startMission();
    drone.tick(1);

    drone.triggerEmergency("GEOFENCE_BREACH_DETECTED");
    assert.equal(drone.emergencyReason, "GEOFENCE_BREACH_DETECTED");
    assert.equal(drone.state, "RETURNING");
  });

  it("generates telemetry conforming to shared contracts schema", () => {
    const drone = new SimulatedDrone("00000000-0000-0000-0000-000000000011", "00000000-0000-0000-0000-000000000001", origin);
    drone.assignMission(sampleMission);
    drone.startMission();
    drone.tick(2);

    const telemetry: SimulatedTelemetry = drone.getTelemetry();
    assert.equal(telemetry.droneId, "00000000-0000-0000-0000-000000000011");
    assert.equal(telemetry.state, "TAKEOFF");
    assert.equal(telemetry.version, "v1");

    // Validate against shared @skynav/contracts Zod schema
    const validation = telemetrySchema.safeParse(telemetry);
    assert.ok(validation.success, `Telemetry failed contract validation: ${JSON.stringify(validation.error?.errors)}`);
  });

  it("resets drone state and battery cleanly", () => {
    const drone = new SimulatedDrone("00000000-0000-0000-0000-000000000011", "00000000-0000-0000-0000-000000000001", origin);
    drone.assignMission(sampleMission);
    drone.startMission();
    drone.tick(5);

    drone.reset();
    assert.equal(drone.state, "IDLE");
    assert.equal(drone.battery.percent, 100);
    assert.equal(drone.kinematics.position.altitudeMeters, 0);
    assert.equal(drone.currentMission, null);
  });
});
