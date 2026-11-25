import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Drone, DroneStatus } from "@prisma/client";
import type { EnvConfig } from "../../config/env.validation";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SimulatedDroneAdapter } from "./adapters/simulated-drone.adapter";
import type { CreateDroneDto } from "./dto/create-drone.dto";
import type { ListDronesQueryDto } from "./dto/list-drones-query.dto";
import type { SetMaintenanceDto } from "./dto/set-maintenance.dto";
import type { UpdateDroneDto } from "./dto/update-drone.dto";

export interface DroneView {
  id: string;
  serialNumber: string;
  name: string;
  model: string;
  adapterType: Drone["adapterType"];
  status: DroneStatus;
  homeHubId: string | null;
  batteryPercent: number;
  batteryHealthPercent: number;
  batteryCycles: number;
  currentLat: number | null;
  currentLng: number | null;
  altitudeMeters: number | null;
  speedMps: number | null;
  headingDegrees: number | null;
  signalStrengthPercent: number | null;
  maxPayloadKg: number;
  maxRangeKm: number;
  maxSpeedMps: number;
  maxAltitudeMeters: number;
  isMaintenanceMode: boolean;
  maintenanceNote: string | null;
  lastTelemetryAt: string | null;
  totalFlightHours: number;
  totalMissionsCompleted: number;
  createdAt: string;
}

export interface TelemetryUpdatePayload {
  lat: number;
  lng: number;
  altitudeMeters?: number;
  speedMps?: number;
  headingDegrees?: number;
  batteryPercent: number;
  signalStrengthPercent?: number;
}

const AVAILABLE_STATUSES: DroneStatus[] = ["IDLE"];

