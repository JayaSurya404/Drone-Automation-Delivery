import type { DroneSimState } from "./types.js";

export class InvalidStateTransitionError extends Error {
  constructor(public readonly fromState: DroneSimState, public readonly toState: DroneSimState) {
    super(`Illegal drone state transition from '${fromState}' to '${toState}'.`);
    this.name = "InvalidStateTransitionError";
  }
}

/**
 * Strict transition matrix defining all valid autonomous drone state progressions.
 */
export const VALID_TRANSITIONS: Record<DroneSimState, readonly DroneSimState[]> = {
  IDLE: ["ASSIGNED", "OFFLINE"],
  ASSIGNED: ["TAKEOFF", "IDLE", "EMERGENCY", "OFFLINE"],
  TAKEOFF: ["EN_ROUTE", "RETURNING", "EMERGENCY"],
  EN_ROUTE: ["ARRIVED", "RETURNING", "EMERGENCY"],
  ARRIVED: ["DELIVERING", "RETURNING", "EMERGENCY"],
  DELIVERING: ["RETURNING", "EMERGENCY"],
  RETURNING: ["LANDED", "EMERGENCY"],
  LANDED: ["IDLE", "OFFLINE"],
  EMERGENCY: ["RETURNING", "LANDED", "OFFLINE"],
  OFFLINE: ["IDLE"]
} as const;

/**
 * Evaluates whether a transition from one drone state to another is permissible.
 */
export function isValidStateTransition(from: DroneSimState, to: DroneSimState): boolean {
  if (from === to) {
    return true; // No-op transition is permitted
  }
  const allowedNextStates = VALID_TRANSITIONS[from];
  return allowedNextStates ? allowedNextStates.includes(to) : false;
}

/**
 * Asserts that a state transition is valid, throwing an explicit error if illegal.
 */
export function assertValidStateTransition(from: DroneSimState, to: DroneSimState): void {
  if (!isValidStateTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}
