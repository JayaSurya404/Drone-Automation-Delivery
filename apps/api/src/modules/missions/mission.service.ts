import crypto from "node:crypto";
import type {
  AuthenticatedUser,
  CreateMissionRequest,
  UpdateMissionStatusRequest,
  MissionResponse,
  MissionListQuery,
  MissionListResponse,
  MissionStatus
} from "@skynav/contracts";
import type { MissionRepository, MissionRecord, MissionUpdateRecord } from "./mission.repository.js";
import { MissionNotFoundError } from "./mission.repository.js";
import type { OrderRepository } from "../orders/order.repository.js";
import { OrderNotFoundError } from "../orders/order.service.js";
import type { FleetRepository } from "../fleet/fleet.repository.js";
import type { SimulatorGateway } from "./simulator.adapter.js";
import type { AuditService } from "../audit/audit.service.js";
import { validateMissionStateTransition } from "./mission.state-machine.js";

export class DuplicateActiveMissionError extends Error {
  public readonly code = "DUPLICATE_ACTIVE_MISSION";
  constructor(orderId: string) {
    super(`An active delivery mission already exists for order '${orderId}'.`);
    this.name = "DuplicateActiveMissionError";
  }
}

export class MissionForbiddenError extends Error {
  public readonly code = "MISSION_FORBIDDEN";
  constructor(message: string) {
    super(message);
    this.name = "MissionForbiddenError";
  }
}

export interface MissionService {
  createMission(user: AuthenticatedUser, input: CreateMissionRequest): Promise<MissionResponse>;
  getMission(user: AuthenticatedUser, missionId: string): Promise<MissionResponse>;
  assignDrone(user: AuthenticatedUser, missionId: string, droneId: string): Promise<MissionResponse>;
  updateMissionStatus(
    user: AuthenticatedUser,
    missionId: string,
    input: UpdateMissionStatusRequest
  ): Promise<MissionResponse>;
  listMissions(user: AuthenticatedUser, query: MissionListQuery): Promise<MissionListResponse>;
}

import type { OutboxRepository } from "../events/outbox.repository.js";

