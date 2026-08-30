import crypto from "node:crypto";
import type {
  AuthenticatedUser,
  CreateMissionRequest,
  UpdateMissionStatusRequest,
  MissionResponse,
  MissionListQuery,
  MissionListResponse,
  MissionStatus,
  MissionDetailResponse,
  OperationalCommandResponse,
  WaypointDto,
  DroneResponse,
  OrderResponse
} from "@skynav/contracts";
import type { MissionRepository, MissionRecord, MissionUpdateRecord } from "./mission.repository.js";
import {
  canAssignDroneToMission,
  validateMissionStateTransition,
  isTerminalMissionStatus,
  InvalidMissionStateTransitionError
} from "./mission.state-machine.js";
import type { OrderRepository } from "../orders/order.repository.js";
import type { FleetRepository } from "../fleet/fleet.repository.js";
import type { SimulatorGateway } from "./simulator.adapter.js";
import type { AuditService } from "../audit/audit.service.js";
import type { OutboxRepository } from "../events/outbox.repository.js";
import { DroneNotFoundError, DroneNotAvailableError } from "../fleet/fleet.service.js";
import { OrderNotFoundError } from "../orders/order.service.js";

export class MissionNotFoundError extends Error {
  public readonly code = "MISSION_NOT_FOUND";
  constructor(missionId: string) {
    super(`Mission with ID '${missionId}' was not found in this organization.`);
    this.name = "MissionNotFoundError";
  }
}

export class DuplicateActiveMissionError extends Error {
  public readonly code = "DUPLICATE_ACTIVE_MISSION";
  constructor(orderId: string) {
    super(`An active mission is already assigned to Order '${orderId}'.`);
    this.name = "DuplicateActiveMissionError";
  }
}

export class MissionAssignmentForbiddenError extends Error {
  public readonly code = "MISSION_ASSIGNMENT_FORBIDDEN";
  constructor(message: string) {
    super(message);
    this.name = "MissionAssignmentForbiddenError";
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
  getMissionDetail(user: AuthenticatedUser, missionId: string): Promise<MissionDetailResponse>;
  assignDrone(user: AuthenticatedUser, missionId: string, droneId: string): Promise<MissionResponse>;
  updateMissionStatus(user: AuthenticatedUser, missionId: string, input: UpdateMissionStatusRequest): Promise<MissionResponse>;
  cancelMission(user: AuthenticatedUser, missionId: string, reason: string): Promise<OperationalCommandResponse>;
  listMissions(user: AuthenticatedUser, query: MissionListQuery): Promise<MissionListResponse>;
}

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
        origin_altitude_meters: input.origin?.altitudeMeters ?? order.pickup_altitude_meters ?? 0,
        origin_address: input.origin?.address ?? order.pickup_address ?? null,
        destination_latitude: input.destination?.latitude ?? order.delivery_latitude,
        destination_longitude: input.destination?.longitude ?? order.delivery_longitude,
        destination_altitude_meters: input.destination?.altitudeMeters ?? order.delivery_altitude_meters ?? 0,
        destination_address: input.destination?.address ?? order.delivery_address ?? null
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
            missionNumber: newRecord.mission_number,
            orderId: newRecord.order_id,
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
          missionNumber: newRecord.mission_number,
          orderId: newRecord.order_id
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

