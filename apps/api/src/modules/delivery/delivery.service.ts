import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Prisma, type Delivery, type DeliveryStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { EnvConfig } from "../../config/env.validation";
import { detectImageType } from "../../common/security/file-upload.util";
import { generateVerificationCode, hashVerificationCode } from "../../common/security/verification-code.util";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { StorageService } from "../../storage/storage.service";
import { AuditService } from "../audit/audit.service";
import { AiService } from "../ai/ai.service";
import { DEFAULT_DRONE_MAX_SPEED_MPS } from "../ai/ai.constants";
import { haversineMeters } from "../ai/route-geo.util";
import { DronesService } from "../drones/drones.service";
import { resolveDeterministicDestination } from "../missions/route.util";
import type { OrderSnapshotForDelivery } from "../orders/orders.service";
import { WeatherService } from "../weather/weather.service";
import type { AdvanceStatusDto } from "./dto/advance-status.dto";
import type { AssignHubDto } from "./dto/assign-hub.dto";
import type { CancelDeliveryDto } from "./dto/cancel-delivery.dto";
import type { ListDeliveriesQueryDto } from "./dto/list-deliveries-query.dto";
import type { RedeliverDto } from "./dto/redeliver.dto";
import type { VerifyDeliveryDto } from "./dto/verify-delivery.dto";
import {
  HUB_ASSIGNABLE_STATUSES,
  HUB_UNASSIGNABLE_STATUSES,
  REDELIVERABLE_STATUSES,
  RETURNABLE_TO_HUB_STATUSES,
  VERIFIABLE_STATUSES,
  isCancellable,
  nextAdvanceStatus,
} from "./delivery-state-machine";

/** Used only if a hub's coordinates are somehow unresolvable — a defensive fallback, not the normal path. */
const FALLBACK_ETA_MINUTES = 45;

const deliveryInclude = {
  hub: { select: { id: true, name: true, code: true } },
  order: {
    select: { id: true, orderNumber: true, userId: true, items: { select: { productName: true, quantity: true } } },
  },
  events: { orderBy: { createdAt: "asc" } },
  proofOfDelivery: true,
  // Phase 6: a lightweight read-only join so the delivery detail response
  // can surface drone/mission status without a second round trip or a
  // cross-module service call (MissionsModule already imports DeliveryModule
  // for the reverse read — this avoids the circular alternative).
  mission: { select: { id: true, status: true, safetyState: true, droneId: true } },
} satisfies Prisma.DeliveryInclude;

type DeliveryWithRelations = Prisma.DeliveryGetPayload<{ include: typeof deliveryInclude }>;

export interface DeliveryEventView {
  id: string;
  fromStatus: DeliveryStatus | null;
  toStatus: DeliveryStatus;
  note: string | null;
  createdAt: string;
}

export interface DeliverySummaryView {
  id: string;
  orderId: string;
  orderNumber: string;
  status: DeliveryStatus;
  priority: Delivery["priority"];
  hubId: string | null;
  hubName: string | null;
  estimatedDeliveryAt: string | null;
  createdAt: string;
}

export interface DeliverySnapshotForMission {
  deliveryId: string;
  orderId: string;
  hubId: string | null;
  status: DeliveryStatus;
  deliveryAddress: unknown;
  priority: Delivery["priority"];
}

export interface DeliveryTrackingDroneView {
  id: string;
  name: string;
  batteryPercent: number;
  currentLat: number | null;
  currentLng: number | null;
  altitudeMeters: number | null;
  speedMps: number | null;
  headingDegrees: number | null;
  signalStrengthPercent: number | null;
  lastTelemetryAt: string | null;
}

export interface DeliveryTrackingView {
  deliveryId: string;
  deliveryStatus: DeliveryStatus;
  estimatedDeliveryAt: string | null;
  mission: {
    id: string;
    status: string;
    safetyState: string;
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
    waypoints: Array<{ id: string; sequence: number; lat: number; lng: number; status: string }>;
    drone: DeliveryTrackingDroneView | null;
  } | null;
}

