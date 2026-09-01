import crypto from "node:crypto";
import type {
  AuthenticatedUser,
  CreateDroneRequest,
  UpdateDroneRequest,
  DroneResponse,
  DroneListQuery,
  DroneListResponse,
  DroneStatus,
  FleetSummaryResponse,
  DroneDetailResponse,
  OperationalCommandResponse,
  TelemetryFreshness,
  MissionResponse,
  OrderResponse
} from "@skynav/contracts";
import type { FleetRepository, DroneRecord, DroneUpdateRecord } from "./fleet.repository.js";
import { validateDroneStateTransition, InvalidDroneStateTransitionError } from "./drone.state-machine.js";
import type { AuditService } from "../audit/audit.service.js";
import type { OutboxRepository } from "../events/outbox.repository.js";
import type { SimulatorGateway } from "../missions/simulator.adapter.js";
import type { MissionRepository } from "../missions/mission.repository.js";
import type { OrderRepository } from "../orders/order.repository.js";
import { isTerminalMissionStatus } from "../missions/mission.state-machine.js";

export class DroneNotFoundError extends Error {
  public readonly code = "DRONE_NOT_FOUND";
  constructor(droneId: string) {
    super(`Drone with ID '${droneId}' was not found in this organization.`);
    this.name = "DroneNotFoundError";
  }
}

export class DuplicateDroneCallSignError extends Error {
  public readonly code = "DUPLICATE_DRONE_CALL_SIGN";
  constructor(callSign: string) {
    super(`A drone with call sign '${callSign}' already exists in this organization.`);
    this.name = "DuplicateDroneCallSignError";
  }
}

export class DroneNotAvailableError extends Error {
  public readonly code = "DRONE_NOT_AVAILABLE";
  constructor(droneId: string, reason?: string) {
    super(reason || `Drone '${droneId}' is not available for assignment.`);
    this.name = "DroneNotAvailableError";
  }
}

export class FleetForbiddenError extends Error {
  public readonly code = "FLEET_FORBIDDEN";
  constructor(message: string) {
    super(message);
    this.name = "FleetForbiddenError";
  }
}

export interface FleetService {
  createDrone(user: AuthenticatedUser, input: CreateDroneRequest): Promise<DroneResponse>;
  getDrone(user: AuthenticatedUser, droneId: string): Promise<DroneResponse>;
  getDroneDetail(user: AuthenticatedUser, droneId: string): Promise<DroneDetailResponse>;
  getFleetSummary(user: AuthenticatedUser): Promise<FleetSummaryResponse>;
  updateDrone(user: AuthenticatedUser, droneId: string, input: UpdateDroneRequest): Promise<DroneResponse>;
  listDrones(user: AuthenticatedUser, query: DroneListQuery): Promise<DroneListResponse>;
  triggerReturnToHome(user: AuthenticatedUser, droneId: string, reason?: string): Promise<OperationalCommandResponse>;
  triggerEmergency(user: AuthenticatedUser, droneId: string, reason: string): Promise<OperationalCommandResponse>;
  clearEmergency(user: AuthenticatedUser, droneId: string, reason?: string): Promise<OperationalCommandResponse>;
}

