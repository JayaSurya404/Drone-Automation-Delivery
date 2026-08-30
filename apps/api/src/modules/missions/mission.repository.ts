import type { Kysely } from "kysely";
import type { Database } from "../../infrastructure/db/schema.js";
import type { DroneRecord } from "../fleet/fleet.repository.js";
import type { OrderRecord } from "../orders/order.repository.js";
import { canAssignDroneToMission, InvalidMissionStateTransitionError } from "./mission.state-machine.js";
import { DroneNotFoundError, DroneNotAvailableError } from "../fleet/fleet.service.js";
import { OrderNotFoundError } from "../orders/order.service.js";

export type MissionRecord = {
  id: string;
  mission_number: string;
  organization_id: string;
  drone_id: string | null;
  order_id: string;
  status: string;
  origin_latitude: number;
  origin_longitude: number;
  origin_altitude_meters: number | null;
  origin_address: string | null;
  destination_latitude: number;
  destination_longitude: number;
  destination_altitude_meters: number | null;
  destination_address: string | null;
  assigned_at: Date | null;
  launched_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  failed_at: Date | null;
  failure_reason: string | null;
  emergency_at: Date | null;
  emergency_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export type NewMissionRecord = {
  id: string;
  mission_number: string;
  organization_id: string;
  order_id: string;
  drone_id?: string | null;
  status: string;
  origin_latitude: number;
  origin_longitude: number;
  origin_altitude_meters?: number | null;
  origin_address?: string | null;
  destination_latitude: number;
  destination_longitude: number;
  destination_altitude_meters?: number | null;
  destination_address?: string | null;
  assigned_at?: Date | null;
  launched_at?: Date | null;
  completed_at?: Date | null;
  cancelled_at?: Date | null;
  cancellation_reason?: string | null;
  failed_at?: Date | null;
  failure_reason?: string | null;
  emergency_at?: Date | null;
  emergency_reason?: string | null;
};
export type MissionUpdateRecord = Partial<Omit<MissionRecord, "id" | "organization_id" | "created_at">>;

export interface ListMissionsFilter {
  organizationId: string;
  status?: string;
  orderId?: string;
  droneId?: string;
  limit: number;
  offset: number;
}

export interface MissionRepository {
  create(mission: NewMissionRecord): Promise<MissionRecord>;
  findById(id: string, organizationId: string): Promise<MissionRecord | null>;
  findActiveByOrderId(orderId: string, organizationId: string): Promise<MissionRecord | null>;
  update(id: string, organizationId: string, updates: MissionUpdateRecord): Promise<MissionRecord | null>;
  assignDroneAtomically(params: {
    missionId: string;
    droneId: string;
    organizationId: string;
  }): Promise<{ mission: MissionRecord; drone: DroneRecord; order: OrderRecord }>;
  list(filter: ListMissionsFilter): Promise<{ missions: MissionRecord[]; total: number }>;
}

export class MissionNotFoundError extends Error {
  public readonly code = "MISSION_NOT_FOUND";
  constructor(missionId: string) {
    super(`Mission with ID '${missionId}' was not found in this organization.`);
    this.name = "MissionNotFoundError";
  }
}

export function createMissionRepository(db: Kysely<Database>): MissionRepository {
  return {
    async create(mission: NewMissionRecord): Promise<MissionRecord> {
      const result = await db
        .insertInto("missions")
        .values({
          id: mission.id,
          mission_number: mission.mission_number,
          organization_id: mission.organization_id,
          order_id: mission.order_id,
          drone_id: mission.drone_id ?? null,
          status: mission.status,
          origin_latitude: mission.origin_latitude,
          origin_longitude: mission.origin_longitude,
          origin_altitude_meters: mission.origin_altitude_meters ?? null,
          origin_address: mission.origin_address ?? null,
          destination_latitude: mission.destination_latitude,
          destination_longitude: mission.destination_longitude,
          destination_altitude_meters: mission.destination_altitude_meters ?? null,
          destination_address: mission.destination_address ?? null,
          assigned_at: mission.assigned_at ?? null,
          launched_at: mission.launched_at ?? null,
          completed_at: mission.completed_at ?? null,
          cancelled_at: mission.cancelled_at ?? null,
          cancellation_reason: mission.cancellation_reason ?? null,
          failed_at: mission.failed_at ?? null,
          failure_reason: mission.failure_reason ?? null,
          emergency_at: mission.emergency_at ?? null,
          emergency_reason: mission.emergency_reason ?? null,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return result as MissionRecord;
    },

    async findById(id: string, organizationId: string): Promise<MissionRecord | null> {
      const result = await db
        .selectFrom("missions")
        .selectAll()
        .where("id", "=", id)
        .where("organization_id", "=", organizationId)
        .executeTakeFirst();

      return (result as MissionRecord) ?? null;
    },

    async findActiveByOrderId(orderId: string, organizationId: string): Promise<MissionRecord | null> {
      const result = await db
        .selectFrom("missions")
        .selectAll()
        .where("order_id", "=", orderId)
        .where("organization_id", "=", organizationId)
        .where("status", "not in", ["COMPLETED", "CANCELLED", "FAILED", "ABORTED"])
        .executeTakeFirst();

      return (result as MissionRecord) ?? null;
    },

    async update(id: string, organizationId: string, updates: MissionUpdateRecord): Promise<MissionRecord | null> {
      const result = await db
        .updateTable("missions")
        .set({
          ...updates,
          updated_at: new Date()
        })
        .where("id", "=", id)
        .where("organization_id", "=", organizationId)
        .returningAll()
        .executeTakeFirst();

      return (result as MissionRecord) ?? null;
    },

    async assignDroneAtomically(params: {
      missionId: string;
      droneId: string;
      organizationId: string;
    }): Promise<{ mission: MissionRecord; drone: DroneRecord; order: OrderRecord }> {
      return await db.transaction().execute(async (trx) => {
        // 1. Lock and verify mission
        const mission = await trx
          .selectFrom("missions")
          .selectAll()
          .where("id", "=", params.missionId)
          .where("organization_id", "=", params.organizationId)
          .forUpdate()
          .executeTakeFirst();

        if (!mission) {
          throw new MissionNotFoundError(params.missionId);
        }

        if (!canAssignDroneToMission(mission.status as any)) {
          throw new InvalidMissionStateTransitionError(mission.status as any, "ASSIGNED");
        }

        // 2. Lock and verify drone
        const drone = await trx
          .selectFrom("drones")
          .selectAll()
          .where("id", "=", params.droneId)
          .where("organization_id", "=", params.organizationId)
          .forUpdate()
          .executeTakeFirst();

        if (!drone) {
          throw new DroneNotFoundError(params.droneId);
        }

        if (!drone.is_active || !["IDLE", "AVAILABLE"].includes(drone.status)) {
          throw new DroneNotAvailableError(params.droneId, `Drone '${drone.call_sign}' is not available for assignment (status: ${drone.status}).`);
        }

        // 3. Lock and verify order
        const order = await trx
          .selectFrom("orders")
          .selectAll()
          .where("id", "=", mission.order_id)
          .where("organization_id", "=", params.organizationId)
          .forUpdate()
          .executeTakeFirst();

        if (!order) {
          throw new OrderNotFoundError(mission.order_id);
        }

        const now = new Date();

        // 4. Update drone
        const updatedDrone = await trx
          .updateTable("drones")
          .set({
            status: "ASSIGNED",
            updated_at: now
          })
          .where("id", "=", params.droneId)
          .where("organization_id", "=", params.organizationId)
          .returningAll()
          .executeTakeFirstOrThrow();

        // 5. Update mission
        const updatedMission = await trx
          .updateTable("missions")
          .set({
            drone_id: params.droneId,
            status: "ASSIGNED",
            assigned_at: now,
            updated_at: now
          })
          .where("id", "=", params.missionId)
          .where("organization_id", "=", params.organizationId)
          .returningAll()
          .executeTakeFirstOrThrow();

        // 6. Update order
        const updatedOrder = await trx
          .updateTable("orders")
          .set({
            status: "ASSIGNED",
            assigned_at: now,
            updated_at: now
          })
          .where("id", "=", mission.order_id)
          .where("organization_id", "=", params.organizationId)
          .returningAll()
          .executeTakeFirstOrThrow();

        return {
          mission: updatedMission as MissionRecord,
          drone: updatedDrone as DroneRecord,
          order: updatedOrder as OrderRecord
        };
      });
    },

    async list(filter: ListMissionsFilter): Promise<{ missions: MissionRecord[]; total: number }> {
      let baseQuery = db
        .selectFrom("missions")
        .where("organization_id", "=", filter.organizationId);

      if (filter.status) {
        baseQuery = baseQuery.where("status", "=", filter.status);
      }

      if (filter.orderId) {
        baseQuery = baseQuery.where("order_id", "=", filter.orderId);
      }

      if (filter.droneId) {
        baseQuery = baseQuery.where("drone_id", "=", filter.droneId);
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
        missions: rows as MissionRecord[],
        total
      };
    }
  };
}
