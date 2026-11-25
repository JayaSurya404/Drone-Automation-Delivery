import type { WeatherCondition } from "@prisma/client";
import type { LatLng } from "../../geofencing/geometry.util";
import type { WeatherSafetyLevel } from "../../weather/weather-safety.util";
import type { BatteryFeasibilityResult } from "../battery-feasibility.util";

export interface RouteOptimizerWeatherInput {
  windSpeedMps: number;
  condition: WeatherCondition;
  safetyLevel: WeatherSafetyLevel;
}

export interface RouteOptimizerInput {
  origin: LatLng;
  destination: LatLng;
  droneMaxSpeedMps: number;
  droneMaxRangeKm: number;
  /** Omit when no drone is assigned yet (mission creation) — battery then informs the estimate but is never a hard elimination filter, since the real drone isn't known yet. Provide it (the drone's live telemetry reading) for an in-flight reroute, where it's an authoritative filter — a route the assigned drone can't actually complete must never be selected. */
  droneBatteryPercent?: number;
  weather: RouteOptimizerWeatherInput;
}

export interface RouteCandidateResult {
  id: string;
  isDirect: boolean;
  /** Excludes origin/destination — the same shape `MissionsService` already writes into `Waypoint` rows. */
  waypoints: Array<{ lat: number; lng: number; altitudeMeters: number }>;
  distanceMeters: number;
  durationSeconds: number;
  batteryFeasibility: BatteryFeasibilityResult;
  geofenceCleared: boolean;
  geofenceViolationZoneNames: string[];
}

export interface RouteOptimizationResult {
  selected: RouteCandidateResult | null;
  alternatives: RouteCandidateResult[];
  reasons: string[];
}

/**
 * The `RouteOptimizer` adapter (blueprint Section T) — `AiService` is the
 * only caller, exactly like `MissionsService` is the only caller of
 * `DroneAdapter`. `HeuristicRouteOptimizer` is the v1, deterministic,
 * explainable implementation this phase ships; a future ML-refined
 * implementation (Phase 11+) would implement this same interface without
 * `MissionsService`/`AiService` changing at all.
 */
export interface RouteOptimizer {
  optimize(input: RouteOptimizerInput): Promise<RouteOptimizationResult>;
}

/** DI token — `ai.module.ts` binds this to `HeuristicRouteOptimizer` (the only implementation this phase ships). */
export const ROUTE_OPTIMIZER = Symbol("ROUTE_OPTIMIZER");
