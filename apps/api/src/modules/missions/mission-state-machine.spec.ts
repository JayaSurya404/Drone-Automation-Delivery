import { ABORTABLE_STATUSES, DRONE_ASSIGNABLE_STATUSES, isTerminal, PROGRESSABLE_STATUSES, RTH_TRIGGERABLE_STATUSES, STARTABLE_STATUSES } from "./mission-state-machine";

describe("mission-state-machine", () => {
  it("only allows drone assignment/start while PLANNED", () => {
    expect(DRONE_ASSIGNABLE_STATUSES).toEqual(["PLANNED"]);
    expect(STARTABLE_STATUSES).toEqual(["PLANNED"]);
  });

  it("allows progress while dispatched, in progress, or returning", () => {
    expect(PROGRESSABLE_STATUSES).toEqual(["DISPATCHED", "IN_PROGRESS", "RETURNING"]);
  });

  it("allows RTH trigger only from active flight, not already-returning", () => {
    expect(RTH_TRIGGERABLE_STATUSES).toEqual(["DISPATCHED", "IN_PROGRESS"]);
  });

  it("allows abort from any non-terminal status", () => {
    expect(ABORTABLE_STATUSES).toEqual(["PLANNED", "DISPATCHED", "IN_PROGRESS", "RETURNING"]);
  });

  it("treats COMPLETED and ABORTED as terminal", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("ABORTED")).toBe(true);
    expect(isTerminal("IN_PROGRESS")).toBe(false);
  });
});
