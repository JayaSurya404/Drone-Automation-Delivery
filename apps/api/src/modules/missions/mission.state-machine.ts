import type { MissionStatus } from "@skynav/contracts";

export class InvalidMissionStateTransitionError extends Error {
  public readonly code = "INVALID_MISSION_STATE_TRANSITION";
  public readonly currentStatus: MissionStatus;
  public readonly targetStatus: MissionStatus;

  constructor(currentStatus: MissionStatus, targetStatus: MissionStatus) {
    super(`Cannot transition mission state from '${currentStatus}' to '${targetStatus}'.`);
    this.name = "InvalidMissionStateTransitionError";
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
  }
}

/**
 * Legal state transition table for delivery flight missions.
 */
const MISSION_TRANSITIONS: Record<MissionStatus, readonly MissionStatus[]> = {
  PENDING: ["PLANNED", "VALIDATING", "READY", "AUTHORIZED", "ASSIGNED", "CANCELLED"],
  PLANNED: ["VALIDATING", "READY", "AUTHORIZED", "ASSIGNED", "CANCELLED"],
  VALIDATING: ["READY", "AUTHORIZED", "ASSIGNED", "CANCELLED", "FAILED"],
  READY: ["AUTHORIZED", "ASSIGNED", "LAUNCHING", "DISPATCHED", "CANCELLED"],
  AUTHORIZED: ["ASSIGNED", "LAUNCHING", "DISPATCHED", "CANCELLED"],
  ASSIGNED: ["LAUNCHING", "DISPATCHED", "IN_PROGRESS", "CANCELLED", "FAILED", "EMERGENCY"],
  LAUNCHING: ["DISPATCHED", "IN_PROGRESS", "RETURNING", "FAILED", "EMERGENCY", "ABORTED"],
  DISPATCHED: ["IN_PROGRESS", "DELIVERING", "RETURNING", "FAILED", "EMERGENCY", "ABORTED"],
  IN_PROGRESS: ["DELIVERING", "RETURNING", "FAILED", "EMERGENCY", "ABORTED"],
  DELIVERING: ["RETURNING", "COMPLETED", "FAILED", "EMERGENCY", "ABORTED"],
  RETURNING: ["COMPLETED", "FAILED", "EMERGENCY", "ABORTED"],
  EMERGENCY: ["RETURNING", "COMPLETED", "FAILED", "ABORTED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
  ABORTED: []
};

/**
 * Validates whether transitioning a mission from currentStatus to targetStatus is legally permitted.
 */
export function validateMissionStateTransition(
  currentStatus: MissionStatus,
  targetStatus: MissionStatus
): void {
  // Self-transitions are idempotent no-ops
  if (currentStatus === targetStatus) {
    return;
  }

  const allowed = MISSION_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new InvalidMissionStateTransitionError(currentStatus, targetStatus);
  }
}

/**
 * Returns true if the mission is in a final, terminal status.
 */
export function isTerminalMissionStatus(status: MissionStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED" || status === "FAILED" || status === "ABORTED";
}

/**
 * Returns true if the mission is in an initial unassigned state ready for drone assignment.
 */
export function canAssignDroneToMission(status: MissionStatus): boolean {
  return status === "PENDING" || status === "PLANNED" || status === "VALIDATING" || status === "READY" || status === "AUTHORIZED";
}