export function createFleetService(
  fleetRepo: FleetRepository,
  auditService: AuditService,
  outboxRepo?: OutboxRepository,
  simulatorGateway?: SimulatorGateway,
  missionRepo?: MissionRepository,
  orderRepo?: OrderRepository
): FleetService {
  function mapRecordToResponse(record: DroneRecord): DroneResponse {
    return {
      id: record.id,
      organizationId: record.organization_id,
      callSign: record.call_sign,
      model: record.model,
      serialNumber: record.serial_number ?? null,
      status: record.status as DroneStatus,
      batteryPercent: record.battery_percent,
      maxPayloadGrams: record.max_payload_grams,
      currentLocation: {
        latitude: record.current_latitude,
        longitude: record.current_longitude,
        altitudeMeters: record.current_altitude_meters
      },
      homeLocation: {
        latitude: record.home_latitude,
        longitude: record.home_longitude,
        altitudeMeters: record.home_altitude_meters
      },
      isActive: record.is_active,
      createdAt: record.created_at instanceof Date ? record.created_at.toISOString() : new Date(record.created_at).toISOString(),
      updatedAt: record.updated_at instanceof Date ? record.updated_at.toISOString() : new Date(record.updated_at).toISOString()
    };
  }

  function computeFreshness(record: DroneRecord): TelemetryFreshness {
    if (!record.is_active || record.status === "OFFLINE") {
      return "OFFLINE";
    }
    const ageMs = Date.now() - new Date(record.updated_at).getTime();
    if (ageMs < 30_000) return "LIVE";
    if (ageMs < 120_000) return "DEGRADED";
    if (ageMs < 600_000) return "STALE";
    return "OFFLINE";
  }

  return {
    async createDrone(user: AuthenticatedUser, input: CreateDroneRequest): Promise<DroneResponse> {
      // Check call sign uniqueness within organization
      const existing = await fleetRepo.findByCallSign(input.callSign, user.organizationId);
      if (existing) {
        throw new DuplicateDroneCallSignError(input.callSign);
      }

      const droneId = crypto.randomUUID();
      const newRecord = await fleetRepo.create({
        id: droneId,
        organization_id: user.organizationId,
        model_id: null,
        call_sign: input.callSign,
        model: input.model ?? "SkyNav Hexacopter Alpha",
        serial_number: input.serialNumber ?? null,
        status: "IDLE",
        battery_percent: input.batteryPercent ?? 100,
        max_payload_grams: input.maxPayloadGrams ?? 5000,
        current_latitude: input.currentLocation?.latitude ?? 37.7749,
        current_longitude: input.currentLocation?.longitude ?? -122.4194,
        current_altitude_meters: input.currentLocation?.altitudeMeters ?? 0,
        home_latitude: input.homeLocation?.latitude ?? 37.7749,
        home_longitude: input.homeLocation?.longitude ?? -122.4194,
        home_altitude_meters: input.homeLocation?.altitudeMeters ?? 0,
        is_active: true
      });

      if (outboxRepo) {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType: "DRONE_REGISTERED",
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "DRONE",
          aggregateId: droneId,
          actorId: user.id,
          payload: {
            callSign: newRecord.call_sign,
            model: newRecord.model,
            maxPayloadGrams: newRecord.max_payload_grams,
            batteryPercent: newRecord.battery_percent
          }
        });
      }

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "DRONE_REGISTERED",
        resourceType: "drone",
        resourceId: droneId,
        metadata: {
          callSign: newRecord.call_sign,
          model: newRecord.model,
          maxPayloadGrams: newRecord.max_payload_grams
        }
      });

      return mapRecordToResponse(newRecord);
    },

    async getDrone(user: AuthenticatedUser, droneId: string): Promise<DroneResponse> {
      const drone = await fleetRepo.findById(droneId, user.organizationId);
      if (!drone) {
        throw new DroneNotFoundError(droneId);
      }

      return mapRecordToResponse(drone);
    },

    async getDroneDetail(user: AuthenticatedUser, droneId: string): Promise<DroneDetailResponse> {
      const drone = await fleetRepo.findById(droneId, user.organizationId);
      if (!drone) {
        throw new DroneNotFoundError(droneId);
      }

      const base = mapRecordToResponse(drone);
      const freshness = computeFreshness(drone);

      // Find active mission if any
      let activeMission: MissionResponse | null = null;
      let activeOrder: OrderResponse | null = null;

      if (missionRepo) {
        const { missions } = await missionRepo.list({
          organizationId: user.organizationId,
          droneId: drone.id,
          limit: 5,
          offset: 0
        });

        const currentActive = missions.find((m) => !isTerminalMissionStatus(m.status as any));
        if (currentActive) {
          activeMission = {
            id: currentActive.id,
            missionNumber: currentActive.mission_number,
            organizationId: currentActive.organization_id,
            orderId: currentActive.order_id,
            droneId: currentActive.drone_id,
            status: currentActive.status as any,
            origin: {
              latitude: currentActive.origin_latitude,
              longitude: currentActive.origin_longitude,
              altitudeMeters: currentActive.origin_altitude_meters ?? 0
            },
            destination: {
              latitude: currentActive.destination_latitude,
              longitude: currentActive.destination_longitude,
              altitudeMeters: currentActive.destination_altitude_meters ?? 0
            },
            assignedAt: currentActive.assigned_at ? new Date(currentActive.assigned_at).toISOString() : null,
            launchedAt: currentActive.launched_at ? new Date(currentActive.launched_at).toISOString() : null,
            completedAt: currentActive.completed_at ? new Date(currentActive.completed_at).toISOString() : null,
            cancelledAt: currentActive.cancelled_at ? new Date(currentActive.cancelled_at).toISOString() : null,
            cancellationReason: currentActive.cancellation_reason,
            failedAt: currentActive.failed_at ? new Date(currentActive.failed_at).toISOString() : null,
            failureReason: currentActive.failure_reason,
            emergencyAt: currentActive.emergency_at ? new Date(currentActive.emergency_at).toISOString() : null,
            emergencyReason: currentActive.emergency_reason,
            createdAt: new Date(currentActive.created_at).toISOString(),
            updatedAt: new Date(currentActive.updated_at).toISOString()
          };

          if (orderRepo && currentActive.order_id) {
            const orderRecord = await orderRepo.findById(currentActive.order_id, user.organizationId);
            if (orderRecord) {
              activeOrder = {
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
          }
        }
      }

      const canRTH = ["TAKEOFF", "EN_ROUTE", "IN_FLIGHT", "ARRIVED", "DELIVERING", "ASSIGNED"].includes(drone.status);
      const canEmergency = drone.status !== "EMERGENCY" && drone.status !== "OFFLINE";
      const canClearEmergency = drone.status === "EMERGENCY";

      return {
        ...base,
        freshness,
        speedMetersPerSecond: drone.status === "IDLE" || drone.status === "LANDED" ? 0 : 15,
        headingDegrees: 90,
        altitudeMeters: drone.current_altitude_meters,
        voltageVolts: 24.2,
        activeMission,
        activeOrder,
        canRTH,
        canEmergency,
        canClearEmergency
      };
    },

    async getFleetSummary(user: AuthenticatedUser): Promise<FleetSummaryResponse> {
      return fleetRepo.getSummary(user.organizationId);
    },

    async updateDrone(
      user: AuthenticatedUser,
      droneId: string,
      input: UpdateDroneRequest
    ): Promise<DroneResponse> {
      const existing = await fleetRepo.findById(droneId, user.organizationId);
      if (!existing) {
        throw new DroneNotFoundError(droneId);
      }

      // Check status transition if changing status
      if (input.status && input.status !== existing.status) {
        validateDroneStateTransition(existing.status as DroneStatus, input.status);
      }

      // Check call sign uniqueness if changing call sign
      if (input.callSign && input.callSign !== existing.call_sign) {
        const conflict = await fleetRepo.findByCallSign(input.callSign, user.organizationId);
        if (conflict && conflict.id !== droneId) {
          throw new DuplicateDroneCallSignError(input.callSign);
        }
      }

      const updates: DroneUpdateRecord = {};
      if (input.callSign !== undefined) updates.call_sign = input.callSign;
      if (input.model !== undefined) updates.model = input.model;
      if (input.serialNumber !== undefined) updates.serial_number = input.serialNumber;
      if (input.maxPayloadGrams !== undefined) updates.max_payload_grams = input.maxPayloadGrams;
      if (input.status !== undefined) updates.status = input.status;
      if (input.batteryPercent !== undefined) updates.battery_percent = input.batteryPercent;
      if (input.isActive !== undefined) updates.is_active = input.isActive;

      if (input.currentLocation) {
        updates.current_latitude = input.currentLocation.latitude;
        updates.current_longitude = input.currentLocation.longitude;
        if (input.currentLocation.altitudeMeters !== undefined) {
          updates.current_altitude_meters = input.currentLocation.altitudeMeters;
        }
      }

      if (input.homeLocation) {
        updates.home_latitude = input.homeLocation.latitude;
        updates.home_longitude = input.homeLocation.longitude;
        if (input.homeLocation.altitudeMeters !== undefined) {
          updates.home_altitude_meters = input.homeLocation.altitudeMeters;
        }
      }

      const updated = await fleetRepo.update(droneId, user.organizationId, updates);
      if (!updated) {
        throw new DroneNotFoundError(droneId);
      }

      const isStatusChange = input.status && input.status !== existing.status;

      if (outboxRepo && isStatusChange) {
        const droneEventMap: Record<string, string> = {
          TAKEOFF: "DRONE_TAKEOFF",
          EN_ROUTE: "DRONE_EN_ROUTE",
          ARRIVED: "DRONE_ARRIVED",
          DELIVERING: "DRONE_DELIVERING",
          RETURNING: "DRONE_RETURNING",
          LANDED: "DRONE_LANDED",
          MAINTENANCE: "DRONE_MAINTENANCE",
          EMERGENCY: "DRONE_EMERGENCY"
        };
        const eventType = (droneEventMap[input.status!] ?? "DRONE_STATUS_UPDATED") as any;

        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType,
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "DRONE",
          aggregateId: droneId,
          actorId: user.id,
          payload: {
            callSign: updated.call_sign,
            previousStatus: existing.status,
            status: updated.status,
            batteryPercent: updated.battery_percent
          }
        });
      }

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: isStatusChange ? "DRONE_STATUS_UPDATED" : "DRONE_UPDATED",
        resourceType: "drone",
        resourceId: droneId,
        metadata: {
          previousStatus: existing.status,
          newStatus: updated.status,
          updatedFields: Object.keys(updates)
        }
      });

      return mapRecordToResponse(updated);
    },

    async listDrones(user: AuthenticatedUser, query: DroneListQuery): Promise<DroneListResponse> {
      const result = await fleetRepo.list({
        organizationId: user.organizationId,
        status: query.status,
        isActive: query.isActive,
        limit: query.limit,
        offset: query.offset
      });

      return {
        data: result.drones.map(mapRecordToResponse),
        pagination: {
          total: result.total,
          limit: query.limit,
          offset: query.offset
        }
      };
    },

    async triggerReturnToHome(
      user: AuthenticatedUser,
      droneId: string,
      reason = "Return-To-Home commanded by operator"
    ): Promise<OperationalCommandResponse> {
      const drone = await fleetRepo.findById(droneId, user.organizationId);
      if (!drone) {
        throw new DroneNotFoundError(droneId);
      }

      // Check legal state for RTH
      if (drone.status === "IDLE" || drone.status === "LANDED" || drone.status === "OFFLINE") {
        throw new InvalidDroneStateTransitionError(drone.status as DroneStatus, "RETURNING");
      }

      // Update drone state in database
      const updated = await fleetRepo.update(droneId, user.organizationId, {
        status: "RETURNING"
      });

      // Update active mission if linked
      if (missionRepo) {
        const { missions } = await missionRepo.list({
          organizationId: user.organizationId,
          droneId: drone.id,
          limit: 5,
          offset: 0
        });
        const activeMission = missions.find((m) => !isTerminalMissionStatus(m.status as any));
        if (activeMission) {
          await missionRepo.update(activeMission.id, user.organizationId, {
            status: "RETURNING"
          });
        }
      }

      // Invoke Simulator Gateway boundary
      if (simulatorGateway) {
        await simulatorGateway.triggerReturnToHome(droneId, reason);
      }

      if (outboxRepo) {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType: "DRONE_RETURNING",
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "DRONE",
          aggregateId: droneId,
          actorId: user.id,
          payload: {
            callSign: drone.call_sign,
            previousStatus: drone.status,
            reason
          }
        });
      }

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "RETURN_TO_HOME_TRIGGERED",
        resourceType: "drone",
        resourceId: droneId,
        metadata: {
          callSign: drone.call_sign,
          previousStatus: drone.status,
          reason
        }
      });

      return {
        success: true,
        command: "RTH",
        targetId: droneId,
        status: "RETURNING",
        message: `Return-To-Home initiated for UAV '${drone.call_sign}'. Reason: ${reason}`,
        timestamp: new Date().toISOString()
      };
    },

    async triggerEmergency(
      user: AuthenticatedUser,
      droneId: string,
      reason: string
    ): Promise<OperationalCommandResponse> {
      if (!reason || reason.trim().length < 3) {
        throw new Error("Emergency reason is required and must be at least 3 characters.");
      }

      const drone = await fleetRepo.findById(droneId, user.organizationId);
      if (!drone) {
        throw new DroneNotFoundError(droneId);
      }

      // Idempotent handling if already emergency
      if (drone.status !== "EMERGENCY") {
        await fleetRepo.update(droneId, user.organizationId, {
          status: "EMERGENCY"
        });

        if (missionRepo) {
          const { missions } = await missionRepo.list({
            organizationId: user.organizationId,
            droneId: drone.id,
            limit: 5,
            offset: 0
          });
          const activeMission = missions.find((m) => !isTerminalMissionStatus(m.status as any));
          if (activeMission) {
            await missionRepo.update(activeMission.id, user.organizationId, {
              status: "EMERGENCY",
              emergency_at: new Date(),
              emergency_reason: reason
            });
          }
        }
      }

      // Invoke Simulator Gateway boundary
      if (simulatorGateway) {
        await simulatorGateway.triggerEmergency(droneId, reason);
      }

      if (outboxRepo) {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType: "EMERGENCY_TRIGGERED",
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "ALERT",
          aggregateId: droneId,
          actorId: user.id,
          payload: {
            droneId,
            callSign: drone.call_sign,
            reason,
            batteryPercent: drone.battery_percent,
            location: {
              latitude: drone.current_latitude,
              longitude: drone.current_longitude,
              altitudeMeters: drone.current_altitude_meters
            }
          }
        });
      }

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "EMERGENCY_COMMAND_ISSUED",
        resourceType: "drone",
        resourceId: droneId,
        metadata: {
          callSign: drone.call_sign,
          previousStatus: drone.status,
          reason
        }
      });

      return {
        success: true,
        command: "EMERGENCY",
        targetId: droneId,
        status: "EMERGENCY",
        message: `Emergency halt/failsafe command issued for UAV '${drone.call_sign}'. Reason: ${reason}`,
        timestamp: new Date().toISOString()
      };
    },

    async clearEmergency(
      user: AuthenticatedUser,
      droneId: string,
      reason = "Emergency cleared by operator"
    ): Promise<OperationalCommandResponse> {
      const drone = await fleetRepo.findById(droneId, user.organizationId);
      if (!drone) {
        throw new DroneNotFoundError(droneId);
      }

      if (drone.status !== "EMERGENCY") {
        throw new InvalidDroneStateTransitionError(drone.status as DroneStatus, "IDLE");
      }

      // If drone is on the ground (altitude <= 0 or landed), transition to IDLE, otherwise RETURNING
      const targetStatus: DroneStatus = drone.current_altitude_meters <= 0 ? "IDLE" : "RETURNING";

      await fleetRepo.update(droneId, user.organizationId, {
        status: targetStatus
      });

      if (simulatorGateway) {
        await simulatorGateway.clearEmergency(droneId);
      }

      if (outboxRepo) {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          version: "v1",
          eventType: "EMERGENCY_CLEARED",
          occurredAt: new Date().toISOString(),
          organizationId: user.organizationId,
          aggregateType: "ALERT",
          aggregateId: droneId,
          actorId: user.id,
          payload: {
            droneId,
            callSign: drone.call_sign,
            resetStatus: targetStatus,
            reason
          }
        });
      }

      await auditService.log({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "DRONE_EMERGENCY_CLEARED",
        resourceType: "drone",
        resourceId: droneId,
        metadata: {
          callSign: drone.call_sign,
          resetStatus: targetStatus,
          reason
        }
      });

      return {
        success: true,
        command: "EMERGENCY_CLEAR",
        targetId: droneId,
        status: targetStatus,
        message: `Emergency state cleared for UAV '${drone.call_sign}'. Status reset to '${targetStatus}'.`,
        timestamp: new Date().toISOString()
      };
    }
  };
}
