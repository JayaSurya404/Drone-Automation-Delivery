import type { BatteryFeasibilityLevel } from "./battery-feasibility.util";

export interface DroneCandidateInput {
  droneId: string;
  droneName: string;
  batteryPercent: number;
  batteryHealthPercent: number;
  maxPayloadKg: number;
  distanceFromOriginMeters: number;
  droneMaxRangeKm: number;
  batteryFeasibilityLevel: BatteryFeasibilityLevel;
  payloadKg: number;
}

export interface DroneRankingResult {
  droneId: string;
  droneName: string;
  score: number;
  eligible: boolean;
  reasons: string[];
}

/**
 * Explainable 0-100 ranking score (higher = better candidate) for
 * `DroneSelectionService` — every eligible drone (already filtered to
 * `IDLE`/non-maintenance by `DronesService.listAvailable()`, the
 * authoritative fleet-status source this never duplicates) gets ranked by
 * battery, health, proximity, and payload margin. A drone whose payload
 * capacity can't fit the delivery, or whose battery feasibility for this
 * specific route is `INSUFFICIENT`, is marked ineligible (score 0) rather
 * than merely penalized — it must never be recommended.
 */
export function scoreDroneCandidate(input: DroneCandidateInput): DroneRankingResult {
  const reasons: string[] = [];

  if (input.payloadKg > input.maxPayloadKg) {
    return {
      droneId: input.droneId,
      droneName: input.droneName,
      score: 0,
      eligible: false,
      reasons: [`Payload ${input.payloadKg}kg exceeds this drone's ${input.maxPayloadKg}kg capacity`],
    };
  }
  if (input.batteryFeasibilityLevel === "INSUFFICIENT") {
    return {
      droneId: input.droneId,
      droneName: input.droneName,
      score: 0,
      eligible: false,
      reasons: ["Battery reserve is insufficient for this route's distance"],
    };
  }

  const batteryScore = Math.round((input.batteryPercent / 100) * 40);
  reasons.push(`${input.batteryPercent}% battery (${batteryScore}/40 points)`);

  const healthScore = Math.round((input.batteryHealthPercent / 100) * 20);
  reasons.push(`${input.batteryHealthPercent}% battery health (${healthScore}/20 points)`);

  const feasibilityScore = input.batteryFeasibilityLevel === "SUFFICIENT" ? 20 : 10;
  reasons.push(`Battery feasibility ${input.batteryFeasibilityLevel.toLowerCase()} for this route (${feasibilityScore}/20 points)`);

  const maxUsefulRangeMeters = Math.max(input.droneMaxRangeKm * 1000, 1);
  const proximityRatio = Math.min(1, input.distanceFromOriginMeters / maxUsefulRangeMeters);
  const distanceScore = Math.round((1 - proximityRatio) * 15);
  reasons.push(
    input.distanceFromOriginMeters < 50
      ? `Already at the mission origin (${distanceScore}/15 points)`
      : `${(input.distanceFromOriginMeters / 1000).toFixed(2)} km from the mission origin (${distanceScore}/15 points)`,
  );

  const payloadMarginRatio = input.maxPayloadKg > 0 ? (input.maxPayloadKg - input.payloadKg) / input.maxPayloadKg : 1;
  const payloadScore = Math.round(Math.min(1, payloadMarginRatio / 0.5) * 5);
  reasons.push(`Payload capacity margin ${(payloadMarginRatio * 100).toFixed(0)}% (${payloadScore}/5 points)`);

  const score = Math.min(100, batteryScore + healthScore + feasibilityScore + distanceScore + payloadScore);

  return { droneId: input.droneId, droneName: input.droneName, score, eligible: true, reasons };
}

/** Ranks every candidate, highest score first — the sole ordering `DroneSelectionService` returns to callers. */
export function rankDroneCandidates(candidates: DroneCandidateInput[]): DroneRankingResult[] {
  return candidates.map(scoreDroneCandidate).sort((a, b) => b.score - a.score);
}