@Injectable()
export class DronesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
    private readonly simulatedAdapter: SimulatedDroneAdapter,
  ) {}

  async register(dto: CreateDroneDto, actor: AuthenticatedUser): Promise<DroneView> {
    const adapterType = dto.adapterType ?? "SIMULATED";
    let coords: { lat: number; lng: number } | null = null;

    if (dto.homeHubId) {
      coords = await this.getHubCoordinates(dto.homeHubId);
      if (!coords) {
        throw new BadRequestException("homeHubId does not reference a known fulfillment hub");
      }
    }

    const drone = await this.prisma.drone.create({
      data: {
        serialNumber: dto.serialNumber,
        name: dto.name,
        model: dto.model,
        adapterType,
        homeHubId: dto.homeHubId,
        batteryPercent: dto.batteryPercent ?? 100,
        currentLat: coords?.lat,
        currentLng: coords?.lng,
        maxPayloadKg: dto.maxPayloadKg ?? undefined,
        maxRangeKm: dto.maxRangeKm ?? undefined,
        maxSpeedMps: dto.maxSpeedMps ?? undefined,
        maxAltitudeMeters: dto.maxAltitudeMeters ?? undefined,
      },
    });

    if (adapterType === "SIMULATED" && coords) {
      this.simulatedAdapter.registerDrone(drone.id, {
        lat: coords.lat,
        lng: coords.lng,
        batteryPercent: drone.batteryPercent,
        homeLat: coords.lat,
        homeLng: coords.lng,
      });
    }

    await this.recordHealthLog(drone.id, "IDLE", "Drone registered");
    await this.auditService.log({
      actorId: actor.sub,
      action: "drone.registered",
      targetType: "Drone",
      targetId: drone.id,
      metadata: { serialNumber: drone.serialNumber, adapterType },
    });
    this.eventEmitter.emit("drone.created", { droneId: drone.id });

    return this.toView(drone);
  }

  async list(query: ListDronesQueryDto): Promise<{ drones: DroneView[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.hubId ? { homeHubId: query.hubId } : {}),
      ...(query.availableOnly ? { status: { in: AVAILABLE_STATUSES }, isMaintenanceMode: false } : {}),
    };

    const [drones, total] = await this.prisma.$transaction([
      this.prisma.drone.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.drone.count({ where }),
    ]);

    return { drones: drones.map((d) => this.toView(d)), total, page, pageSize };
  }

  async getById(id: string): Promise<DroneView> {
    const drone = await this.getOrThrow(id);
    return this.toView(drone);
  }

  /** Fleet-manager candidate list for mission drone assignment: idle, not under maintenance, home-hub-registered. */
  async listAvailable(hubId?: string): Promise<DroneView[]> {
    const drones = await this.prisma.drone.findMany({
      where: {
        status: { in: AVAILABLE_STATUSES },
        isMaintenanceMode: false,
        ...(hubId ? { homeHubId: hubId } : {}),
      },
      orderBy: { batteryPercent: "desc" },
    });
    return drones.map((d) => this.toView(d));
  }

  async update(id: string, dto: UpdateDroneDto, actor: AuthenticatedUser): Promise<DroneView> {
    await this.getOrThrow(id);
    const drone = await this.prisma.drone.update({
      where: { id },
      data: {
        name: dto.name,
        model: dto.model,
        homeHubId: dto.homeHubId,
        maxPayloadKg: dto.maxPayloadKg,
        maxRangeKm: dto.maxRangeKm,
        maxSpeedMps: dto.maxSpeedMps,
        maxAltitudeMeters: dto.maxAltitudeMeters,
      },
    });
    await this.auditService.log({
      actorId: actor.sub,
      action: "drone.updated",
      targetType: "Drone",
      targetId: id,
    });
    return this.toView(drone);
  }

  async setMaintenance(id: string, dto: SetMaintenanceDto, actor: AuthenticatedUser): Promise<DroneView> {
    const existing = await this.getOrThrow(id);
    if (dto.enabled && existing.status === "IN_FLIGHT") {
      throw new ConflictException("Cannot flag an in-flight drone for maintenance — wait for it to land or return to home");
    }

    const nextStatus: DroneStatus = dto.enabled ? "MAINTENANCE" : "IDLE";
    const drone = await this.prisma.drone.update({
      where: { id },
      data: {
        isMaintenanceMode: dto.enabled,
        maintenanceNote: dto.note ?? null,
        lastMaintenanceAt: dto.enabled ? new Date() : existing.lastMaintenanceAt,
        status: nextStatus,
      },
    });
    await this.recordHealthLog(id, nextStatus, dto.enabled ? `Flagged for maintenance: ${dto.note ?? "no note"}` : "Maintenance cleared");
    await this.auditService.log({
      actorId: actor.sub,
      action: dto.enabled ? "drone.maintenance_flagged" : "drone.maintenance_cleared",
      targetType: "Drone",
      targetId: id,
      metadata: { note: dto.note },
    });
    this.eventEmitter.emit("drone.status_changed", { droneId: id, fromStatus: existing.status, toStatus: nextStatus });

    return this.toView(drone);
  }

  /**
   * Phase 12 fix: `DroneHealthLog`/`BatteryLog`/`TelemetrySample` now
   * `onDelete: SetNull` (schema.prisma) rather than `Cascade` — removing a
   * drone from the registry used to permanently destroy its entire
   * flight/battery/health history, which is a real compliance concern for
   * a drone-delivery operator; the same `SetNull` precedent `Mission.drone`/
   * `VisionAnalysis.drone`/`SwarmAssignment.drone` already use. The history
   * rows survive with `droneId: null` ("this reading belonged to a
   * since-removed drone").
   */
  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const drone = await this.getOrThrow(id);
    if (drone.status === "IN_FLIGHT" || drone.status === "RETURNING") {
      throw new ConflictException("Cannot remove a drone that is currently flying");
    }
    await this.prisma.drone.delete({ where: { id } });
    this.simulatedAdapter.unregisterDrone(id);
    await this.auditService.log({
      actorId: actor.sub,
      action: "drone.removed",
      targetType: "Drone",
      targetId: id,
      metadata: { serialNumber: drone.serialNumber },
    });
  }

  async fleetOverview(): Promise<{ totalDrones: number; byStatus: Record<string, number>; averageBatteryPercent: number }> {
    const drones = await this.prisma.drone.findMany({ select: { status: true, batteryPercent: true } });
    const byStatus: Record<string, number> = {};
    let batterySum = 0;
    for (const drone of drones) {
      byStatus[drone.status] = (byStatus[drone.status] ?? 0) + 1;
      batterySum += drone.batteryPercent;
    }
    return {
      totalDrones: drones.length,
      byStatus,
      averageBatteryPercent: drones.length > 0 ? Math.round(batterySum / drones.length) : 0,
    };
  }

  /** Called only by `MissionsService`/`TelemetryService` (cross-module writes to the Drone this module owns) — never mutated directly by another module's Prisma query. */
  async setStatus(droneId: string, status: DroneStatus, note?: string): Promise<void> {
    const existing = await this.prisma.drone.findUniqueOrThrow({ where: { id: droneId } });
    if (existing.status === status) {
      return;
    }
    await this.prisma.drone.update({ where: { id: droneId }, data: { status } });
    await this.recordHealthLog(droneId, status, note);
    this.eventEmitter.emit("drone.status_changed", { droneId, fromStatus: existing.status, toStatus: status });
  }

  /**
   * Phase 12 fix: an atomic compare-and-swap (`updateMany` with `status:
   * "IDLE"` in the `WHERE` clause, not a separate read-then-write) so two
   * concurrent mission-assignment requests can never both claim the same
   * drone. `MissionsService.assignDrone()` previously read the drone's
   * status via `getById()`, decided it was available, and only *then*
   * called `setStatus()` in a later, separate statement — a second
   * concurrent request's own `getById()` could run in that window and see
   * the same still-IDLE drone, so both requests would proceed to assign it.
   * Throws `ConflictException` (not a silent no-op) when the drone lost the
   * race or became unavailable between the caller's own checks and this
   * call, since the caller (a mission assignment) must not silently succeed
   * without a real drone behind it.
   */
  async assignIfAvailable(droneId: string, note: string): Promise<DroneView> {
    const result = await this.prisma.drone.updateMany({
      where: { id: droneId, status: "IDLE", isMaintenanceMode: false },
      data: { status: "ASSIGNED" },
    });
    if (result.count === 0) {
      throw new ConflictException("Drone is no longer available for assignment");
    }
    await this.recordHealthLog(droneId, "ASSIGNED", note);
    const drone = await this.getOrThrow(droneId);
    this.eventEmitter.emit("drone.status_changed", { droneId, fromStatus: "IDLE", toStatus: "ASSIGNED" });
    return this.toView(drone);
  }

  async applyTelemetryUpdate(droneId: string, sample: TelemetryUpdatePayload): Promise<Drone> {
    const existing = await this.prisma.drone.findUniqueOrThrow({ where: { id: droneId } });

    const updated = await this.prisma.drone.update({
      where: { id: droneId },
      data: {
        currentLat: sample.lat,
        currentLng: sample.lng,
        altitudeMeters: sample.altitudeMeters,
        speedMps: sample.speedMps,
        headingDegrees: sample.headingDegrees,
        batteryPercent: sample.batteryPercent,
        signalStrengthPercent: sample.signalStrengthPercent,
        lastTelemetryAt: new Date(),
      },
    });

    if (sample.batteryPercent !== existing.batteryPercent) {
      await this.prisma.batteryLog.create({ data: { droneId, batteryPercent: sample.batteryPercent } });
      this.eventEmitter.emit("drone.battery_updated", { droneId, batteryPercent: sample.batteryPercent });

      const lowBatteryThreshold = this.configService.get("DRONE_LOW_BATTERY_THRESHOLD_PERCENT", { infer: true });
      if (sample.batteryPercent <= lowBatteryThreshold && existing.batteryPercent > lowBatteryThreshold) {
        await this.recordHealthLog(droneId, existing.status, `Low battery: ${sample.batteryPercent}%`);
      }
    }

    this.eventEmitter.emit("drone.location_updated", { droneId, lat: sample.lat, lng: sample.lng });
    return updated;
  }

  /** Ensures the in-process `SimulatedDroneAdapter` has a live entry for this drone before `MissionsService` issues flight commands — a drone created without a home hub, or registered before this process started, wouldn't otherwise have simulator state. */
  ensureSimulatedAdapterRegistered(drone: Drone): void {
    if (drone.adapterType !== "SIMULATED") {
      return;
    }
    this.simulatedAdapter.registerDrone(drone.id, {
      lat: drone.currentLat ?? 0,
      lng: drone.currentLng ?? 0,
      batteryPercent: drone.batteryPercent,
      homeLat: drone.currentLat ?? 0,
      homeLng: drone.currentLng ?? 0,
    });
  }

  async getHubCoordinates(hubId: string): Promise<{ lat: number; lng: number } | null> {
    const rows = await this.prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
      SELECT ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
      FROM fulfillment_hubs WHERE id = ${hubId}
    `;
    return rows[0] ?? null;
  }

  private async recordHealthLog(droneId: string, status: DroneStatus, note?: string): Promise<void> {
    await this.prisma.droneHealthLog.create({ data: { droneId, status, note } });
  }

  private async getOrThrow(id: string): Promise<Drone> {
    const drone = await this.prisma.drone.findUnique({ where: { id } });
    if (!drone) {
      throw new NotFoundException("Drone not found");
    }
    return drone;
  }

  private toView(drone: Drone): DroneView {
    return {
      id: drone.id,
      serialNumber: drone.serialNumber,
      name: drone.name,
      model: drone.model,
      adapterType: drone.adapterType,
      status: drone.status,
      homeHubId: drone.homeHubId,
      batteryPercent: drone.batteryPercent,
      batteryHealthPercent: drone.batteryHealthPercent,
      batteryCycles: drone.batteryCycles,
      currentLat: drone.currentLat,
      currentLng: drone.currentLng,
      altitudeMeters: drone.altitudeMeters,
      speedMps: drone.speedMps,
      headingDegrees: drone.headingDegrees,
      signalStrengthPercent: drone.signalStrengthPercent,
      maxPayloadKg: drone.maxPayloadKg,
      maxRangeKm: drone.maxRangeKm,
      maxSpeedMps: drone.maxSpeedMps,
      maxAltitudeMeters: drone.maxAltitudeMeters,
      isMaintenanceMode: drone.isMaintenanceMode,
      maintenanceNote: drone.maintenanceNote,
      lastTelemetryAt: drone.lastTelemetryAt ? drone.lastTelemetryAt.toISOString() : null,
      totalFlightHours: drone.totalFlightHours,
      totalMissionsCompleted: drone.totalMissionsCompleted,
      createdAt: drone.createdAt.toISOString(),
    };
  }
}
