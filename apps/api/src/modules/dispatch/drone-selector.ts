import type { FleetRepository, DroneRecord } from "../fleet/fleet.repository.js";
import type { Coordinate } from "@skynav/contracts";

export interface DroneSelectionCriteria {
  organizationId: string;
  packageWeightGrams: number;
  origin?: Coordinate;
  minBatteryPercent?: number;
}

export class NoAvailableDroneError extends Error {
  public readonly code = "NO_AVAILABLE_DRONE";
  constructor(message = "No available drone in the fleet meets the payload and battery criteria for dispatch.") {
    super(message);
    this.name = "NoAvailableDroneError";
  }
}

export interface DroneSelector {
  selectOptimalDrone(criteria: DroneSelectionCriteria): Promise<DroneRecord>;
}

export function createDroneSelector(fleetRepo: FleetRepository): DroneSelector {
  return {
    async selectOptimalDrone(criteria: DroneSelectionCriteria): Promise<DroneRecord> {
      const minBattery = criteria.minBatteryPercent ?? 30;

      // 1. Fetch available drones for organization
      const { drones } = await fleetRepo.list({
        organizationId: criteria.organizationId,
        isActive: true,
        limit: 100,
        offset: 0
      });

      // 2. Filter eligible drones
      const eligible = drones.filter((drone) => {
        const isIdleOrAvailable = drone.status === "IDLE" || drone.status === "AVAILABLE";
        const hasSufficientBattery = drone.battery_percent >= minBattery;
        const hasPayloadCapacity = drone.max_payload_grams >= criteria.packageWeightGrams;
        return isIdleOrAvailable && hasSufficientBattery && hasPayloadCapacity;
      });

      if (eligible.length === 0) {
        throw new NoAvailableDroneError(
          `No drone in organization '${criteria.organizationId}' is currently available with >= ${minBattery}% battery and >= ${criteria.packageWeightGrams}g payload capacity.`
        );
      }

      // 3. Deterministic ranking:
      // Sort by:
      // a) Battery percent DESC (highest battery preferred)
      // b) Call sign ASC (deterministic tiebreaker)
      eligible.sort((a, b) => {
        if (b.battery_percent !== a.battery_percent) {
          return b.battery_percent - a.battery_percent;
        }
        return a.call_sign.localeCompare(b.call_sign);
      });

      return eligible[0];
    }
  };
}
