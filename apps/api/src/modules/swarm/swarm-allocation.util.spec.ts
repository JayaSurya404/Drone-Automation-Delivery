import { allocateSwarmTasks, type ScoredSwarmCandidate, type SwarmAllocationTarget } from "./swarm-allocation.util";

function candidate(overrides: Partial<ScoredSwarmCandidate> & { droneId: string }): ScoredSwarmCandidate {
  return {
    droneName: overrides.droneId,
    eligible: true,
    score: 50,
    distanceMeters: 1000,
    durationSeconds: 120,
    batteryFeasibility: "SUFFICIENT",
    payloadSuitable: true,
    reason: "ok",
    ...overrides,
  };
}

function target(overrides: Partial<SwarmAllocationTarget> & { key: string; candidates: ScoredSwarmCandidate[] }): SwarmAllocationTarget {
  return { deliveryId: null, lat: 0, lng: 0, priority: "STANDARD", ...overrides };
}

describe("allocateSwarmTasks", () => {
  it("assigns the highest-scoring eligible drone to a single target", () => {
    const result = allocateSwarmTasks([
      target({ key: "t1", candidates: [candidate({ droneId: "a", score: 40 }), candidate({ droneId: "b", score: 90 })] }),
    ]);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.drone.droneId).toBe("b");
    expect(result.unassigned).toHaveLength(0);
  });

  it("never assigns the same drone to two targets in one plan", () => {
    const candidates = [candidate({ droneId: "a", score: 90 })];
    const result = allocateSwarmTasks([target({ key: "t1", candidates }), target({ key: "t2", candidates })]);
    expect(result.assignments).toHaveLength(1);
    expect(result.unassigned).toHaveLength(1);
    expect(result.unassigned[0]?.reason).toMatch(/already claimed/i);
  });

  it("processes EXPRESS targets before STANDARD ones when both compete for the same drone", () => {
    const candidates = [candidate({ droneId: "a", score: 90 })];
    const result = allocateSwarmTasks([
      target({ key: "standard", priority: "STANDARD", candidates }),
      target({ key: "express", priority: "EXPRESS", candidates }),
    ]);
    expect(result.assignments[0]?.targetKey).toBe("express");
    expect(result.unassigned[0]?.targetKey).toBe("standard");
  });

  it("reports a target with no eligible drone as unassigned with a distinct reason", () => {
    const result = allocateSwarmTasks([target({ key: "t1", candidates: [candidate({ droneId: "a", eligible: false })] })]);
    expect(result.assignments).toHaveLength(0);
    expect(result.unassigned[0]?.reason).toMatch(/no swarm-member drone is eligible/i);
  });

  it("is deterministic and stable-ordered for equal scores", () => {
    const candidates = [candidate({ droneId: "a", score: 50 }), candidate({ droneId: "b", score: 50 })];
    const result1 = allocateSwarmTasks([target({ key: "t1", candidates })]);
    const result2 = allocateSwarmTasks([target({ key: "t1", candidates })]);
    expect(result1).toEqual(result2);
  });

  it("assigns as many targets as there are distinct eligible drones, leaving the rest unassigned", () => {
    const candidates = [candidate({ droneId: "a", score: 80 }), candidate({ droneId: "b", score: 60 })];
    const result = allocateSwarmTasks([
      target({ key: "t1", candidates }),
      target({ key: "t2", candidates }),
      target({ key: "t3", candidates }),
    ]);
    expect(result.assignments).toHaveLength(2);
    expect(result.unassigned).toHaveLength(1);
    const assignedDrones = result.assignments.map((a) => a.drone.droneId).sort();
    expect(assignedDrones).toEqual(["a", "b"]);
  });
});
