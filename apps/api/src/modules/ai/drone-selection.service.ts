import { Injectable } from "@nestjs/common";
import { DronesService, type DroneView } from "../drones/drones.service";
import type { LatLng } from "../geofencing/geometry.util";
import { BatteryAwareRouterService } from "./battery-aware-router.service";
import { rankDroneCandidates, type DroneRankingResult } from "./drone-selection.util";
import { haversineMeters } from "./route-geo.util";

export interface DroneRecommendationInput {
  origin: LatLng;
  distanceMeters: number;
  payloadKg: number;
  hubId?: string;
}

/**
 * The `FleetAllocator`/drone-selection capability from blueprint Section T
 * — ranks currently-eligible drones (`DronesService.listAvailable()`,
 * the same authoritative IDLE/non-maintenance filter every other admin
 * view already uses) for a specific mission's route. Read-only: it never
 * assigns a drone itself — `MissionsService.assignDrone()` (existing,
 * unchanged) is still the only place a drone actually gets assigned, kept
 * a deliberate human action per the phase-09 "do not automatically
 * override operator controls" instruction. This is a recommendation an
 * operator can act on, not an autonomous decision.
 */
@Injectable()
export class DroneSelectionService {
  constructor(
    private readonly dronesService: DronesService,
    private readonly batteryAwareRouter: BatteryAwareRouterService,
  ) {}

  async recommend(input: DroneRecommendationInput): Promise<DroneRankingResult[]> {
    const candidates = await this.dronesService.listAvailable(input.hubId);
    const scored = candidates.map((drone: DroneView) => {
      const distanceFromOriginMeters =
        drone.currentLat != null && drone.currentLng != null ? haversineMeters(input.origin, { lat: drone.currentLat, lng: drone.currentLng }) : input.distanceMeters;
      const feasibility = this.batteryAwareRouter.evaluate(drone.batteryPercent, input.distanceMeters);
      return {
        droneId: drone.id,
        droneName: drone.name,
        batteryPercent: drone.batteryPercent,
        batteryHealthPercent: drone.batteryHealthPercent,
        maxPayloadKg: drone.maxPayloadKg,
        distanceFromOriginMeters,
        droneMaxRangeKm: drone.maxRangeKm,
        batteryFeasibilityLevel: feasibility.level,
        payloadKg: input.payloadKg,
      };
    });
    return rankDroneCandidates(scored);
  }
}