    async getMissionDetail(user: AuthenticatedUser, missionId: string): Promise<MissionDetailResponse> {
      const mission = await missionRepo.findById(missionId, user.organizationId);
      if (!mission) {
        throw new MissionNotFoundError(missionId);
      }

      const base = mapRecordToResponse(mission);

      // Resolve linked order
      let order: OrderResponse | null = null;
      const orderRecord = await orderRepo.findById(mission.order_id, user.organizationId);
      if (orderRecord) {
        order = {
          id: orderRecord.id,
          orderNumber: orderRecord.order_number,
          organizationId: orderRecord.organization_id,
          customerId: orderRecord.customer_id,
          status: orderRecord.status as any,
          priority: orderRecord.priority as any,
          pickup: {
            latitude: orderRecord.pickup_latitude,
            longitude: orderRecord.pickup_longitude,
            altitudeMeters: orderRecord.pickup_altitude_meters,
            address: orderRecord.pickup_address ?? undefined
          },
          delivery: {
            latitude: orderRecord.delivery_latitude,
            longitude: orderRecord.delivery_longitude,
            altitudeMeters: orderRecord.delivery_altitude_meters,
            address: orderRecord.delivery_address ?? undefined
          },
          package: {
            weightGrams: orderRecord.package_weight_grams,
            lengthCm: orderRecord.package_length_cm ?? undefined,
            widthCm: orderRecord.package_width_cm ?? undefined,
            heightCm: orderRecord.package_height_cm ?? undefined,
            description: orderRecord.package_description ?? undefined
          },
          deliveryNotes: orderRecord.delivery_notes ?? null,
          assignedAt: orderRecord.assigned_at ? new Date(orderRecord.assigned_at).toISOString() : null,
          deliveredAt: orderRecord.delivered_at ? new Date(orderRecord.delivered_at).toISOString() : null,
          cancelledAt: orderRecord.cancelled_at ? new Date(orderRecord.cancelled_at).toISOString() : null,
          cancellationReason: orderRecord.cancellation_reason ?? null,
          createdAt: new Date(orderRecord.created_at).toISOString(),
          updatedAt: new Date(orderRecord.updated_at).toISOString()
        };
      }

      // Resolve assigned drone
      let drone: DroneResponse | null = null;
      if (mission.drone_id) {
        const droneRecord = await fleetRepo.findById(mission.drone_id, user.organizationId);
        if (droneRecord) {
          drone = {
            id: droneRecord.id,
            organizationId: droneRecord.organization_id,
            callSign: droneRecord.call_sign,
            model: droneRecord.model,
            serialNumber: droneRecord.serial_number ?? null,
            status: droneRecord.status as any,
            batteryPercent: droneRecord.battery_percent,
            maxPayloadGrams: droneRecord.max_payload_grams,
            currentLocation: {
              latitude: droneRecord.current_latitude,
              longitude: droneRecord.current_longitude,
              altitudeMeters: droneRecord.current_altitude_meters
            },
            homeLocation: {
              latitude: droneRecord.home_latitude,
              longitude: droneRecord.home_longitude,
              altitudeMeters: droneRecord.home_altitude_meters
            },
            isActive: droneRecord.is_active,
            createdAt: new Date(droneRecord.created_at).toISOString(),
            updatedAt: new Date(droneRecord.updated_at).toISOString()
          };
        }
      }

      // Compute waypoints for 3D flight plan
      const waypoints: WaypointDto[] = [
        {
          id: `wp-${mission.id}-origin`,
          sequence: 0,
          latitude: mission.origin_latitude,
          longitude: mission.origin_longitude,
          altitudeMeters: 60,
          targetSpeedMps: 15
        },
        {
          id: `wp-${mission.id}-mid`,
          sequence: 1,
          latitude: (mission.origin_latitude + mission.destination_latitude) / 2,
          longitude: (mission.origin_longitude + mission.destination_longitude) / 2,
          altitudeMeters: 60,
          targetSpeedMps: 18
        },
        {
          id: `wp-${mission.id}-dest`,
          sequence: 2,
          latitude: mission.destination_latitude,
          longitude: mission.destination_longitude,
          altitudeMeters: 2,
          targetSpeedMps: 2,
          isDeliveryPoint: true
        }
      ];

      // Compute progress percent
      const progressMap: Record<string, number> = {
        PENDING: 0,
        PLANNED: 0,
        VALIDATING: 5,
        READY: 10,
        AUTHORIZED: 15,
        ASSIGNED: 20,
        LAUNCHING: 30,
        DISPATCHED: 40,
        IN_PROGRESS: 60,
        DELIVERING: 80,
        RETURNING: 90,
        COMPLETED: 100,
        CANCELLED: 0,
        FAILED: 0,
        ABORTED: 0,
        EMERGENCY: 50
      };
      const progressPercent = progressMap[mission.status] ?? 0;

      const canCancel = !isTerminalMissionStatus(mission.status as any);
      const canRTH = Boolean(
        mission.drone_id &&
        ["LAUNCHING", "DISPATCHED", "IN_PROGRESS", "DELIVERING", "EMERGENCY"].includes(mission.status)
      );

      return {
        ...base,
        order,
        drone,
        waypoints,
        currentWaypointIndex: mission.status === "COMPLETED" ? 2 : mission.status === "DELIVERING" ? 2 : 1,
        progressPercent,
        canCancel,
        canRTH
      };
    },

