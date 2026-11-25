export type LandingZoneVerdict = "SUITABLE" | "MARGINAL" | "UNSUITABLE";

export interface LandingZoneScoreInput {
  radiusMeters: number;
  requiredRadiusMeters: number;
  /** 0-100 clearance score from the best available vision candidate, or 0 when no candidate was found. */
  clearanceScore: number;
  obstructed: boolean;
  humanDetected: boolean;
  /** Count of active NO_FLY/RESTRICTED geofences the point falls inside (`GeofencingService.findPointViolations()`) — never bypassed. */
  geofenceViolationCount: number;
  /** Distance from the requested delivery point, or `null` when none was given (proximity isn't applicable to a standalone evaluation). */
  distanceFromTargetMeters: number | null;
  suitableThreshold: number;
  marginalThreshold: number;
}

export interface LandingZoneScoreResult {
  sizeScore: number;
  obstructionScore: number;
  safetyScore: number;
  proximityScore: number;
  suitabilityScore: number;
  verdict: LandingZoneVerdict;
  reasons: string[];
}

/**
 * Explainable 0-100 composite score (Part 2's size/obstruction/safety/
 * proximity/suitability breakdown). `safetyScore` is a hard gate, not a mere
 * weighted input — a real geofence conflict or a detected person always
 * forces `UNSUITABLE` regardless of how well the zone otherwise scores,
 * since "never bypass geofencing or safety validation" (Part 2) is a
 * correctness requirement, not a preference.
 */
export function scoreLandingZone(input: LandingZoneScoreInput): LandingZoneScoreResult {
  const reasons: string[] = [];

  const sizeScore = Math.max(0, Math.min(100, Math.round((input.radiusMeters / Math.max(input.requiredRadiusMeters, 0.01)) * 100)));
  reasons.push(
    sizeScore >= 100
      ? `Candidate radius ${input.radiusMeters}m meets the required ${input.requiredRadiusMeters}m`
      : `Candidate radius ${input.radiusMeters}m is below the required ${input.requiredRadiusMeters}m (${sizeScore}/100)`,
  );

  let obstructionScore = Math.max(0, Math.min(100, input.clearanceScore));
  if (input.obstructed) {
    obstructionScore = Math.min(obstructionScore, 30);
    reasons.push("Computer-vision analysis reports an obstruction near the zone");
  }
  if (input.humanDetected) {
    obstructionScore = 0;
    reasons.push("A person was detected in the landing zone");
  }
  if (!input.obstructed && !input.humanDetected) {
    reasons.push(`No obstruction/human detections (clearance ${obstructionScore}/100)`);
  }

  let safetyScore = 100;
  if (input.geofenceViolationCount > 0) {
    safetyScore = 0;
    reasons.push(`Zone intersects ${input.geofenceViolationCount} active no-fly/restricted geofence(s)`);
  } else {
    reasons.push("No geofence conflicts at this location");
  }

  let proximityScore = 100;
  if (input.distanceFromTargetMeters !== null) {
    proximityScore = Math.max(0, Math.round(100 - Math.min(100, input.distanceFromTargetMeters)));
    reasons.push(`${Math.round(input.distanceFromTargetMeters)}m from the requested delivery point`);
  }

  const suitabilityScore = Math.round(sizeScore * 0.25 + obstructionScore * 0.3 + safetyScore * 0.35 + proximityScore * 0.1);

  let verdict: LandingZoneVerdict;
  if (safetyScore === 0 || input.humanDetected) {
    verdict = "UNSUITABLE";
  } else if (suitabilityScore >= input.suitableThreshold) {
    verdict = "SUITABLE";
  } else if (suitabilityScore >= input.marginalThreshold) {
    verdict = "MARGINAL";
  } else {
    verdict = "UNSUITABLE";
  }

  return { sizeScore, obstructionScore, safetyScore, proximityScore, suitabilityScore, verdict, reasons };
}
