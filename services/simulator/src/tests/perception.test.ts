import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SimulatedPerceptionSensor } from "../perception.js";

describe("Simulator / Perception Sensor Unit Tests", () => {
  it("captures safe simulated perception frame at landing descent", () => {
    const sensor = new SimulatedPerceptionSensor({
      droneId: "SKY-001",
      organizationId: "00000000-0000-0000-0000-000000000001",
      syntheticSceneType: "SUBURBAN"
    });

    const frame = sensor.captureFrame({ latitude: 37.7749, longitude: -122.4194, altitudeMeters: 3.5 });

    assert.equal(frame.droneId, "SKY-001");
    assert.equal(frame.landingZoneAssessment.suitability, "SAFE");
    assert.equal(frame.destinationVerification.status, "VERIFIED");
    assert.equal(frame.advisorySafetyStatus, "CLEAR");
    assert.ok(frame.detections.length >= 1);
  });

  it("detects simulated obstructions and marks landing zone unsafe", () => {
    const sensor = new SimulatedPerceptionSensor({
      droneId: "SKY-002",
      organizationId: "00000000-0000-0000-0000-000000000001",
      hasActivePedestrian: true,
      hasOverheadWires: true
    });

    const frame = sensor.captureFrame({ latitude: 37.7749, longitude: -122.4194, altitudeMeters: 8.0 });

    assert.equal(frame.landingZoneAssessment.suitability, "UNSAFE");
    assert.equal(frame.destinationVerification.status, "OBSTRUCTED");
    assert.equal(frame.advisorySafetyStatus, "ADVISORY_ABORT_RECOMMENDED");
    assert.equal(frame.landingZoneAssessment.peopleDetectedCount, 1);
  });
});
