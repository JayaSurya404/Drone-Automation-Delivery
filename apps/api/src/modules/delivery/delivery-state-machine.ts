import type { DeliveryStatus } from "@prisma/client";

/**
 * Phase 5 subset of blueprint Section Q's Order/Delivery/Mission chain.
 * Every transition here is triggered by a human action (a Delivery
 * Coordinator's "advance" click, a customer's verification submission, an
 * admin cancellation) — none of it is drone/mission-driven yet, since no
 * `Drone`/`Mission` entity exists until Phase 6/7. Keeping the allowed-
 * transition rules here, as pure data/functions, makes "validate every
 * state transition" a testable unit rather than logic buried in the service.
 */

/** The happy-path chain a Delivery Coordinator manually advances through, one step at a time. */
const ADVANCE_MAP: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  HUB_ASSIGNED: "MISSION_PLANNED",
  MISSION_PLANNED: "DRONE_DISPATCHED",
  DRONE_DISPATCHED: "IN_TRANSIT",
  IN_TRANSIT: "ARRIVED_AT_DESTINATION",
  ARRIVED_AT_DESTINATION: "DELIVERED_PENDING_VERIFICATION",
  // A scheduled redelivery resumes at the verification step with a freshly
  // generated code — going all the way back to DRONE_DISPATCHED would imply
  // a mission re-run that no mission engine exists to perform yet.
  REDELIVERY_SCHEDULED: "DELIVERED_PENDING_VERIFICATION",
};

/** Returns the next status a manual "advance" action would move to, or `null` if `current` has no defined next step. */
export function nextAdvanceStatus(current: DeliveryStatus): DeliveryStatus | null {
  return ADVANCE_MAP[current] ?? null;
}

export const CANCELLABLE_DELIVERY_STATUSES: DeliveryStatus[] = [
  "PENDING_ASSIGNMENT",
  "HUB_ASSIGNED",
  "MISSION_PLANNED",
  "DRONE_DISPATCHED",
  "IN_TRANSIT",
  "ARRIVED_AT_DESTINATION",
  "DELIVERED_PENDING_VERIFICATION",
  "VERIFICATION_FAILED",
  "REDELIVERY_SCHEDULED",
];

/** Hub can be (re-)assigned before dispatch planning begins. */
export const HUB_ASSIGNABLE_STATUSES: DeliveryStatus[] = ["PENDING_ASSIGNMENT", "HUB_ASSIGNED"];

/** Undoing an assignment is only sensible while nothing downstream depends on it yet. */
export const HUB_UNASSIGNABLE_STATUSES: DeliveryStatus[] = ["HUB_ASSIGNED"];

export const VERIFIABLE_STATUSES: DeliveryStatus[] = ["DELIVERED_PENDING_VERIFICATION"];

export const REDELIVERABLE_STATUSES: DeliveryStatus[] = ["VERIFICATION_FAILED"];

/** A package can be marked returned once it's left the hub but hasn't been successfully handed off. */
export const RETURNABLE_TO_HUB_STATUSES: DeliveryStatus[] = [
  "DRONE_DISPATCHED",
  "IN_TRANSIT",
  "ARRIVED_AT_DESTINATION",
  "VERIFICATION_FAILED",
  "REDELIVERY_SCHEDULED",
];

export function isCancellable(status: DeliveryStatus): boolean {
  return CANCELLABLE_DELIVERY_STATUSES.includes(status);
}
