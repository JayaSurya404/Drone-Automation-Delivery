import type {
  MissionRepository,
  MissionRecord,
  NewMissionRecord,
  MissionUpdateRecord,
  ListMissionsFilter
} from "../mission.repository.js";
import { MissionNotFoundError } from "../mission.repository.js";
import type { FleetRepository, DroneRecord } from "../../fleet/fleet.repository.js";
import type { OrderRepository, OrderRecord } from "../../orders/order.repository.js";
import { canAssignDroneToMission, InvalidMissionStateTransitionError } from "../mission.state-machine.js";
import { DroneNotFoundError, DroneNotAvailableError } from "../../fleet/fleet.service.js";
import { OrderNotFoundError } from "../../orders/order.service.js";

export function createMockMissionRepository(
  fleetRepo?: FleetRepository,
  orderRepo?: OrderRepository,
  initialMissions: MissionRecord[] = []
): MissionRepository {
  const missions = new Map<string, MissionRecord>();

  for (const mission of initialMissions) {
    missions.set(mission.id, { ...mission });
  }

  return {
    async create(mission: NewMissionRecord): Promise<MissionRecord> {
      const now = new Date();
      const record: MissionRecord = {
        id: mission.id,
        mission_number: mission.mission_number,
        organization_id: mission.organization_id,
        drone_id: mission.drone_id ?? null,
        order_id: mission.order_id,
        status: mission.status,
        origin_latitude: mission.origin_latitude,
        origin_longitude: mission.origin_longitude,
        origin_altitude_meters: mission.origin_altitude_meters ?? 0,
        origin_address: mission.origin_address ?? null,
        destination_latitude: mission.destination_latitude,
        destination_longitude: mission.destination_longitude,
        destination_altitude_meters: mission.destination_altitude_meters ?? 0,
        destination_address: mission.destination_address ?? null,
        assigned_at: mission.assigned_at ? new Date(mission.assigned_at as any) : null,
        launched_at: mission.launched_at ? new Date(mission.launched_at as any) : null,
        completed_at: mission.completed_at ? new Date(mission.completed_at as any) : null,
        cancelled_at: mission.cancelled_at ? new Date(mission.cancelled_at as any) : null,
        cancellation_reason: mission.cancellation_reason ?? null,
        failed_at: mission.failed_at ? new Date(mission.failed_at as any) : null,
        failure_reason: mission.failure_reason ?? null,
        emergency_at: mission.emergency_at ? new Date(mission.emergency_at as any) : null,
        emergency_reason: mission.emergency_reason ?? null,
        created_at: now,
        updated_at: now
      };

      missions.set(record.id, record);
      return { ...record };
    },

    async findById(id: string, organizationId: string): Promise<MissionRecord | null> {
      const mission = missions.get(id);
      if (!mission || mission.organization_id !== organizationId) {
        return null;
      }
      return { ...mission };
    },

    async findActiveByOrderId(orderId: string, organizationId: string): Promise<MissionRecord | null> {
      for (const mission of missions.values()) {
        if (
          mission.order_id === orderId &&
          mission.organization_id === organizationId &&
          !["COMPLETED", "CANCELLED", "FAILED", "ABORTED"].includes(mission.status)
        ) {
          return { ...mission };
        }
      }
      return null;
    },

    async update(id: string, organizationId: string, updates: MissionUpdateRecord): Promise<MissionRecord | null> {
      const mission = missions.get(id);
      if (!mission || mission.organization_id !== organizationId) {
        return null;
      }

      const updated: MissionRecord = {
        ...mission,
        ...updates,
        assigned_at: updates.assigned_at !== undefined ? (updates.assigned_at ? new Date(updates.assigned_at as any) : null) : mission.assigned_at,
        launched_at: updates.launched_at !== undefined ? (updates.launched_at ? new Date(updates.launched_at as any) : null) : mission.launched_at,
        completed_at: updates.completed_at !== undefined ? (updates.completed_at ? new Date(updates.completed_at as any) : null) : mission.completed_at,
        cancelled_at: updates.cancelled_at !== undefined ? (updates.cancelled_at ? new Date(updates.cancelled_at as any) : null) : mission.cancelled_at,
        failed_at: updates.failed_at !== undefined ? (updates.failed_at ? new Date(updates.failed_at as any) : null) : mission.failed_at,
        emergency_at: updates.emergency_at !== undefined ? (updates.emergency_at ? new Date(updates.emergency_at as any) : null) : mission.emergency_at,
        updated_at: new Date()
      };

      missions.set(id, updated);
      return { ...updated };
    },

    async assignDroneAtomically(params: {
      missionId: string;
      droneId: string;
      organizationId: string;
    }): Promise<{ mission: MissionRecord; drone: DroneRecord; order: OrderRecord }> {
      const mission = missions.get(params.missionId);
      if (!mission || mission.organization_id !== params.organizationId) {
        throw new MissionNotFoundError(params.missionId);
      }

      if (!canAssignDroneToMission(mission.status as any)) {
        throw new InvalidMissionStateTransitionError(mission.status as any, "ASSIGNED");
      }

      if (!fleetRepo || !orderRepo) {
        throw new Error("Fleet and Order repositories must be provided to mock mission repository for assignment.");
      }

      const drone = await fleetRepo.findById(params.droneId, params.organizationId);
      if (!drone) {
        throw new DroneNotFoundError(params.droneId);
      }

      if (!drone.is_active || !["IDLE", "AVAILABLE"].includes(drone.status)) {
        throw new DroneNotAvailableError(params.droneId, `Drone '${drone.call_sign}' is not available for assignment (status: ${drone.status}).`);
      }

      const order = await orderRepo.findById(mission.order_id, params.organizationId);
      if (!order) {
        throw new OrderNotFoundError(mission.order_id);
      }

      const now = new Date();

      // Update drone atomically
      const updatedDrone = await fleetRepo.update(params.droneId, params.organizationId, {
        status: "ASSIGNED"
      });

      // Update mission atomically
      const updatedMission: MissionRecord = {
        ...mission,
        drone_id: params.droneId,
        status: "ASSIGNED",
        assigned_at: now,
        updated_at: now
      };
      missions.set(params.missionId, updatedMission);

      // Update order atomically
      const updatedOrder = await orderRepo.update(mission.order_id, params.organizationId, {
        status: "ASSIGNED",
        assigned_at: now
      });

      return {
        mission: { ...updatedMission },
        drone: updatedDrone!,
        order: updatedOrder!
      };
    },

    async list(filter: ListMissionsFilter): Promise<{ missions: MissionRecord[]; total: number }> {
      let result = Array.from(missions.values()).filter(
        (m) => m.organization_id === filter.organizationId
      );

      if (filter.status) {
        result = result.filter((m) => m.status === filter.status);
      }

      if (filter.orderId) {
        result = result.filter((m) => m.order_id === filter.orderId);
      }

      if (filter.droneId) {
        result = result.filter((m) => m.drone_id === filter.droneId);
      }

      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const total = result.length;
      const paginated = result.slice(filter.offset, filter.offset + filter.limit);

      return {
        missions: paginated.map((m) => ({ ...m })),
        total
      };
    }
  };
}
