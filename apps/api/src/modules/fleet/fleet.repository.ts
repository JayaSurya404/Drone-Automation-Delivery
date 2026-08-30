import type { Kysely } from "kysely";
import type { Database, DroneTable } from "../../infrastructure/db/schema.js";

export type DroneRecord = {
  id: string;
  organization_id: string;
  model_id: string | null;
  call_sign: string;
  model: string;
  serial_number: string | null;
  status: string;
  battery_percent: number;
  max_payload_grams: number;
  current_latitude: number;
  current_longitude: number;
  current_altitude_meters: number;
  home_latitude: number;
  home_longitude: number;
  home_altitude_meters: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type NewDroneRecord = Omit<DroneRecord, "created_at" | "updated_at">;
export type DroneUpdateRecord = Partial<Omit<DroneRecord, "id" | "organization_id" | "created_at">>;

export interface ListDronesFilter {
  organizationId: string;
  status?: string;
  isActive?: boolean;
  limit: number;
  offset: number;
}

import type { FleetSummaryResponse } from "@skynav/contracts";

export interface FleetRepository {
  create(drone: NewDroneRecord): Promise<DroneRecord>;
  findById(id: string, organizationId: string): Promise<DroneRecord | null>;
  findByCallSign(callSign: string, organizationId: string): Promise<DroneRecord | null>;
  update(id: string, organizationId: string, updates: DroneUpdateRecord): Promise<DroneRecord | null>;
  reserveForMission(id: string, organizationId: string): Promise<DroneRecord | null>;
  list(filter: ListDronesFilter): Promise<{ drones: DroneRecord[]; total: number }>;
  getSummary(organizationId: string): Promise<FleetSummaryResponse>;
}

export function createFleetRepository(db: Kysely<Database>): FleetRepository {
  return {
    async create(drone: NewDroneRecord): Promise<DroneRecord> {
      const result = await db
        .insertInto("drones")
        .values({
          ...drone,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return result as DroneRecord;
    },

    async findById(id: string, organizationId: string): Promise<DroneRecord | null> {
      const result = await db
        .selectFrom("drones")
        .selectAll()
        .where("id", "=", id)
        .where("organization_id", "=", organizationId)
        .executeTakeFirst();

      return (result as DroneRecord) ?? null;
    },

    async findByCallSign(callSign: string, organizationId: string): Promise<DroneRecord | null> {
      const result = await db
        .selectFrom("drones")
        .selectAll()
        .where("call_sign", "=", callSign)
        .where("organization_id", "=", organizationId)
        .executeTakeFirst();

      return (result as DroneRecord) ?? null;
    },

    async update(id: string, organizationId: string, updates: DroneUpdateRecord): Promise<DroneRecord | null> {
      const result = await db
        .updateTable("drones")
        .set({
          ...updates,
          updated_at: new Date()
        })
        .where("id", "=", id)
        .where("organization_id", "=", organizationId)
        .returningAll()
        .executeTakeFirst();

      return (result as DroneRecord) ?? null;
    },

    async reserveForMission(id: string, organizationId: string): Promise<DroneRecord | null> {
      // Atomic conditional update ensuring drone is currently idle/available and active
      const result = await db
        .updateTable("drones")
        .set({
          status: "ASSIGNED",
          updated_at: new Date()
        })
        .where("id", "=", id)
        .where("organization_id", "=", organizationId)
        .where("is_active", "=", true)
        .where("status", "in", ["IDLE", "AVAILABLE"])
        .returningAll()
        .executeTakeFirst();

      return (result as DroneRecord) ?? null;
    },

    async list(filter: ListDronesFilter): Promise<{ drones: DroneRecord[]; total: number }> {
      let baseQuery = db
        .selectFrom("drones")
        .where("organization_id", "=", filter.organizationId);

      if (filter.status) {
        baseQuery = baseQuery.where("status", "=", filter.status);
      }

      if (filter.isActive !== undefined) {
        baseQuery = baseQuery.where("is_active", "=", filter.isActive);
      }

      const countResult = await baseQuery
        .select((eb) => eb.fn.count<string>("id").as("total"))
        .executeTakeFirst();

      const total = countResult ? parseInt(countResult.total, 10) : 0;

      const rows = await baseQuery
        .selectAll()
        .orderBy("created_at", "desc")
        .limit(filter.limit)
        .offset(filter.offset)
        .execute();

      return {
        drones: rows as DroneRecord[],
        total
      };
    },

    async getSummary(organizationId: string): Promise<FleetSummaryResponse> {
      const rows = (await db
        .selectFrom("drones")
        .selectAll()
        .where("organization_id", "=", organizationId)
        .execute()) as DroneRecord[];

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
