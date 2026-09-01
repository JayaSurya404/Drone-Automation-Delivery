import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidStateTransition,
  assertValidStateTransition,
  InvalidStateTransitionError
} from "../state-machine.js";
import type { DroneSimState } from "../types.js";

describe("Simulator / State Machine Transitions", () => {
  it("allows standard happy-path delivery lifecycle transitions", () => {
    const happyPath: DroneSimState[] = [
      "IDLE",
      "ASSIGNED",
      "TAKEOFF",
      "EN_ROUTE",
      "ARRIVED",
      "DELIVERING",
      "RETURNING",
      "LANDED",
      "IDLE"
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      const from = happyPath[i]!;
      const to = happyPath[i + 1]!;
      assert.ok(isValidStateTransition(from, to), `Expected valid transition from ${from} to ${to}`);
      assert.doesNotThrow(() => assertValidStateTransition(from, to));
    }
  });

  it("permits emergency transitions from flight states", () => {
    const flightStates: DroneSimState[] = ["ASSIGNED", "TAKEOFF", "EN_ROUTE", "ARRIVED", "DELIVERING", "RETURNING"];
    for (const state of flightStates) {
      assert.ok(isValidStateTransition(state, "EMERGENCY"), `Expected ${state} -> EMERGENCY to be valid`);
      assert.doesNotThrow(() => assertValidStateTransition(state, "EMERGENCY"));
    }
  });

  it("rejects illegal arbitrary state jumps with InvalidStateTransitionError", () => {
    const invalidPairs: Array<[DroneSimState, DroneSimState]> = [
      ["IDLE", "EN_ROUTE"],
      ["IDLE", "DELIVERING"],
      ["TAKEOFF", "LANDED"],
      ["DELIVERING", "TAKEOFF"],
      ["LANDED", "EN_ROUTE"]
    ];

    for (const [from, to] of invalidPairs) {
      assert.equal(isValidStateTransition(from, to), false, `Expected ${from} -> ${to} to be invalid`);
      assert.throws(
        () => assertValidStateTransition(from, to),
        (err: Error) => err instanceof InvalidStateTransitionError && err.fromState === from && err.toState === to
      );
    }
  });
});
