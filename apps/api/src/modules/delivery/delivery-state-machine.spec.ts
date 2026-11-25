import {
  CANCELLABLE_DELIVERY_STATUSES,
  HUB_ASSIGNABLE_STATUSES,
  HUB_UNASSIGNABLE_STATUSES,
  REDELIVERABLE_STATUSES,
  RETURNABLE_TO_HUB_STATUSES,
  VERIFIABLE_STATUSES,
  isCancellable,
  nextAdvanceStatus,
} from "./delivery-state-machine";

describe("delivery-state-machine", () => {
  it("advances through the full happy-path chain one step at a time", () => {
    expect(nextAdvanceStatus("HUB_ASSIGNED")).toBe("MISSION_PLANNED");
    expect(nextAdvanceStatus("MISSION_PLANNED")).toBe("DRONE_DISPATCHED");
    expect(nextAdvanceStatus("DRONE_DISPATCHED")).toBe("IN_TRANSIT");
    expect(nextAdvanceStatus("IN_TRANSIT")).toBe("ARRIVED_AT_DESTINATION");
    expect(nextAdvanceStatus("ARRIVED_AT_DESTINATION")).toBe("DELIVERED_PENDING_VERIFICATION");
  });

  it("resumes a scheduled redelivery straight at the verification step", () => {
    expect(nextAdvanceStatus("REDELIVERY_SCHEDULED")).toBe("DELIVERED_PENDING_VERIFICATION");
  });

  it("has no next step for terminal or pre-assignment statuses", () => {
    expect(nextAdvanceStatus("PENDING_ASSIGNMENT")).toBeNull();
    expect(nextAdvanceStatus("DELIVERED_PENDING_VERIFICATION")).toBeNull();
    expect(nextAdvanceStatus("COMPLETED")).toBeNull();
    expect(nextAdvanceStatus("CANCELLED")).toBeNull();
    expect(nextAdvanceStatus("VERIFICATION_FAILED")).toBeNull();
  });

  it("allows cancellation from every pre-completion status and nowhere else", () => {
    expect(isCancellable("PENDING_ASSIGNMENT")).toBe(true);
    expect(isCancellable("DELIVERED_PENDING_VERIFICATION")).toBe(true);
    expect(isCancellable("VERIFICATION_FAILED")).toBe(true);
    expect(isCancellable("COMPLETED")).toBe(false);
    expect(isCancellable("CANCELLED")).toBe(false);
    expect(isCancellable("RETURNED_TO_HUB")).toBe(false);
  });

  it("defines disjoint, purposeful action-eligibility sets", () => {
    expect(CANCELLABLE_DELIVERY_STATUSES).toContain("HUB_ASSIGNED");
    expect(HUB_ASSIGNABLE_STATUSES).toEqual(["PENDING_ASSIGNMENT", "HUB_ASSIGNED"]);
    expect(HUB_UNASSIGNABLE_STATUSES).toEqual(["HUB_ASSIGNED"]);
    expect(VERIFIABLE_STATUSES).toEqual(["DELIVERED_PENDING_VERIFICATION"]);
    expect(REDELIVERABLE_STATUSES).toEqual(["VERIFICATION_FAILED"]);
    expect(RETURNABLE_TO_HUB_STATUSES).toContain("IN_TRANSIT");
    expect(RETURNABLE_TO_HUB_STATUSES).not.toContain("PENDING_ASSIGNMENT");
  });
});
