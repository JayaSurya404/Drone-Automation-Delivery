import type { DroneStatus } from "@skynav/contracts";

export class InvalidDroneStateTransitionError extends Error {
  public readonly code = "INVALID_DRONE_STATE_TRANSITION";
  public readonly currentStatus: DroneStatus;
  public readonly targetStatus: DroneStatus;

  constructor(currentStatus: DroneStatus, targetStatus: DroneStatus) {
    super(`Cannot transition drone state from '${currentStatus}' to '${targetStatus}'.`);
    this.name = "InvalidDroneStateTransitionError";
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
  }
}

/**
 * Permitted operational forward and recovery transitions for UAV fleet members.
 */
const DRONE_TRANSITIONS: Record<DroneStatus, readonly DroneStatus[]> = {
  IDLE: ["AVAILABLE", "ASSIGNED", "TAKEOFF", "MAINTENANCE", "OFFLINE"],
  AVAILABLE: ["IDLE", "ASSIGNED", "TAKEOFF", "MAINTENANCE", "OFFLINE"],
  ASSIGNED: ["TAKEOFF", "EN_ROUTE", "IN_FLIGHT", "IDLE", "AVAILABLE", "OFFLINE", "EMERGENCY"],
  TAKEOFF: ["EN_ROUTE", "IN_FLIGHT", "RETURNING", "LANDED", "EMERGENCY"],
  EN_ROUTE: ["ARRIVED", "DELIVERING", "RETURNING", "IN_FLIGHT", "EMERGENCY"],
  ARRIVED: ["DELIVERING", "RETURNING", "LANDED", "EMERGENCY"],
  DELIVERING: ["RETURNING", "ARRIVED", "LANDED", "EMERGENCY"],
  RETURNING: ["LANDED", "IDLE", "AVAILABLE", "EMERGENCY"],
  LANDED: ["IDLE", "AVAILABLE", "MAINTENANCE", "OFFLINE"],
  MAINTENANCE: ["IDLE", "AVAILABLE", "OFFLINE"],
  OFFLINE: ["IDLE", "AVAILABLE", "MAINTENANCE"],
  EMERGENCY: ["RETURNING", "LANDED", "OFFLINE", "MAINTENANCE", "IDLE", "AVAILABLE"],
  IN_FLIGHT: ["ARRIVED", "DELIVERING", "RETURNING", "LANDED", "EMERGENCY"]
};

/**
 * Validates whether transitioning a drone from currentStatus to targetStatus is legally permitted.
 */
export function validateDroneStateTransition(
  currentStatus: DroneStatus,
  targetStatus: DroneStatus
): void {
  // Self-transitions are permitted as idempotent updates
  if (currentStatus === targetStatus) {
    return;
  }

  const allowed = DRONE_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new InvalidDroneStateTransitionError(currentStatus, targetStatus);
  }
}

/**
 * Checks if a drone is currently in an idle/available state and active for mission assignment.
 */
export function isDroneAvailableForAssignment(status: DroneStatus, isActive: boolean): boolean {
  return isActive && (status === "IDLE" || status === "AVAILABLE");
}
