import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateOrderStateTransition,
  isTerminalOrderStatus,
  canCustomerCancelOrder,
  canOperatorCancelOrder,
  InvalidOrderStateTransitionError
} from "../order.state-machine.js";
import type { OrderStatus } from "@skynav/contracts";

describe("Orders / State Machine Transitions", () => {
  it("permits standard forward happy-path delivery transitions", () => {
    assert.doesNotThrow(() => validateOrderStateTransition("CREATED", "CONFIRMED"));
    assert.doesNotThrow(() => validateOrderStateTransition("CONFIRMED", "ASSIGNED"));
    assert.doesNotThrow(() => validateOrderStateTransition("ASSIGNED", "IN_TRANSIT"));
    assert.doesNotThrow(() => validateOrderStateTransition("IN_TRANSIT", "DELIVERED"));
  });

  it("permits self-transitions (no-op)", () => {
    const statuses: OrderStatus[] = [
      "CREATED",
      "CONFIRMED",
      "ASSIGNED",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
      "FAILED"
    ];
    for (const status of statuses) {
      assert.doesNotThrow(() => validateOrderStateTransition(status, status));
    }
  });

  it("permits cancellation and failure from permitted non-terminal states", () => {
    assert.doesNotThrow(() => validateOrderStateTransition("CREATED", "CANCELLED"));
    assert.doesNotThrow(() => validateOrderStateTransition("CONFIRMED", "CANCELLED"));
    assert.doesNotThrow(() => validateOrderStateTransition("ASSIGNED", "CANCELLED"));
    assert.doesNotThrow(() => validateOrderStateTransition("ASSIGNED", "FAILED"));
    assert.doesNotThrow(() => validateOrderStateTransition("IN_TRANSIT", "FAILED"));
  });

  it("rejects illegal backward or arbitrary transitions with InvalidOrderStateTransitionError", () => {
    assert.throws(
      () => validateOrderStateTransition("DELIVERED", "CREATED"),
      (err: any) => err instanceof InvalidOrderStateTransitionError && err.code === "INVALID_ORDER_STATE_TRANSITION"
    );

    assert.throws(
      () => validateOrderStateTransition("DELIVERED", "IN_TRANSIT"),
      (err: any) => err instanceof InvalidOrderStateTransitionError
    );

    assert.throws(
      () => validateOrderStateTransition("CANCELLED", "ASSIGNED"),
      (err: any) => err instanceof InvalidOrderStateTransitionError
    );

    assert.throws(
      () => validateOrderStateTransition("FAILED", "IN_TRANSIT"),
      (err: any) => err instanceof InvalidOrderStateTransitionError
    );

    assert.throws(
      () => validateOrderStateTransition("CREATED", "DELIVERED"),
      (err: any) => err instanceof InvalidOrderStateTransitionError
    );
  });

  it("correctly identifies terminal order statuses", () => {
    assert.equal(isTerminalOrderStatus("DELIVERED"), true);
    assert.equal(isTerminalOrderStatus("CANCELLED"), true);
    assert.equal(isTerminalOrderStatus("FAILED"), true);
    assert.equal(isTerminalOrderStatus("CREATED"), false);
    assert.equal(isTerminalOrderStatus("CONFIRMED"), false);
    assert.equal(isTerminalOrderStatus("ASSIGNED"), false);
    assert.equal(isTerminalOrderStatus("IN_TRANSIT"), false);
  });

  it("validates customer vs operator cancellation rules", () => {
    // Customer can only cancel prior to drone assignment
    assert.equal(canCustomerCancelOrder("CREATED"), true);
    assert.equal(canCustomerCancelOrder("CONFIRMED"), true);
    assert.equal(canCustomerCancelOrder("ASSIGNED"), false);
    assert.equal(canCustomerCancelOrder("IN_TRANSIT"), false);
    assert.equal(canCustomerCancelOrder("DELIVERED"), false);

    // Operator can cancel active assigned missions before delivery
    assert.equal(canOperatorCancelOrder("CREATED"), true);
    assert.equal(canOperatorCancelOrder("CONFIRMED"), true);
    assert.equal(canOperatorCancelOrder("ASSIGNED"), true);
    assert.equal(canOperatorCancelOrder("IN_TRANSIT"), true);
    assert.equal(canOperatorCancelOrder("DELIVERED"), false);
    assert.equal(canOperatorCancelOrder("CANCELLED"), false);
  });
});