export interface DeliveryDetailView extends DeliverySummaryView {
  deliveryAddress: unknown;
  specialInstructions: string | null;
  scheduledWindowStart: string | null;
  scheduledWindowEnd: string | null;
  verificationExpiresAt: string | null;
  verificationAttempts: number;
  verifiedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  itemSummary: string;
  missionId: string | null;
  missionStatus: string | null;
  missionSafetyState: string | null;
  events: DeliveryEventView[];
  proofOfDelivery: {
    method: "OTP" | "QR";
    verifiedAt: string;
    recipientNote: string | null;
    imageUrl: string | null;
  } | null;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly auditService: AuditService,
    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dronesService: DronesService,
    private readonly weatherService: WeatherService,
    private readonly aiService: AiService,
  ) {}

  /** Called by `DeliveryEventsListener` on `order.confirmed` — never by a direct cross-module call from OrdersModule. */
  async createFromOrder(snapshot: OrderSnapshotForDelivery): Promise<void> {
    try {
      await this.prisma.delivery.create({
        data: {
          orderId: snapshot.orderId,
          deliveryAddress: snapshot.shippingAddress as Prisma.InputJsonValue,
          events: { create: { toStatus: "PENDING_ASSIGNMENT" } },
        },
      });
    } catch (error) {
      // Duplicate `order.confirmed` delivery (shouldn't happen given the
      // upstream idempotency guard, but the unique constraint on `order_id`
      // is the defensive backstop) — a safe no-op, same philosophy as
      // PaymentEvent's uniqueness check.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return;
      }
      throw error;
    }

    const delivery = await this.prisma.delivery.findUniqueOrThrow({ where: { orderId: snapshot.orderId } });
    await this.auditService.log({
      action: "delivery.created",
      targetType: "Delivery",
      targetId: delivery.id,
      metadata: { orderId: snapshot.orderId, orderNumber: snapshot.orderNumber },
    });
  }

  /** Called by `DeliveryEventsListener` on `order.cancelled` — cancels the linked delivery if one exists and hasn't completed. */
  async cancelForOrder(orderId: string, reason: string): Promise<void> {
    const delivery = await this.prisma.delivery.findUnique({ where: { orderId } });
    if (!delivery || !isCancellable(delivery.status)) {
      return;
    }
    await this.applyCancel(delivery.id, delivery.status, null, reason);
  }

  async listOwnDeliveries(
    userId: string,
    query: ListDeliveriesQueryDto,
  ): Promise<{ deliveries: DeliverySummaryView[]; total: number; page: number; pageSize: number }> {
    return this.listInternal({ order: { userId } }, query);
  }

  async listAllDeliveries(
    query: ListDeliveriesQueryDto,
  ): Promise<{ deliveries: DeliverySummaryView[]; total: number; page: number; pageSize: number }> {
    const where: Prisma.DeliveryWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.hubId ? { hubId: query.hubId } : {}),
    };
    return this.listInternal(where, query);
  }

  async getDeliveryForViewer(deliveryId: string, viewer: AuthenticatedUser): Promise<DeliveryDetailView> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId }, include: deliveryInclude });
    if (!delivery || !this.canView(delivery, viewer)) {
      throw new NotFoundException("Delivery not found");
    }
    return this.toDetailView(delivery);
  }

  /**
   * Phase 7 — a narrow, customer-safe read for live tracking. Deliberately
   * not the same as `MissionsService`/`DronesService`'s staff-only views:
   * customers have no `missions.read`/`drones.read` permission at all (Phase
   * 6's explicit RBAC decision), so this exposes only the fields Phase 7's
   * customer tracking UI actually needs (drone identifier, position,
   * battery, ETA) through the delivery ownership check that already governs
   * every other customer-facing delivery endpoint — never the full staff
   * mission/drone detail.
   */
  async getTrackingSnapshot(deliveryId: string, viewer: AuthenticatedUser): Promise<DeliveryTrackingView> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: { select: { userId: true } } },
    });
    if (!delivery || !this.canView(delivery, viewer)) {
      throw new NotFoundException("Delivery not found");
    }

    const mission = await this.prisma.mission.findUnique({
      where: { deliveryId },
      include: {
        drone: {
          select: {
            id: true,
            name: true,
            batteryPercent: true,
            currentLat: true,
            currentLng: true,
            altitudeMeters: true,
            speedMps: true,
            headingDegrees: true,
            signalStrengthPercent: true,
            lastTelemetryAt: true,
          },
        },
        waypoints: { orderBy: { sequence: "asc" } },
      },
    });

    return {
      deliveryId,
      deliveryStatus: delivery.status,
      estimatedDeliveryAt: delivery.estimatedDeliveryAt ? delivery.estimatedDeliveryAt.toISOString() : null,
      mission: mission
        ? {
            id: mission.id,
            status: mission.status,
            safetyState: mission.safetyState,
            originLat: mission.originLat,
            originLng: mission.originLng,
            destinationLat: mission.destinationLat,
            destinationLng: mission.destinationLng,
            waypoints: mission.waypoints.map((w) => ({ id: w.id, sequence: w.sequence, lat: w.lat, lng: w.lng, status: w.status })),
            drone: mission.drone
              ? {
                  id: mission.drone.id,
                  name: mission.drone.name,
                  batteryPercent: mission.drone.batteryPercent,
                  currentLat: mission.drone.currentLat,
                  currentLng: mission.drone.currentLng,
                  altitudeMeters: mission.drone.altitudeMeters,
                  speedMps: mission.drone.speedMps,
                  headingDegrees: mission.drone.headingDegrees,
                  signalStrengthPercent: mission.drone.signalStrengthPercent,
                  lastTelemetryAt: mission.drone.lastTelemetryAt ? mission.drone.lastTelemetryAt.toISOString() : null,
                }
              : null,
          }
        : null,
    };
  }

  /** Cross-module read for `MissionsService` (`getDeliverySnapshotForMission` — same convention as `OrdersService.getOrderSnapshotForDelivery`) — never a direct query of the `deliveries` table from `MissionsModule`. */
  async getDeliverySnapshotForMission(deliveryId: string): Promise<DeliverySnapshotForMission> {
    const delivery = await this.prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    return {
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      hubId: delivery.hubId,
      status: delivery.status,
      deliveryAddress: delivery.deliveryAddress,
      priority: delivery.priority,
    };
  }

  /**
   * Phase 9 — a narrow, additive write letting `MissionsService` refine
   * `estimatedDeliveryAt` once a real mission route exists (a better
   * estimate than the drone-agnostic one `predictEstimatedDelivery` made at
   * hub-assignment time). A plain field update, not a status transition —
   * deliberately does not call `recordEvent()`/emit `delivery.status_changed`,
   * since the delivery's status isn't changing, only the ETA number
   * `DeliveryDetailView`/`DeliveryTrackingView` already surface.
   */
  async refineEstimatedDelivery(deliveryId: string, etaAt: Date): Promise<void> {
    await this.prisma.delivery.updateMany({ where: { id: deliveryId }, data: { estimatedDeliveryAt: etaAt } });
  }

  /** Called by `DeliveryMissionEventsListener` when `MissionsModule` emits `mission.created` — the mission-driven equivalent of the Phase 5 manual "advance" for exactly this transition. */
  async markMissionPlanned(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || delivery.status !== "HUB_ASSIGNED") {
      return;
    }
    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { status: "MISSION_PLANNED" } });
    await this.recordEvent(deliveryId, delivery.status, "MISSION_PLANNED", null, "Mission created");
  }

  /** Called on `mission.started`. */
  async markDroneDispatched(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || delivery.status !== "MISSION_PLANNED") {
      return;
    }
    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { status: "DRONE_DISPATCHED" } });
    await this.recordEvent(deliveryId, delivery.status, "DRONE_DISPATCHED", null, "Mission dispatched");
  }

  /** Called on the first `mission.progressed` after dispatch. Idempotent — later progress ticks are no-ops here since status is no longer `DRONE_DISPATCHED`. */
  async markInTransit(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || delivery.status !== "DRONE_DISPATCHED") {
      return;
    }
    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { status: "IN_TRANSIT" } });
    await this.recordEvent(deliveryId, delivery.status, "IN_TRANSIT", null, "Drone en route");
  }

  /** Called on `mission.completed` (drone physically arrived) — generates the OTP/QR code exactly as the Phase 5 manual `advanceStatus` did for this transition. */
  async markDeliveredPendingVerification(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || delivery.status !== "IN_TRANSIT") {
      return;
    }
    const data: Prisma.DeliveryUpdateInput = { status: "DELIVERED_PENDING_VERIFICATION" };
    await this.issueVerificationCode(deliveryId, data);
    await this.prisma.delivery.update({ where: { id: deliveryId }, data });
    await this.recordEvent(deliveryId, delivery.status, "DELIVERED_PENDING_VERIFICATION", null, "Drone arrived at destination");
    await this.auditService.log({
      action: "delivery.status_advanced",
      targetType: "Delivery",
      targetId: deliveryId,
      metadata: { fromStatus: delivery.status, toStatus: "DELIVERED_PENDING_VERIFICATION", trigger: "mission" },
    });
  }

  /** Called on `mission.aborted` (RTH completed or an emergency abort) — the package never reached the customer. */
  async markReturnedToHubFromMission(deliveryId: string, reason: string): Promise<void> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || ["COMPLETED", "CANCELLED", "RETURNED_TO_HUB"].includes(delivery.status)) {
      return;
    }
    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { status: "RETURNED_TO_HUB" } });
    await this.redisService.client.del(this.verificationRedisKey(deliveryId));
    await this.recordEvent(deliveryId, delivery.status, "RETURNED_TO_HUB", null, reason);
    await this.auditService.log({
      action: "delivery.returned_to_hub",
      targetType: "Delivery",
      targetId: deliveryId,
      metadata: { reason, trigger: "mission" },
    });
  }

  async getByOrderId(orderId: string, viewer: AuthenticatedUser): Promise<DeliveryDetailView> {
    const delivery = await this.prisma.delivery.findUnique({ where: { orderId }, include: deliveryInclude });
    if (!delivery || !this.canView(delivery, viewer)) {
      throw new NotFoundException("Delivery not found");
    }
    return this.toDetailView(delivery);
  }

  async assignHub(deliveryId: string, dto: AssignHubDto, actor: AuthenticatedUser): Promise<DeliveryDetailView> {
    const delivery = await this.getOwnedByIdOrThrow(deliveryId);
    if (!HUB_ASSIGNABLE_STATUSES.includes(delivery.status)) {
      throw new ConflictException(`Delivery cannot be assigned a hub from status ${delivery.status}`);
    }

    const hub = await this.prisma.fulfillmentHub.findUnique({ where: { id: dto.hubId } });
    if (!hub || !hub.isActive) {
      throw new BadRequestException("Fulfillment hub not found or inactive");
    }

    const priority = dto.priority ?? delivery.priority;
    const estimatedDeliveryAt = await this.predictEstimatedDelivery(deliveryId, hub.id);

    await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        hubId: hub.id,
        priority,
        estimatedDeliveryAt,
        scheduledWindowStart: dto.scheduledWindowStart ? new Date(dto.scheduledWindowStart) : undefined,
        scheduledWindowEnd: dto.scheduledWindowEnd ? new Date(dto.scheduledWindowEnd) : undefined,
        status: "HUB_ASSIGNED",
      },
    });
    await this.recordEvent(deliveryId, delivery.status, "HUB_ASSIGNED", actor.sub, `Assigned to hub ${hub.name}`);
    await this.auditService.log({
      actorId: actor.sub,
      action: "delivery.hub_assigned",
      targetType: "Delivery",
      targetId: deliveryId,
      metadata: { hubId: hub.id, hubName: hub.name },
    });

    return this.getDeliveryForViewer(deliveryId, actor);
  }

  async unassignHub(deliveryId: string, actor: AuthenticatedUser): Promise<DeliveryDetailView> {
    const delivery = await this.getOwnedByIdOrThrow(deliveryId);
    if (!HUB_UNASSIGNABLE_STATUSES.includes(delivery.status)) {
      throw new ConflictException(`Delivery hub cannot be unassigned from status ${delivery.status}`);
    }

    await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        hubId: null,
        estimatedDeliveryAt: null,
        scheduledWindowStart: null,
        scheduledWindowEnd: null,
        status: "PENDING_ASSIGNMENT",
      },
    });
    await this.recordEvent(deliveryId, delivery.status, "PENDING_ASSIGNMENT", actor.sub, "Hub assignment removed");
    await this.auditService.log({
      actorId: actor.sub,
      action: "delivery.hub_unassigned",
      targetType: "Delivery",
      targetId: deliveryId,
    });

    return this.getDeliveryForViewer(deliveryId, actor);
  }

  /** The manual "move to the next step" action a Delivery Coordinator drives — see delivery-state-machine.ts. */
  async advanceStatus(deliveryId: string, dto: AdvanceStatusDto, actor: AuthenticatedUser): Promise<DeliveryDetailView> {
    const delivery = await this.getOwnedByIdOrThrow(deliveryId);

    // Once a Mission exists for this delivery (Phase 6), every further status
    // change is driven by mission events (see the mark* methods above and
    // DeliveryMissionEventsListener) — a direct Prisma existence check rather
    // than a MissionsService call, to avoid DeliveryModule <-> MissionsModule
    // importing each other (MissionsModule already imports DeliveryModule for
    // the snapshot read). A delivery that never gets a mission created for it
    // keeps working exactly as it did in Phase 5 — this check is additive.
    const mission = await this.prisma.mission.findUnique({ where: { deliveryId }, select: { id: true } });
    if (mission) {
      throw new ConflictException(
        "This delivery is drone/mission-driven — use mission actions (assign drone, start, simulate progress) instead of manual advance",
      );
    }

    const next = nextAdvanceStatus(delivery.status);
    if (!next) {
      throw new ConflictException(`Delivery cannot be advanced from status ${delivery.status}`);
    }

    const data: Prisma.DeliveryUpdateInput = { status: next };
    if (next === "DELIVERED_PENDING_VERIFICATION") {
      await this.issueVerificationCode(deliveryId, data);
    }

    await this.prisma.delivery.update({ where: { id: deliveryId }, data });
    await this.recordEvent(deliveryId, delivery.status, next, actor.sub, dto.note);
    await this.auditService.log({
      actorId: actor.sub,
      action: "delivery.status_advanced",
      targetType: "Delivery",
      targetId: deliveryId,
      metadata: { fromStatus: delivery.status, toStatus: next },
    });

    return this.getDeliveryForViewer(deliveryId, actor);
  }

  async cancel(deliveryId: string, dto: CancelDeliveryDto, actor: AuthenticatedUser): Promise<DeliveryDetailView> {
    const delivery = await this.getOwnedByIdOrThrow(deliveryId);
    if (!isCancellable(delivery.status)) {
      throw new ConflictException(`Delivery cannot be cancelled from status ${delivery.status}`);
    }
    await this.applyCancel(deliveryId, delivery.status, actor.sub, dto.reason);
    return this.getDeliveryForViewer(deliveryId, actor);
  }

  async markReturnedToHub(deliveryId: string, actor: AuthenticatedUser, note?: string): Promise<DeliveryDetailView> {
    const delivery = await this.getOwnedByIdOrThrow(deliveryId);
    if (!RETURNABLE_TO_HUB_STATUSES.includes(delivery.status)) {
      throw new ConflictException(`Delivery cannot be marked returned-to-hub from status ${delivery.status}`);
    }

    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { status: "RETURNED_TO_HUB" } });
    await this.redisService.client.del(this.verificationRedisKey(deliveryId));
    await this.recordEvent(deliveryId, delivery.status, "RETURNED_TO_HUB", actor.sub, note);
    await this.auditService.log({
      actorId: actor.sub,
      action: "delivery.returned_to_hub",
      targetType: "Delivery",
      targetId: deliveryId,
      metadata: { note },
    });

    return this.getDeliveryForViewer(deliveryId, actor);
  }

  async redeliver(deliveryId: string, dto: RedeliverDto, actor: AuthenticatedUser): Promise<DeliveryDetailView> {
    const delivery = await this.getOwnedByIdOrThrow(deliveryId);
    if (!REDELIVERABLE_STATUSES.includes(delivery.status)) {
      throw new ConflictException(`Redelivery cannot be scheduled from status ${delivery.status}`);
    }

    await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: "REDELIVERY_SCHEDULED",
        scheduledWindowStart: dto.scheduledWindowStart ? new Date(dto.scheduledWindowStart) : undefined,
        scheduledWindowEnd: dto.scheduledWindowEnd ? new Date(dto.scheduledWindowEnd) : undefined,
      },
    });
    await this.recordEvent(deliveryId, delivery.status, "REDELIVERY_SCHEDULED", actor.sub, "Redelivery scheduled");
    await this.auditService.log({
      actorId: actor.sub,
      action: "delivery.redelivery_scheduled",
      targetType: "Delivery",
      targetId: deliveryId,
    });

    return this.getDeliveryForViewer(deliveryId, actor);
  }

  /**
   * Owner-only. Reads the raw code from Redis (never Postgres — only its
   * hash lives there) so the customer can view it repeatedly while it's
   * valid, the same way a real delivery app persistently shows an
   * in-progress OTP. If Redis has already expired/evicted it, the customer
   * gets a clear "unavailable" error rather than a stale or wrong code.
   */
  async getVerificationCode(deliveryId: string, viewer: AuthenticatedUser): Promise<{ code: string; qrPayload: string; expiresAt: string }> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: { select: { userId: true } } },
    });
    if (!delivery || delivery.order.userId !== viewer.sub) {
      throw new NotFoundException("Delivery not found");
    }
    if (!VERIFIABLE_STATUSES.includes(delivery.status) || !delivery.verificationExpiresAt) {
      throw new ConflictException("No verification code is currently active for this delivery");
    }

    const code = await this.redisService.client.get(this.verificationRedisKey(deliveryId));
    if (!code) {
      throw new NotFoundException("Verification code is no longer available — ask a Delivery Coordinator to advance the delivery again");
    }

    return {
      code,
      qrPayload: this.qrPayload(deliveryId, code),
      expiresAt: delivery.verificationExpiresAt.toISOString(),
    };
  }

  /** Owner-only. Validates the submitted code against its stored hash — every branch is a validated state transition, never a silent pass-through. */
  async verify(deliveryId: string, dto: VerifyDeliveryDto, viewer: AuthenticatedUser): Promise<DeliveryDetailView> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: { select: { userId: true } } },
    });
    if (!delivery || delivery.order.userId !== viewer.sub) {
      throw new NotFoundException("Delivery not found");
    }
    if (!VERIFIABLE_STATUSES.includes(delivery.status) || !delivery.verificationCodeHash) {
      throw new ConflictException(`Delivery is not awaiting verification (status ${delivery.status})`);
    }

    const maxAttempts = this.configService.get("DELIVERY_VERIFICATION_MAX_ATTEMPTS", { infer: true });

    if (!delivery.verificationExpiresAt || delivery.verificationExpiresAt < new Date()) {
      await this.failVerification(delivery.id, delivery.status, "Verification code expired");
      throw new ConflictException("Verification code has expired — ask a Delivery Coordinator to schedule a redelivery");
    }

    const submittedHash = hashVerificationCode(dto.code);
    const isMatch = timingSafeEqualHex(submittedHash, delivery.verificationCodeHash);

    if (!isMatch) {
      const attempts = delivery.verificationAttempts + 1;
      if (attempts >= maxAttempts) {
        await this.failVerification(delivery.id, delivery.status, "Maximum verification attempts exceeded", attempts);
        throw new ConflictException("Incorrect code — maximum attempts exceeded, a redelivery must be scheduled");
      }
      await this.prisma.delivery.update({ where: { id: deliveryId }, data: { verificationAttempts: attempts } });
      throw new ConflictException(`Incorrect verification code (${maxAttempts - attempts} attempt(s) remaining)`);
    }

    await this.prisma.$transaction([
      this.prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status: "COMPLETED",
          verifiedAt: new Date(),
          verificationCodeHash: null,
          verificationExpiresAt: null,
        },
      }),
      this.prisma.proofOfDelivery.create({
        data: { deliveryId, method: dto.method },
      }),
    ]);
    await this.redisService.client.del(this.verificationRedisKey(deliveryId));
    await this.recordEvent(deliveryId, delivery.status, "COMPLETED", viewer.sub, `Verified via ${dto.method}`);
    await this.auditService.log({
      actorId: viewer.sub,
      action: "delivery.verified",
      targetType: "Delivery",
      targetId: deliveryId,
      metadata: { method: dto.method },
    });

    return this.getDeliveryForViewer(deliveryId, viewer);
  }

  async uploadProofOfDeliveryImage(
    deliveryId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    recipientNote: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<DeliveryDetailView> {
    const proof = await this.prisma.proofOfDelivery.findUnique({ where: { deliveryId } });
    if (!proof) {
      throw new ConflictException("Delivery has not been verified yet — proof of delivery does not exist");
    }

    // Phase 12 fix: same magic-number detection as `CatalogService.uploadProductImage()`
    // — never trust the client-supplied Content-Type/filename.
    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException("Only JPEG, PNG, or WebP image uploads are allowed");
    }

    const storageKey = `deliveries/${deliveryId}/${randomUUID()}.${detected.extension}`;

    await this.storageService.client.send(
      new PutObjectCommand({
        Bucket: this.storageService.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: detected.mime,
      }),
    );

    await this.prisma.proofOfDelivery.update({
      where: { deliveryId },
      data: { imageStorageKey: storageKey, recipientNote: recipientNote ?? proof.recipientNote },
    });
    await this.auditService.log({
      actorId: actor.sub,
      action: "delivery.proof_of_delivery_uploaded",
      targetType: "Delivery",
      targetId: deliveryId,
    });

    return this.getDeliveryForViewer(deliveryId, actor);
  }

  /**
   * Phase 12 fix: proof-of-delivery photos used to be served through the
   * fully public, unauthenticated `MediaController` — anyone who obtained
   * the URL (a shared screenshot, browser history, a referrer header) had
   * permanent access. This re-runs the exact same ownership check every
   * other customer-facing delivery read uses (`canView()`) before ever
   * touching the object store.
   */
  async getProofOfDeliveryStorageKey(deliveryId: string, viewer: AuthenticatedUser): Promise<string> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: { select: { userId: true } }, proofOfDelivery: true },
    });
    if (!delivery || !this.canView(delivery, viewer)) {
      throw new NotFoundException("Delivery not found");
    }
    if (!delivery.proofOfDelivery?.imageStorageKey) {
      throw new NotFoundException("No proof-of-delivery image exists for this delivery");
    }
    return delivery.proofOfDelivery.imageStorageKey;
  }

  private async listInternal(
    where: Prisma.DeliveryWhereInput,
    query: ListDeliveriesQueryDto,
  ): Promise<{ deliveries: DeliverySummaryView[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [deliveries, total] = await this.prisma.$transaction([
      this.prisma.delivery.findMany({
        where,
        include: deliveryInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.delivery.count({ where }),
    ]);

    return { deliveries: deliveries.map((delivery) => this.toSummaryView(delivery)), total, page, pageSize };
  }

  private async getOwnedByIdOrThrow(deliveryId: string): Promise<Delivery> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }
    return delivery;
  }

  private async issueVerificationCode(deliveryId: string, data: Prisma.DeliveryUpdateInput): Promise<void> {
    const ttlMinutes = this.configService.get("DELIVERY_VERIFICATION_TTL_MINUTES", { infer: true });
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    data.verificationCodeHash = hashVerificationCode(code);
    data.verificationExpiresAt = expiresAt;
    data.verificationAttempts = 0;

    await this.redisService.client.set(this.verificationRedisKey(deliveryId), code, "EX", ttlMinutes * 60);
  }

  private async failVerification(
    deliveryId: string,
    fromStatus: DeliveryStatus,
    reason: string,
    attempts?: number,
  ): Promise<void> {
    await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: "VERIFICATION_FAILED", verificationAttempts: attempts },
    });
    await this.redisService.client.del(this.verificationRedisKey(deliveryId));
    await this.recordEvent(deliveryId, fromStatus, "VERIFICATION_FAILED", null, reason);
    await this.auditService.log({
      action: "delivery.verification_failed",
      targetType: "Delivery",
      targetId: deliveryId,
      metadata: { reason },
    });
  }

  private async applyCancel(
    deliveryId: string,
    fromStatus: DeliveryStatus,
    actorId: string | null,
    reason: string | undefined,
  ): Promise<void> {
    await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    await this.redisService.client.del(this.verificationRedisKey(deliveryId));
    await this.recordEvent(deliveryId, fromStatus, "CANCELLED", actorId, reason);
    await this.auditService.log({
      actorId: actorId ?? undefined,
      action: "delivery.cancelled",
      targetType: "Delivery",
      targetId: deliveryId,
      metadata: { reason },
    });
  }

  /**
   * Phase 9 — replaces Phase 5's flat `EtaEstimator` placeholder with the
   * real `ETAPredictor` (`AiService.predictEta`), using the same
   * deterministic-placeholder destination (`resolveDeterministicDestination`,
   * Phase 6) and current weather at the hub (`WeatherService`, Phase 8) —
   * the identical inputs `MissionsService` will use for the real route once
   * a mission exists, so this early estimate and the mission's own
   * refinement stay consistent rather than using two different models.
   * `DEFAULT_DRONE_MAX_SPEED_MPS` stands in for a real drone's speed since
   * none is assigned until later.
   */
  private async predictEstimatedDelivery(deliveryId: string, hubId: string): Promise<Date> {
    const hubCoords = await this.dronesService.getHubCoordinates(hubId);
    if (!hubCoords) {
      return new Date(Date.now() + FALLBACK_ETA_MINUTES * 60_000);
    }
    const destination = resolveDeterministicDestination(deliveryId, hubCoords);
    const distanceMeters = haversineMeters(hubCoords, destination);
    const zoneKey = this.weatherService.zoneKeyFor(hubCoords.lat, hubCoords.lng);
    const weather = await this.weatherService.getCurrentWeather(hubCoords.lat, hubCoords.lng, zoneKey);
    const weatherSafety = this.weatherService.evaluateSafety(weather);

    const prediction = await this.aiService.predictEta(
      {
        distanceMeters,
        droneMaxSpeedMps: DEFAULT_DRONE_MAX_SPEED_MPS,
        windSpeedMps: weather.windSpeedMps,
        weatherCondition: weather.condition,
        weatherSafetyLevel: weatherSafety.level,
      },
      { deliveryId },
    );
    return prediction.etaAt;
  }

  /**
   * The single call site every status transition in this service goes
   * through — emitting `delivery.status_changed` here (rather than at each
   * of the ~10 call sites) guarantees the realtime layer (Phase 7,
   * `RealtimeBroadcasterService`) never misses a transition, however it was
   * triggered (manual advance, hub assignment, cancellation, verification,
   * or a `DeliveryMissionEventsListener` reaction to a mission event).
   * Customer-facing only — see `docs/ARCHITECTURE.md`'s Realtime section for
   * why this doesn't also fan out to the admin `/ops` channel.
   */
  private async recordEvent(
    deliveryId: string,
    fromStatus: DeliveryStatus | null,
    toStatus: DeliveryStatus,
    actorId: string | null,
    note?: string,
  ): Promise<void> {
    await this.prisma.deliveryEvent.create({
      data: { deliveryId, fromStatus, toStatus, actorId, note },
    });
    this.eventEmitter.emit("delivery.status_changed", { deliveryId, fromStatus, toStatus, note: note ?? null });
  }

  private verificationRedisKey(deliveryId: string): string {
    return `delivery:verification-code:${deliveryId}`;
  }

  private qrPayload(deliveryId: string, code: string): string {
    return `SKYNAV-DELIVERY:${deliveryId}:${code}`;
  }

  private canView(delivery: { order: { userId: string } }, viewer: AuthenticatedUser): boolean {
    const isStaff = viewer.permissions.includes("delivery.read");
    const isOwner = delivery.order.userId === viewer.sub && viewer.permissions.includes("orders.read_own");
    return isStaff || isOwner;
  }

  private toSummaryView(delivery: DeliveryWithRelations): DeliverySummaryView {
    return {
      id: delivery.id,
      orderId: delivery.orderId,
      orderNumber: delivery.order.orderNumber,
      status: delivery.status,
      priority: delivery.priority,
      hubId: delivery.hubId,
      hubName: delivery.hub?.name ?? null,
      estimatedDeliveryAt: delivery.estimatedDeliveryAt ? delivery.estimatedDeliveryAt.toISOString() : null,
      createdAt: delivery.createdAt.toISOString(),
    };
  }

  private toDetailView(delivery: DeliveryWithRelations): DeliveryDetailView {
    const itemSummary = delivery.order.items
      .map((item) => `${item.productName}${item.quantity > 1 ? ` x${item.quantity}` : ""}`)
      .join(", ");

    return {
      ...this.toSummaryView(delivery),
      deliveryAddress: delivery.deliveryAddress,
      specialInstructions: delivery.specialInstructions,
      scheduledWindowStart: delivery.scheduledWindowStart ? delivery.scheduledWindowStart.toISOString() : null,
      scheduledWindowEnd: delivery.scheduledWindowEnd ? delivery.scheduledWindowEnd.toISOString() : null,
      verificationExpiresAt: delivery.verificationExpiresAt ? delivery.verificationExpiresAt.toISOString() : null,
      verificationAttempts: delivery.verificationAttempts,
      verifiedAt: delivery.verifiedAt ? delivery.verifiedAt.toISOString() : null,
      cancelledAt: delivery.cancelledAt ? delivery.cancelledAt.toISOString() : null,
      cancelReason: delivery.cancelReason,
      itemSummary,
      missionId: delivery.mission?.id ?? null,
      missionStatus: delivery.mission?.status ?? null,
      missionSafetyState: delivery.mission?.safetyState ?? null,
      events: delivery.events.map((event) => ({
        id: event.id,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      })),
      proofOfDelivery: delivery.proofOfDelivery
        ? {
            method: delivery.proofOfDelivery.method,
            verifiedAt: delivery.proofOfDelivery.verifiedAt.toISOString(),
            recipientNote: delivery.proofOfDelivery.recipientNote,
            // Phase 12 fix: was `/api/v1/media/<key>` — the fully public,
            // unauthenticated media proxy. A proof-of-delivery photo is
            // PII-adjacent (often shows the delivery address/doorstep); it
            // now streams through an ownership-checked route instead (see
            // `DeliveryController.getProofOfDeliveryImage`), never the
            // public proxy `MediaController` still serves product images
            // through.
            imageUrl: delivery.proofOfDelivery.imageStorageKey ? `/api/v1/deliveries/${delivery.id}/proof-of-delivery/image` : null,
          }
        : null,
    };
  }
}

/** Constant-time comparison of two equal-length hex hash strings — defense in depth beyond the fact that a hash, not the raw secret, is what's compared. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
