import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import { GeofencingService } from "../geofencing/geofencing.service";
import type { LatLng } from "../geofencing/geometry.util";
import { buildStraightLineRoute } from "../missions/route.util";
import { evaluateBatteryFeasibility } from "./battery-feasibility.util";
import { estimateEta } from "./eta.util";
import type { RouteCandidateResult, RouteOptimizationResult, RouteOptimizer, RouteOptimizerInput } from "./interfaces/route-optimizer.interface";
import { buildOffsetDetour, pathLengthMeters } from "./route-geo.util";

const CRUISE_ALTITUDE_METERS = 60;
/** A detour's own composite-score penalty — prefers the direct route whenever it's also feasible, so a detour is only ever selected because it's genuinely needed. */
const DETOUR_SCORE_PENALTY_METERS = 500;
/** Deterministic, fixed detour magnitudes (degrees) — not configurable; a real path-planner (Phase 11+) replaces this whole candidate-generation step, not just its tuning. */
const DETOUR_OFFSETS_DEGREES = [0.01, -0.01, 0.02, -0.02];

/**
 * Deterministic, explainable v1 `RouteOptimizer` (blueprint Section T) —
 * generates a small, fixed set of candidate paths (the direct line plus a
 * handful of perpendicular detours), validates every one of them against
 * `GeofencingService.findRouteViolations()` — the *same* authoritative
 * check `MissionsService` already used pre-Phase-9, never a parallel
 * geofence engine — and scores the survivors by distance (a detour is
 * penalized so the direct route wins whenever it's also feasible). This is
 * intentionally not a real path-planning algorithm (A-star, RRT, visibility
 * graphs) — a handful of fixed detour shapes is what "heuristic,
 * deterministic, explainable" means for v1; a real planner is exactly what
 * Phase 11's ML/optimization upgrade would replace this class with, behind
 * the same `RouteOptimizer` interface.
 */
@Injectable()
export class HeuristicRouteOptimizer implements RouteOptimizer {
  constructor(
    private readonly geofencingService: GeofencingService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async optimize(input: RouteOptimizerInput): Promise<RouteOptimizationResult> {
    const drainPercentPerKm = this.configService.get("AI_BATTERY_DRAIN_PERCENT_PER_KM", { infer: true });
    const lowBatteryThreshold = this.configService.get("DRONE_LOW_BATTERY_THRESHOLD_PERCENT", { infer: true });
    const safetyMargin = this.configService.get("AI_BATTERY_SAFETY_MARGIN_PERCENT", { infer: true });
    const batteryIsAuthoritative = input.droneBatteryPercent !== undefined;
    const batteryForEstimate = input.droneBatteryPercent ?? 100;

    const rawCandidates = this.buildCandidates(input.origin, input.destination);
    const evaluated: RouteCandidateResult[] = [];
    const reasons: string[] = [];

    for (const candidate of rawCandidates) {
      const fullPoints: LatLng[] = [input.origin, ...candidate.waypoints, input.destination];
      const violations = await this.geofencingService.findRouteViolations(fullPoints);
      const distanceMeters = pathLengthMeters(fullPoints);
      const eta = estimateEta({
        distanceMeters,
        droneMaxSpeedMps: input.droneMaxSpeedMps,
        windSpeedMps: input.weather.windSpeedMps,
        weatherCondition: input.weather.condition,
        weatherSafetyLevel: input.weather.safetyLevel,
        now: new Date(0), // duration/confidence only — the wall-clock ETA itself is computed separately by ETAPredictor
      });
      const batteryFeasibility = evaluateBatteryFeasibility({
        batteryPercent: batteryForEstimate,
        distanceMeters,
        drainPercentPerKm,
        lowBatteryThresholdPercent: lowBatteryThreshold,
        safetyMarginPercent: safetyMargin,
      });

      evaluated.push({
        id: candidate.id,
        isDirect: candidate.isDirect,
        waypoints: candidate.waypoints,
        distanceMeters,
        durationSeconds: eta.durationSeconds,
        batteryFeasibility,
        geofenceCleared: violations.length === 0,
        geofenceViolationZoneNames: violations.map((v) => v.name),
      });
    }

    const feasible = evaluated.filter((c) => {
      if (!c.geofenceCleared) return false;
      if (batteryIsAuthoritative && c.batteryFeasibility.level === "INSUFFICIENT") return false;
      return true;
    });

    if (feasible.length === 0) {
      const blockedByGeofence = evaluated.filter((c) => !c.geofenceCleared);
      if (blockedByGeofence.length === evaluated.length) {
        const allZones = [...new Set(blockedByGeofence.flatMap((c) => c.geofenceViolationZoneNames))];
        reasons.push(`No candidate route avoids the restricted/no-fly zone(s): ${allZones.join(", ")}`);
      } else {
        reasons.push("No candidate route has sufficient battery reserve to safely return home");
      }
      return { selected: null, alternatives: evaluated, reasons };
    }

    const scored = feasible
      .map((c) => ({ candidate: c, compositeScore: c.distanceMeters + (c.isDirect ? 0 : DETOUR_SCORE_PENALTY_METERS) }))
      .sort((a, b) => a.compositeScore - b.compositeScore);

    const selected = scored[0]?.candidate ?? null;
    const alternatives = scored.slice(1).map((s) => s.candidate);

    if (selected) {
      reasons.push(
        selected.isDirect
          ? `Direct route selected — ${(selected.distanceMeters / 1000).toFixed(2)} km, no geofence conflicts`
          : `Direct route was blocked; selected detour "${selected.id}" — ${(selected.distanceMeters / 1000).toFixed(2)} km, avoids the restricted zone(s)`,
      );
      reasons.push(...selected.batteryFeasibility.reasons);
    }

    return { selected, alternatives, reasons };
  }

  private buildCandidates(origin: LatLng, destination: LatLng): Array<{ id: string; isDirect: boolean; waypoints: RouteCandidateResult["waypoints"] }> {
    const direct = buildStraightLineRoute(origin, destination);
    const candidates = [{ id: "direct", isDirect: true, waypoints: direct }];

    for (const offset of DETOUR_OFFSETS_DEGREES) {
      const label = `detour-${offset > 0 ? "a" : "b"}-${Math.abs(offset)}`;
      const detourPoints = buildOffsetDetour(origin, destination, offset);
      // buildOffsetDetour returns [origin, midpoint, destination]; Waypoint
      // rows exclude origin/destination, matching buildStraightLineRoute's shape.
      const midpoint = detourPoints[1];
      if (!midpoint) continue;
      candidates.push({ id: label, isDirect: false, waypoints: [{ lat: midpoint.lat, lng: midpoint.lng, altitudeMeters: CRUISE_ALTITUDE_METERS }] });
    }

    return candidates;
  }
}
