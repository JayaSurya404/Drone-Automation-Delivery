import type {
  FleetRepository,
  DroneRecord,
  NewDroneRecord,
  DroneUpdateRecord,
  ListDronesFilter
} from "../fleet.repository.js";

export function createMockFleetRepository(initialDrones: DroneRecord[] = []): FleetRepository {
  const drones = new Map<string, DroneRecord>();

  for (const drone of initialDrones) {
    drones.set(drone.id, { ...drone });
  }

  return {
    async create(drone: NewDroneRecord): Promise<DroneRecord> {
      const now = new Date();
      const record: DroneRecord = {
        id: drone.id,
        organization_id: drone.organization_id,
        model_id: drone.model_id ?? null,
        call_sign: drone.call_sign,
        model: drone.model,
        serial_number: drone.serial_number ?? null,
        status: drone.status,
        battery_percent: drone.battery_percent,
        max_payload_grams: drone.max_payload_grams,
        current_latitude: drone.current_latitude,
        current_longitude: drone.current_longitude,
        current_altitude_meters: drone.current_altitude_meters,
        home_latitude: drone.home_latitude,
        home_longitude: drone.home_longitude,
        home_altitude_meters: drone.home_altitude_meters,
        is_active: drone.is_active,
        created_at: now,
        updated_at: now
      };

      drones.set(record.id, record);
      return { ...record };
    },

    async findById(id: string, organizationId: string): Promise<DroneRecord | null> {
      const drone = drones.get(id);
      if (!drone || drone.organization_id !== organizationId) {
        return null;
      }
      return { ...drone };
    },

    async findByCallSign(callSign: string, organizationId: string): Promise<DroneRecord | null> {
      for (const drone of drones.values()) {
        if (drone.call_sign === callSign && drone.organization_id === organizationId) {
          return { ...drone };
        }
      }
      return null;
    },

    async update(id: string, organizationId: string, updates: DroneUpdateRecord): Promise<DroneRecord | null> {
      const drone = drones.get(id);
      if (!drone || drone.organization_id !== organizationId) {
        return null;
      }

      const updated: DroneRecord = {
        ...drone,
        ...updates,
        updated_at: new Date()
      };

      drones.set(id, updated);
      return { ...updated };
    },

    async reserveForMission(id: string, organizationId: string): Promise<DroneRecord | null> {
      const drone = drones.get(id);
      if (
        !drone ||
        drone.organization_id !== organizationId ||
        !drone.is_active ||
        (drone.status !== "IDLE" && drone.status !== "AVAILABLE")
      ) {
        return null;
      }

      const updated: DroneRecord = {
        ...drone,
        status: "ASSIGNED",
        updated_at: new Date()
      };

      drones.set(id, updated);
      return { ...updated };
    },

    async list(filter: ListDronesFilter): Promise<{ drones: DroneRecord[]; total: number }> {
      let result = Array.from(drones.values()).filter(
        (d) => d.organization_id === filter.organizationId
      );

      if (filter.status) {
        result = result.filter((d) => d.status === filter.status);
      }

      if (filter.isActive !== undefined) {
        result = result.filter((d) => d.is_active === filter.isActive);
      }

      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const total = result.length;
      const paginated = result.slice(filter.offset, filter.offset + filter.limit);

      return {
        drones: paginated.map((d) => ({ ...d })),
        total
      };
    },

    async getSummary(organizationId: string) {
      const rows = Array.from(drones.values()).filter((d) => d.organization_id === organizationId);

      let availableDrones = 0;
      let assignedDrones = 0;
      let inFlightDrones = 0;
      let deliveringDrones = 0;
      let returningDrones = 0;
      let emergencyDrones = 0;
      let offlineDrones = 0;
      let lowBatteryDrones = 0;
      let criticalBatteryDrones = 0;

      for (const d of rows) {
        if (!d.is_active || d.status === "OFFLINE") {
          offlineDrones++;
        } else if (d.status === "EMERGENCY") {
          emergencyDrones++;
        } else if (d.status === "AVAILABLE" || d.status === "IDLE") {
          availableDrones++;
        } else if (d.status === "ASSIGNED") {
          assignedDrones++;
        } else if (
          d.status === "TAKEOFF" ||
          d.status === "EN_ROUTE" ||
          d.status === "IN_FLIGHT" ||
          d.status === "ARRIVED"
        ) {
          inFlightDrones++;
        } else if (d.status === "DELIVERING") {
          deliveringDrones++;
        } else if (d.status === "RETURNING") {
          returningDrones++;
        }

        if (d.battery_percent < 30) {
          lowBatteryDrones++;
        }
        if (d.battery_percent < 15) {
          criticalBatteryDrones++;
        }
      }

      return {
        organizationId,
        totalDrones: rows.length,
        availableDrones,
        assignedDrones,
        inFlightDrones,
        deliveringDrones,
        returningDrones,
        emergencyDrones,
        offlineDrones,
        lowBatteryDrones,
        criticalBatteryDrones,
        timestamp: new Date().toISOString()
      };
    }
  };
}
