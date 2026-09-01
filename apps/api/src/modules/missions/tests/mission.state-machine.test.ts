import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateMissionStateTransition,
  isTerminalMissionStatus,
  canAssignDroneToMission,
  InvalidMissionStateTransitionError
} from "../mission.state-machine.js";

describe("Missions / Mission State Machine Transitions", () => {
  it("permits standard forward delivery mission lifecycle", () => {
    assert.doesNotThrow(() => validateMissionStateTransition("PENDING", "ASSIGNED"));
    assert.doesNotThrow(() => validateMissionStateTransition("ASSIGNED", "LAUNCHING"));
    assert.doesNotThrow(() => validateMissionStateTransition("LAUNCHING", "IN_PROGRESS"));
    assert.doesNotThrow(() => validateMissionStateTransition("IN_PROGRESS", "DELIVERING"));
    assert.doesNotThrow(() => validateMissionStateTransition("DELIVERING", "RETURNING"));
    assert.doesNotThrow(() => validateMissionStateTransition("RETURNING", "COMPLETED"));
  });

  it("permits cancellation and failure from permitted states", () => {
    assert.doesNotThrow(() => validateMissionStateTransition("PENDING", "CANCELLED"));
    assert.doesNotThrow(() => validateMissionStateTransition("ASSIGNED", "CANCELLED"));
    assert.doesNotThrow(() => validateMissionStateTransition("IN_PROGRESS", "FAILED"));
    assert.doesNotThrow(() => validateMissionStateTransition("DELIVERING", "FAILED"));
    assert.doesNotThrow(() => validateMissionStateTransition("IN_PROGRESS", "EMERGENCY"));
    assert.doesNotThrow(() => validateMissionStateTransition("EMERGENCY", "RETURNING"));
    assert.doesNotThrow(() => validateMissionStateTransition("RETURNING", "COMPLETED"));
  });

  it("rejects illegal backward or jumping transitions", () => {
    assert.throws(
      () => validateMissionStateTransition("COMPLETED", "PENDING"),
      (err: any) => err instanceof InvalidMissionStateTransitionError && err.code === "INVALID_MISSION_STATE_TRANSITION"
    );
    assert.throws(
      () => validateMissionStateTransition("CANCELLED", "ASSIGNED"),
      (err: any) => err instanceof InvalidMissionStateTransitionError
    );
    assert.throws(
      () => validateMissionStateTransition("PENDING", "DELIVERING"),
      (err: any) => err instanceof InvalidMissionStateTransitionError
    );
  });

  it("evaluates terminal statuses and assignable statuses", () => {
    assert.equal(isTerminalMissionStatus("COMPLETED"), true);
    assert.equal(isTerminalMissionStatus("CANCELLED"), true);
    assert.equal(isTerminalMissionStatus("FAILED"), true);
    assert.equal(isTerminalMissionStatus("ABORTED"), true);
    assert.equal(isTerminalMissionStatus("IN_PROGRESS"), false);
    assert.equal(isTerminalMissionStatus("PENDING"), false);

    assert.equal(canAssignDroneToMission("PENDING"), true);
    assert.equal(canAssignDroneToMission("READY"), true);
    assert.equal(canAssignDroneToMission("IN_PROGRESS"), false);
    assert.equal(canAssignDroneToMission("COMPLETED"), false);
  });
});
