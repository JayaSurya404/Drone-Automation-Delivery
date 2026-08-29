import crypto from "node:crypto";
import type {
  AuthenticatedUser,
  CreateDroneRequest,
  UpdateDroneRequest,
  DroneResponse,
  DroneListQuery,
  DroneListResponse,
  DroneStatus
} from "@skynav/contracts";
import type { FleetRepository, DroneRecord, DroneUpdateRecord } from "./fleet.repository.js";
import { validateDroneStateTransition } from "./drone.state-machine.js";
import type { AuditService } from "../audit/audit.service.js";

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
  updateDrone(user: AuthenticatedUser, droneId: string, input: UpdateDroneRequest): Promise<DroneResponse>;
  listDrones(user: AuthenticatedUser, query: DroneListQuery): Promise<DroneListResponse>;
}

export function createFleetService(
  fleetRepo: FleetRepository,
  auditService: AuditService
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
    }
  };
}