export function createMissionService(
  missionRepo: MissionRepository,
  orderRepo: OrderRepository,
  fleetRepo: FleetRepository,
  simulatorGateway: SimulatorGateway,
  auditService: AuditService,
  outboxRepo?: OutboxRepository
): MissionService {
  function generateMissionNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `MSN-${timestamp}-${random}`;
  }

  function mapRecordToResponse(record: MissionRecord): MissionResponse {
    return {
      id: record.id,
      missionNumber: record.mission_number,
      organizationId: record.organization_id,
      orderId: record.order_id,
      droneId: record.drone_id ?? null,
      status: record.status as MissionStatus,
      origin: {
        latitude: record.origin_latitude,
        longitude: record.origin_longitude,
        altitudeMeters: record.origin_altitude_meters ?? 0,
        address: record.origin_address ?? undefined
      },
      destination: {
        latitude: record.destination_latitude,
        longitude: record.destination_longitude,
        altitudeMeters: record.destination_altitude_meters ?? 0,
        address: record.destination_address ?? undefined
      },
      assignedAt: record.assigned_at ? (record.assigned_at instanceof Date ? record.assigned_at.toISOString() : new Date(record.assigned_at).toISOString()) : null,
      launchedAt: record.launched_at ? (record.launched_at instanceof Date ? record.launched_at.toISOString() : new Date(record.launched_at).toISOString()) : null,
      completedAt: record.completed_at ? (record.completed_at instanceof Date ? record.completed_at.toISOString() : new Date(record.completed_at).toISOString()) : null,
      cancelledAt: record.cancelled_at ? (record.cancelled_at instanceof Date ? record.cancelled_at.toISOString() : new Date(record.cancelled_at).toISOString()) : null,
      cancellationReason: record.cancellation_reason ?? null,
      failedAt: record.failed_at ? (record.failed_at instanceof Date ? record.failed_at.toISOString() : new Date(record.failed_at).toISOString()) : null,
      failureReason: record.failure_reason ?? null,
      emergencyAt: record.emergency_at ? (record.emergency_at instanceof Date ? record.emergency_at.toISOString() : new Date(record.emergency_at).toISOString()) : null,
      emergencyReason: record.emergency_reason ?? null,
      createdAt: record.created_at instanceof Date ? record.created_at.toISOString() : new Date(record.created_at).toISOString(),
      updatedAt: record.updated_at instanceof Date ? record.updated_at.toISOString() : new Date(record.updated_at).toISOString()
    };
  }

  return {
    async createMission(user: AuthenticatedUser, input: CreateMissionRequest): Promise<MissionResponse> {
      // 1. Verify order exists in the organization
      const order = await orderRepo.findById(input.orderId, user.organizationId);
      if (!order) {
        throw new OrderNotFoundError(input.orderId);
      }

      // 2. Verify no existing active non-terminal mission exists for this order
      const existingActive = await missionRepo.findActiveByOrderId(input.orderId, user.organizationId);
      if (existingActive) {
        throw new DuplicateActiveMissionError(input.orderId);
      }

      const missionId = crypto.randomUUID();
      const missionNumber = generateMissionNumber();

      const newRecord = await missionRepo.create({
        id: missionId,
        mission_number: missionNumber,
        organization_id: user.organizationId,
        order_id: input.orderId,
        drone_id: null,
        status: "PENDING",
        origin_latitude: input.origin?.latitude ?? order.pickup_latitude,
        origin_longitude: input.origin?.longitude ?? order.pickup_longitude,
        origin_altitude_meters: input.origin?.altitudeMeters ?? order.pickup_altitude_meters,
        origin_address: input.origin?.address ?? order.pickup_address,
        destination_latitude: input.destination?.latitude ?? order.delivery_latitude,
        destination_longitude: input.destination?.longitude ?? order.delivery_longitude,
        destination_altitude_meters: input.destination?.altitudeMeters ?? order.delivery_altitude_meters,
        destination_address: input.destination?.address ?? order.delivery_address,
        assigned_at: null,
        launched_at: null,
        completed_at: null,
        cancelled_at: null,
        cancellation_reason: null,
        failed_at: null,
        failure_reason: null,
        emergency_at: null,
        emergency_reason: null
      });

      if (outboxRepo) {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType: "MISSION_CREATED",
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "MISSION",
          aggregateId: missionId,
          actorId: user.id,
          payload: {
            missionNumber,
            orderId: input.orderId,
            customerId: order.customer_id
          }
        });
      }

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "MISSION_CREATED",
        resourceType: "mission",
        resourceId: missionId,
        metadata: {
          missionNumber,
          orderId: input.orderId
        }
      });

      return mapRecordToResponse(newRecord);
    },

    async getMission(user: AuthenticatedUser, missionId: string): Promise<MissionResponse> {
      const mission = await missionRepo.findById(missionId, user.organizationId);
      if (!mission) {
        throw new MissionNotFoundError(missionId);
      }
      return mapRecordToResponse(mission);
    },

    async assignDrone(
      user: AuthenticatedUser,
      missionId: string,
      droneId: string
    ): Promise<MissionResponse> {
      // Execute atomic transaction for mission, drone, and order
      const { mission, drone, order } = await missionRepo.assignDroneAtomically({
        missionId,
        droneId,
        organizationId: user.organizationId
      });

      // Notify Simulator Gateway boundary
      await simulatorGateway.assignMission({
        missionId: mission.id,
        organizationId: user.organizationId,
        droneId: drone.id,
        origin: {
          latitude: mission.origin_latitude,
          longitude: mission.origin_longitude,
          altitudeMeters: mission.origin_altitude_meters ?? 0
        },
        destination: {
          latitude: mission.destination_latitude,
          longitude: mission.destination_longitude,
          altitudeMeters: mission.destination_altitude_meters ?? 0
        }
      });

      if (outboxRepo) {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType: "MISSION_ASSIGNED",
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "MISSION",
          aggregateId: mission.id,
          actorId: user.id,
          payload: {
            droneId: drone.id,
            droneCallSign: drone.call_sign,
            orderId: order.id,
            customerId: order.customer_id
          }
        });
      }

      // Audit logs
      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "MISSION_ASSIGNED",
        resourceType: "mission",
        resourceId: mission.id,
        metadata: {
          droneId,
          droneCallSign: drone.call_sign,
          orderId: order.id
        }
      });

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "DRONE_STATUS_UPDATED",
        resourceType: "drone",
        resourceId: droneId,
        metadata: {
          newStatus: "ASSIGNED",
          missionId: mission.id
        }
      });

      return mapRecordToResponse(mission);
    },

    async updateMissionStatus(
      user: AuthenticatedUser,
      missionId: string,
      input: UpdateMissionStatusRequest
    ): Promise<MissionResponse> {
      const existing = await missionRepo.findById(missionId, user.organizationId);
      if (!existing) {
        throw new MissionNotFoundError(missionId);
      }

      validateMissionStateTransition(existing.status as MissionStatus, input.status);

      const now = new Date();
      const updates: MissionUpdateRecord = {
        status: input.status
      };

      if (input.status === "LAUNCHING" || input.status === "IN_PROGRESS") {
        updates.launched_at = now;
      } else if (input.status === "COMPLETED") {
        updates.completed_at = now;
      } else if (input.status === "CANCELLED") {
        updates.cancelled_at = now;
        updates.cancellation_reason = input.reason ?? null;
      } else if (input.status === "FAILED") {
        updates.failed_at = now;
        updates.failure_reason = input.reason ?? null;
      } else if (input.status === "EMERGENCY") {
        updates.emergency_at = now;
        updates.emergency_reason = input.reason ?? null;
        if (existing.drone_id) {
          await simulatorGateway.triggerEmergency(existing.drone_id, input.reason ?? "Manual operator emergency trigger");
        }
      }

      const updated = await missionRepo.update(missionId, user.organizationId, updates);
      if (!updated) {
        throw new MissionNotFoundError(missionId);
      }

      if (outboxRepo) {
        const missionEventMap: Record<string, string> = {
          LAUNCHING: "MISSION_LAUNCHED",
          IN_PROGRESS: "MISSION_IN_PROGRESS",
          DELIVERING: "MISSION_DELIVERING",
          RETURNING: "MISSION_RETURNING",
          COMPLETED: "MISSION_COMPLETED",
          CANCELLED: "MISSION_CANCELLED",
          FAILED: "MISSION_FAILED",
          EMERGENCY: "MISSION_EMERGENCY"
        };
        const eventType = (missionEventMap[input.status] ?? "MISSION_STATUS_UPDATED") as any;

        // Fetch order to include customerId in payload if possible
        const linkedOrder = await orderRepo.findById(updated.order_id, user.organizationId);

        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType,
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "MISSION",
          aggregateId: missionId,
          actorId: user.id,
          payload: {
            missionNumber: updated.mission_number,
            orderId: updated.order_id,
            droneId: updated.drone_id,
            customerId: linkedOrder?.customer_id ?? null,
            previousStatus: existing.status,
            status: updated.status,
            reason: input.reason ?? null
          }
        });
      }

      let auditAction = "MISSION_STATUS_UPDATED";
      if (input.status === "CANCELLED") auditAction = "MISSION_CANCELLED";
      else if (input.status === "COMPLETED") auditAction = "MISSION_COMPLETED";
      else if (input.status === "FAILED") auditAction = "MISSION_FAILED";
      else if (input.status === "EMERGENCY") auditAction = "EMERGENCY_COMMAND_ISSUED";

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: auditAction,
        resourceType: "mission",
        resourceId: missionId,
        metadata: {
          previousStatus: existing.status,
          newStatus: updated.status,
          reason: input.reason
        }
      });

      return mapRecordToResponse(updated);
    },

    async listMissions(user: AuthenticatedUser, query: MissionListQuery): Promise<MissionListResponse> {
      const result = await missionRepo.list({
        organizationId: user.organizationId,
        status: query.status,
        orderId: query.orderId,
        droneId: query.droneId,
        limit: query.limit,
        offset: query.offset
      });

      return {
        data: result.missions.map(mapRecordToResponse),
        pagination: {
          total: result.total,
          limit: query.limit,
          offset: query.offset
        }
      };
    }
  };
}
