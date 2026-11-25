import type { MissionStatus } from "@prisma/client";

/** Pure transition-validity rules for `Mission.status` — same "explicit allowed-transition tables" pattern as `delivery-state-machine.ts`. */

export const DRONE_ASSIGNABLE_STATUSES: MissionStatus[] = ["PLANNED"];

export const STARTABLE_STATUSES: MissionStatus[] = ["PLANNED"];

export const PROGRESSABLE_STATUSES: MissionStatus[] = ["DISPATCHED", "IN_PROGRESS", "RETURNING"];

export const RTH_TRIGGERABLE_STATUSES: MissionStatus[] = ["DISPATCHED", "IN_PROGRESS"];

export const ABORTABLE_STATUSES: MissionStatus[] = ["PLANNED", "DISPATCHED", "IN_PROGRESS", "RETURNING"];

export const TERMINAL_STATUSES: MissionStatus[] = ["COMPLETED", "ABORTED"];

export function isTerminal(status: MissionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
