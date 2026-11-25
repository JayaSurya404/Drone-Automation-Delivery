import type { LandingZoneVerdict } from "./landing-zone.util";

export type NavigationRecommendation = "PROCEED" | "HOLD" | "ABORT_LANDING";

export interface VisualNavigationHint {
  recommendation: NavigationRecommendation;
  message: string;
  reasons: string[];
}

export interface VisualNavigationInput {
  obstructed: boolean;
  humanDetected: boolean;
  landingZoneVerdict: LandingZoneVerdict | null;
}

/**
 * Part 3 — an advisory hint only, never an authoritative flight command.
 * Nothing calls this to actually move a drone: `MissionsService`'s state
 * machine and the Phase 8 safety gates remain the sole authority over real
 * flight behavior (Part 12: "raw computer-vision output must never directly
 * issue unrestricted drone control commands"). A caller (an operator
 * reviewing the admin UI, or a future mission-engine integration point) is
 * responsible for acting on this.
 */
export function deriveNavigationHint(input: VisualNavigationInput): VisualNavigationHint {
  const reasons: string[] = [];

  if (input.humanDetected) {
    reasons.push("A person was detected in the field of view");
    return { recommendation: "ABORT_LANDING", message: "Hold position — a person was detected near the landing zone.", reasons };
  }
  if (input.landingZoneVerdict === "UNSUITABLE") {
    reasons.push("The evaluated landing zone is unsuitable");
    return { recommendation: "ABORT_LANDING", message: "Do not descend — the landing zone is unsuitable.", reasons };
  }
  if (input.obstructed || input.landingZoneVerdict === "MARGINAL") {
    reasons.push(input.obstructed ? "An obstruction was detected nearby" : "The landing zone is only marginally suitable");
    return { recommendation: "HOLD", message: "Hold and reassess — conditions are marginal.", reasons };
  }
  reasons.push("No obstructions or hazards detected");
  return { recommendation: "PROCEED", message: "Clear to proceed.", reasons };
}
