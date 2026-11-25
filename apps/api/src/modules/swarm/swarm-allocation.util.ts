export type SwarmTaskPriority = "STANDARD" | "EXPRESS";

export interface ScoredSwarmCandidate {
  droneId: string;
  droneName: string;
  eligible: boolean;
  score: number;
  distanceMeters: number;
  durationSeconds: number;
  batteryFeasibility: string;
  payloadSuitable: boolean;
  reason: string;
}

export interface SwarmAllocationTarget {
  key: string;
  deliveryId: string | null;
  lat: number;
  lng: number;
  priority: SwarmTaskPriority;
  candidates: ScoredSwarmCandidate[];
}

export interface SwarmAllocationAssignment {
  targetKey: string;
  deliveryId: string | null;
  lat: number;
  lng: number;
  sequence: number;
  drone: ScoredSwarmCandidate;
}

export interface SwarmAllocationUnassigned {
  targetKey: string;
  deliveryId: string | null;
  lat: number;
  lng: number;
  reason: string;
}

export interface SwarmAllocationResult {
  assignments: SwarmAllocationAssignment[];
  unassigned: SwarmAllocationUnassigned[];
}

/**
 * Greedy, deterministic bipartite matching — Part 4/5's "collision-aware
 * coordination": no drone is assigned twice within one plan. Targets are
 * processed EXPRESS-before-STANDARD (ties keep the caller's original
 * order), and each target takes the highest-scoring still-available
 * eligible drone. A target with none left is reported `unassigned` with an
 * explainable reason rather than forced onto an unsuitable/already-claimed
 * drone — this app never fabricates an assignment that wouldn't actually
 * work.
 */
export function allocateSwarmTasks(targets: SwarmAllocationTarget[]): SwarmAllocationResult {
  const ordered = targets.map((target, index) => ({ target, index })).sort((a, b) => priorityWeight(b.target.priority) - priorityWeight(a.target.priority) || a.index - b.index);

  const claimed = new Set<string>();
  const assignments: SwarmAllocationAssignment[] = [];
  const unassigned: SwarmAllocationUnassigned[] = [];
  let sequence = 1;

  for (const { target } of ordered) {
    const available = target.candidates.filter((c) => c.eligible && !claimed.has(c.droneId)).sort((a, b) => b.score - a.score);
    const best = available[0];
    if (!best) {
      const anyEligible = target.candidates.some((c) => c.eligible);
      unassigned.push({
        targetKey: target.key,
        deliveryId: target.deliveryId,
        lat: target.lat,
        lng: target.lng,
        reason: anyEligible
          ? "Every eligible drone in this swarm is already claimed by a higher-priority target in this plan"
          : "No swarm-member drone is eligible for this target (battery, payload, or safety constraints)",
      });
      continue;
    }
    claimed.add(best.droneId);
    assignments.push({ targetKey: target.key, deliveryId: target.deliveryId, lat: target.lat, lng: target.lng, sequence, drone: best });
    sequence += 1;
  }

  return { assignments, unassigned };
}

function priorityWeight(priority: SwarmTaskPriority): number {
  return priority === "EXPRESS" ? 1 : 0;
}
