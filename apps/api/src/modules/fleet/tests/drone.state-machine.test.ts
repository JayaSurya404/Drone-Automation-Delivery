import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateDroneStateTransition,
  isDroneAvailableForAssignment,
  InvalidDroneStateTransitionError
} from "../drone.state-machine.js";

describe("Fleet / Drone State Machine Transitions", () => {
  it("permits standard forward flight transitions", () => {
    assert.doesNotThrow(() => validateDroneStateTransition("IDLE", "ASSIGNED"));
    assert.doesNotThrow(() => validateDroneStateTransition("ASSIGNED", "TAKEOFF"));
    assert.doesNotThrow(() => validateDroneStateTransition("TAKEOFF", "EN_ROUTE"));
    assert.doesNotThrow(() => validateDroneStateTransition("EN_ROUTE", "ARRIVED"));
    assert.doesNotThrow(() => validateDroneStateTransition("ARRIVED", "DELIVERING"));
    assert.doesNotThrow(() => validateDroneStateTransition("DELIVERING", "RETURNING"));
    assert.doesNotThrow(() => validateDroneStateTransition("RETURNING", "LANDED"));
    assert.doesNotThrow(() => validateDroneStateTransition("LANDED", "IDLE"));
  });

  it("permits maintenance and offline states from idle/landed", () => {
    assert.doesNotThrow(() => validateDroneStateTransition("IDLE", "MAINTENANCE"));
    assert.doesNotThrow(() => validateDroneStateTransition("MAINTENANCE", "IDLE"));
    assert.doesNotThrow(() => validateDroneStateTransition("IDLE", "OFFLINE"));
    assert.doesNotThrow(() => validateDroneStateTransition("OFFLINE", "IDLE"));
    assert.doesNotThrow(() => validateDroneStateTransition("LANDED", "MAINTENANCE"));
  });

  it("permits emergency transitions from in-flight states", () => {
    assert.doesNotThrow(() => validateDroneStateTransition("TAKEOFF", "EMERGENCY"));
    assert.doesNotThrow(() => validateDroneStateTransition("EN_ROUTE", "EMERGENCY"));
    assert.doesNotThrow(() => validateDroneStateTransition("DELIVERING", "EMERGENCY"));
    assert.doesNotThrow(() => validateDroneStateTransition("RETURNING", "EMERGENCY"));
    assert.doesNotThrow(() => validateDroneStateTransition("EMERGENCY", "RETURNING"));
    assert.doesNotThrow(() => validateDroneStateTransition("EMERGENCY", "LANDED"));
  });

  it("rejects illegal transitions", () => {
    assert.throws(
      () => validateDroneStateTransition("DELIVERING", "IDLE"),
      (err: any) => err instanceof InvalidDroneStateTransitionError && err.code === "INVALID_DRONE_STATE_TRANSITION"
    );
    assert.throws(
      () => validateDroneStateTransition("OFFLINE", "TAKEOFF"),
      (err: any) => err instanceof InvalidDroneStateTransitionError
    );
  });

  it("checks drone availability for assignment", () => {
    assert.equal(isDroneAvailableForAssignment("IDLE", true), true);
    assert.equal(isDroneAvailableForAssignment("AVAILABLE", true), true);
    assert.equal(isDroneAvailableForAssignment("ASSIGNED", true), false);
    assert.equal(isDroneAvailableForAssignment("EN_ROUTE", true), false);
    assert.equal(isDroneAvailableForAssignment("MAINTENANCE", true), false);
    assert.equal(isDroneAvailableForAssignment("OFFLINE", true), false);
    assert.equal(isDroneAvailableForAssignment("IDLE", false), false);
  });
});