    async assignDrone(user: AuthenticatedUser, missionId: string, droneId: string): Promise<MissionResponse> {
      // 1. Verify mission exists
      const mission = await missionRepo.findById(missionId, user.organizationId);
      if (!mission) {
        throw new MissionNotFoundError(missionId);
      }

      if (!canAssignDroneToMission(mission.status as MissionStatus)) {
        throw new MissionAssignmentForbiddenError(
          `Mission '${mission.mission_number}' is in status '${mission.status}' and cannot receive a drone assignment.`
        );
      }

      // 2. Perform atomic assignment with DB-level row locks
      const { mission: updatedMission, drone, order } = await missionRepo.assignDroneAtomically({
        missionId,
        droneId,
        organizationId: user.organizationId
      });

      // 3. Notify Simulator Gateway boundary
      await simulatorGateway.assignMission({
        missionId: updatedMission.id,
        organizationId: user.organizationId,
        droneId: drone.id,
        orderId: order.id,
        customerId: order.customer_id,
        origin: {
          latitude: updatedMission.origin_latitude,
          longitude: updatedMission.origin_longitude,
          altitudeMeters: updatedMission.origin_altitude_meters ?? 0
        },
        destination: {
          latitude: updatedMission.destination_latitude,
          longitude: updatedMission.destination_longitude,
          altitudeMeters: updatedMission.destination_altitude_meters ?? 0
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
          aggregateId: updatedMission.id,
          actorId: user.id,
          payload: {
            missionNumber: updatedMission.mission_number,
            orderId: order.id,
            droneId: drone.id,
            droneCallSign: drone.call_sign,
            customerId: order.customer_id
          }
        });
      }

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "MISSION_ASSIGNED",
        resourceType: "mission",
        resourceId: updatedMission.id,
        metadata: {
          droneId: drone.id,
          droneCallSign: drone.call_sign,
          orderId: order.id
        }
      });

      return mapRecordToResponse(updatedMission);
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

    async cancelMission(
      user: AuthenticatedUser,
      missionId: string,
      reason: string
    ): Promise<OperationalCommandResponse> {
      if (!reason || reason.trim().length < 3) {
        throw new Error("Cancellation reason is required and must be at least 3 characters.");
      }

      const mission = await missionRepo.findById(missionId, user.organizationId);
      if (!mission) {
        throw new MissionNotFoundError(missionId);
      }

      if (isTerminalMissionStatus(mission.status as any)) {
        throw new InvalidMissionStateTransitionError(mission.status as MissionStatus, "CANCELLED");
      }

      const now = new Date();

      // 1. If assigned to a drone, handle simulator & fleet state safely
      if (mission.drone_id) {
        const drone = await fleetRepo.findById(mission.drone_id, user.organizationId);
        if (drone) {
          if (["TAKEOFF", "EN_ROUTE", "DELIVERING", "IN_FLIGHT", "ARRIVED"].includes(drone.status)) {
            // Drone is in the air: trigger safe Return-To-Home
            await fleetRepo.update(drone.id, user.organizationId, {
              status: "RETURNING"
            });
            await simulatorGateway.triggerReturnToHome(drone.id, `Mission Cancelled: ${reason}`);
          } else if (drone.status === "ASSIGNED") {
            // Drone has not launched: reset to IDLE
            await fleetRepo.update(drone.id, user.organizationId, {
              status: "IDLE"
            });
          }
        }
      }

      // 2. Update mission in database
      const updatedMission = await missionRepo.update(missionId, user.organizationId, {
        status: "CANCELLED",
        cancelled_at: now,
        cancellation_reason: reason
      });

      // 3. Update linked order to CANCELLED
      const order = await orderRepo.findById(mission.order_id, user.organizationId);
      if (order && order.status !== "DELIVERED" && order.status !== "CANCELLED") {
        await orderRepo.update(order.id, user.organizationId, {
          status: "CANCELLED",
          cancelled_at: now,
          cancellation_reason: reason
        });
      }

      // 4. Emit outbox events
      if (outboxRepo) {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType: "MISSION_CANCELLED",
          occurredAt: now.toISOString(),
          organizationId: user.organizationId,
          aggregateType: "MISSION",
          aggregateId: missionId,
          actorId: user.id,
          payload: {
            missionNumber: mission.mission_number,
            orderId: mission.order_id,
            droneId: mission.drone_id,
            customerId: order?.customer_id ?? null,
            reason
          }
        });

        if (order) {
          await outboxRepo.insert({
            id: crypto.randomUUID(),
            version: "v1",
            eventType: "ORDER_CANCELLED",
            occurredAt: now.toISOString(),
            organizationId: user.organizationId,
            aggregateType: "ORDER",
            aggregateId: order.id,
            actorId: user.id,
            payload: {
              orderNumber: order.order_number,
              customerId: order.customer_id,
              reason
            }
          });
        }
      }

      // 5. Log audit
      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "MISSION_CANCELLED",
        resourceType: "mission",
        resourceId: missionId,
        metadata: {
          missionNumber: mission.mission_number,
          orderId: mission.order_id,
          droneId: mission.drone_id,
          reason
        }
      });

      return {
        success: true,
        command: "CANCEL_MISSION",
        targetId: missionId,
        status: "CANCELLED",
        message: `Mission '${mission.mission_number}' was cancelled. Reason: ${reason}.`,
        timestamp: now.toISOString()
      };
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
