import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Mission, MissionStatus, WeatherCondition, Waypoint } from "@prisma/client";
import type { EnvConfig } from "../../config/env.validation";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { DRONE_ADAPTER, type DroneAdapter } from "../drones/adapters/drone-adapter.interface";
import { DronesService } from "../drones/drones.service";
import { DeliveryService } from "../delivery/delivery.service";
import { TelemetryService } from "../telemetry/telemetry.service";
import { GeofencingService, type GeofenceView } from "../geofencing/geofencing.service";
import type { LatLng } from "../geofencing/geometry.util";
import { WeatherService } from "../weather/weather.service";
import type { WeatherSafetyResult } from "../weather/weather-safety.util";
import { AiService } from "../ai/ai.service";
import type { AiDecisionLogView } from "../ai/ai-decision-log.service";
import { DEFAULT_DRONE_MAX_RANGE_KM, DEFAULT_DRONE_MAX_SPEED_MPS, DEFAULT_PAYLOAD_KG } from "../ai/ai.constants";
import type { DroneRankingResult } from "../ai/drone-selection.util";
import { haversineMeters } from "../ai/route-geo.util";
import type { AssignDroneDto } from "./dto/assign-drone.dto";
import type { CreateMissionDto } from "./dto/create-mission.dto";
import type { ListMissionsQueryDto } from "./dto/list-missions-query.dto";
import type { MissionOverrideDto } from "./dto/mission-override.dto";
import { ABORTABLE_STATUSES, DRONE_ASSIGNABLE_STATUSES, PROGRESSABLE_STATUSES, RTH_TRIGGERABLE_STATUSES, STARTABLE_STATUSES } from "./mission-state-machine";
import { resolveDeterministicDestination } from "./route.util";

/** Mission-event `type` strings safety-related handlers write — filtered on by `listSafetyEvents()`'s fleet-wide incident feed. */
const SAFETY_EVENT_TYPES = [
  "weather_unsafe",
  "weather_caution",
  "weather_cleared",
  "geofence_violation",
  "safety_cleared",
  "rth_triggered",
  "signal_loss",
  "aborted",
  "operator_override",
];

export interface WaypointView {
  id: string;
  sequence: number;
  lat: number;
  lng: number;
  altitudeMeters: number;
  status: Waypoint["status"];
  reachedAt: string | null;
}

export interface MissionEventView {
  id: string;
  type: string;
  fromStatus: MissionStatus | null;
  toStatus: MissionStatus | null;
  note: string | null;
  createdAt: string;
}

export interface MissionDetailView {
  id: string;
  deliveryId: string;
  droneId: string | null;
  droneName: string | null;
  operatorId: string | null;
  type: Mission["type"];
  status: MissionStatus;
  safetyState: Mission["safetyState"];
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  rthTriggered: boolean;
  abortReason: string | null;
  riskScore: number | null;
  riskLevel: Mission["riskLevel"];
  requiresApproval: boolean;
  approvedById: string | null;
  approvedAt: string | null;
  plannedAt: string;
  startedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  abortedAt: string | null;
  waypoints: WaypointView[];
  events: MissionEventView[];
}

const missionInclude = {
  drone: { select: { id: true, name: true } },
  waypoints: { orderBy: { sequence: "asc" as const } },
  events: { orderBy: { createdAt: "asc" as const } },
};

type MissionWithRelations = Mission & {
  drone: { id: string; name: string } | null;
  waypoints: Waypoint[];
  events: Array<{ id: string; type: string; fromStatus: MissionStatus | null; toStatus: MissionStatus | null; note: string | null; createdAt: Date }>;
};

@Injectable()
export class MissionsService implements OnModuleInit, OnModuleDestroy {
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
    private readonly deliveryService: DeliveryService,
    private readonly dronesService: DronesService,
    private readonly telemetryService: TelemetryService,
    private readonly geofencingService: GeofencingService,
    private readonly weatherService: WeatherService,
    private readonly aiService: AiService,
    @Inject(DRONE_ADAPTER) private readonly droneAdapter: DroneAdapter,
  ) {}

  onModuleInit(): void {
    const autoplay = this.configService.get("DRONE_SIMULATION_AUTOPLAY", { infer: true });
    if (!autoplay || process.env.NODE_ENV === "test") {
      return;
    }
    const tickMs = this.configService.get("DRONE_SIMULATION_TICK_MS", { infer: true });
    this.tickInterval = setInterval(() => {
      this.tickAllActiveMissions().catch(() => undefined);
    }, tickMs);
  }

  onModuleDestroy(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
  }

  async createForDelivery(dto: CreateMissionDto, actor: AuthenticatedUser): Promise<MissionDetailView> {
    const snapshot = await this.deliveryService.getDeliverySnapshotForMission(dto.deliveryId);
    if (snapshot.status !== "HUB_ASSIGNED") {
      throw new ConflictException(`Delivery must have a hub assigned (currently ${snapshot.status}) before a mission can be created`);
    }
    if (!snapshot.hubId) {
      throw new BadRequestException("Delivery has no assigned hub");
    }

    const origin = await this.dronesService.getHubCoordinates(snapshot.hubId);
    if (!origin) {
      throw new BadRequestException("Assigned hub has no known location");
    }
    const destination = resolveDeterministicDestination(dto.deliveryId, origin);

    // Weather is fetched once and reused for route optimization, the
    // post-creation weather gate, and the ETA prediction below — never
    // re-fetched per step (Phase 8's "do not duplicate weather fetching").
    const zoneKey = this.weatherService.zoneKeyFor(origin.lat, origin.lng);
    const weather = await this.weatherService.getCurrentWeather(origin.lat, origin.lng, zoneKey);
    const weatherSafety = this.weatherService.evaluateSafety(weather);

    // AI/Optimization step — Delivery -> Route/ETA request -> AI/Optimization
    // -> Candidate solution (phase-09 architecture). No drone is assigned
    // yet, so battery is informational only here (see
    // `RouteOptimizerInput.droneBatteryPercent`'s doc comment) — geofence
    // is still the one hard filter at this stage.
    const routeResult = await this.aiService.optimizeRoute(
      {
        origin,
        destination,
        droneMaxSpeedMps: DEFAULT_DRONE_MAX_SPEED_MPS,
        droneMaxRangeKm: DEFAULT_DRONE_MAX_RANGE_KM,
        weather: { windSpeedMps: weather.windSpeedMps, condition: weather.condition, safetyLevel: weatherSafety.level },
      },
      { deliveryId: dto.deliveryId },
    );

    if (!routeResult.selected) {
      // No candidate cleared the authoritative geofence check — block
      // outright, the same "no wait-and-retry for a no-fly zone" semantics
      // Phase 8 already established, now reached only after the optimizer
      // has genuinely tried alternatives first.
      const blockedZones = [...new Set(routeResult.alternatives.flatMap((c) => c.geofenceViolationZoneNames))];
      await this.auditService.log({
        actorId: actor.sub,
        action: "geofence.violation",
        targetType: "Delivery",
        targetId: dto.deliveryId,
        metadata: { zoneNames: blockedZones, alternativesConsidered: routeResult.alternatives.length },
      });
      this.eventEmitter.emit("geofence.violation", { deliveryId: dto.deliveryId, zoneNames: blockedZones });
      this.eventEmitter.emit("route.rejected", { deliveryId: dto.deliveryId, reasons: routeResult.reasons });
      throw new ConflictException(routeResult.reasons[0] ?? "No feasible route avoids the configured restricted/no-fly zones");
    }

    const selectedRoute = routeResult.selected;
    const routePoints: LatLng[] = [origin, ...selectedRoute.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })), destination];

    // Safety validation step — the authoritative gate, independent of
    // whatever the optimizer already checked internally (defense in depth,
    // per the explicit "Candidate solution -> Safety validation -> Approved
    // result" pipeline). Same `GeofencingService.findRouteViolations()`
    // call Phase 8 always used — never a second/parallel check.
    const finalViolations = await this.geofencingService.findRouteViolations(routePoints);
    if (finalViolations.length > 0) {
      this.eventEmitter.emit("geofence.violation", { deliveryId: dto.deliveryId, zoneNames: finalViolations.map((z) => z.name) });
      throw new ConflictException(`Planned route crosses a restricted/no-fly zone: ${finalViolations.map((z) => z.name).join(", ")}`);
    }

    // Service area — the destination must fall inside a configured zone,
    // if any are configured at all (permissive-when-unconfigured default,
    // see `GeofencingService.checkServiceArea`). Unchanged from Phase 8.
    const serviceAreaCheck = await this.geofencingService.checkServiceArea(destination);
    if (!serviceAreaCheck.inServiceArea) {
      throw new BadRequestException("Delivery destination falls outside every configured service area");
    }

    let mission: Mission;
    try {
      mission = await this.prisma.mission.create({
        data: {
          deliveryId: dto.deliveryId,
          originLat: origin.lat,
          originLng: origin.lng,
          destinationLat: destination.lat,
          destinationLng: destination.lng,
          waypoints: { create: selectedRoute.waypoints.map((point, index) => ({ sequence: index + 1, lat: point.lat, lng: point.lng, altitudeMeters: point.altitudeMeters })) },
          events: { create: { type: "created", toStatus: "PLANNED", actorId: actor.sub } },
        },
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
        throw new ConflictException("A mission already exists for this delivery");
      }
      throw error;
    }

    await this.auditService.log({
      actorId: actor.sub,
      action: "mission.created",
      targetType: "Mission",
      targetId: mission.id,
      metadata: { deliveryId: dto.deliveryId, route: selectedRoute.id, distanceMeters: Math.round(selectedRoute.distanceMeters) },
    });
    this.eventEmitter.emit("mission.created", { missionId: mission.id, deliveryId: dto.deliveryId });
    this.eventEmitter.emit("route.optimized", {
      missionId: mission.id,
      deliveryId: dto.deliveryId,
      routeId: selectedRoute.id,
      distanceMeters: Math.round(selectedRoute.distanceMeters),
      alternativesConsidered: routeResult.alternatives.length,
    });

    // Safety gate — weather go/no-go at the origin, reusing the weather
    // already fetched above rather than re-fetching. Unchanged Phase 8
    // semantics: unsafe weather holds the mission, it does not block
    // creation.
    await this.applyWeatherGateAtCreation(mission.id, dto.deliveryId, weatherSafety);

    // ETA prediction — replaces Phase 7's naive distance calculation.
    const etaPrediction = await this.aiService.predictEta(
      { distanceMeters: selectedRoute.distanceMeters, droneMaxSpeedMps: DEFAULT_DRONE_MAX_SPEED_MPS, windSpeedMps: weather.windSpeedMps, weatherCondition: weather.condition, weatherSafetyLevel: weatherSafety.level },
      { deliveryId: dto.deliveryId, missionId: mission.id },
    );
    await this.deliveryService.refineEstimatedDelivery(dto.deliveryId, etaPrediction.etaAt);
    this.eventEmitter.emit("eta.predicted", {
      missionId: mission.id,
      deliveryId: dto.deliveryId,
      etaAt: etaPrediction.etaAt.toISOString(),
      confidence: etaPrediction.confidence,
      factors: etaPrediction.factors,
    });

    // Drone recommendation — informational only, computed once
    // automatically so operators see it immediately; never auto-assigns
    // (`assignDrone()` below remains the only way a drone actually gets
    // attached to a mission, a deliberate human action).
    const recommendations = await this.aiService.recommendDrones(
      { origin, distanceMeters: selectedRoute.distanceMeters, payloadKg: DEFAULT_PAYLOAD_KG, hubId: snapshot.hubId },
      { deliveryId: dto.deliveryId, missionId: mission.id },
    );
    const topRecommendation = recommendations.find((r) => r.eligible);
    if (topRecommendation) {
      this.eventEmitter.emit("drone.recommended", {
        missionId: mission.id,
        deliveryId: dto.deliveryId,
        droneId: topRecommendation.droneId,
        droneName: topRecommendation.droneName,
        score: topRecommendation.score,
      });
    }

    return this.getById(mission.id);
  }

  async listAll(query: ListMissionsQueryDto): Promise<{ missions: MissionDetailView[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.safetyState ? { safetyState: query.safetyState } : {}),
      ...(query.droneId ? { droneId: query.droneId } : {}),
    };

    const [missions, total] = await this.prisma.$transaction([
      this.prisma.mission.findMany({ where, include: missionInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.mission.count({ where }),
    ]);

    return { missions: missions.map((m) => this.toDetailView(m)), total, page, pageSize };
  }

  async getById(missionId: string): Promise<MissionDetailView> {
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId }, include: missionInclude });
    if (!mission) {
      throw new NotFoundException("Mission not found");
    }
    return this.toDetailView(mission);
  }

  async getByDeliveryId(deliveryId: string): Promise<MissionDetailView> {
    const mission = await this.prisma.mission.findUnique({ where: { deliveryId }, include: missionInclude });
    if (!mission) {
      throw new NotFoundException("Mission not found");
    }
    return this.toDetailView(mission);
  }

  /**
   * Cross-module read for `RealtimeBroadcasterService` (Phase 7) — the raw
   * `drone.location_updated`/`drone.battery_updated`/`drone.status_changed`
   * domain events only carry a `droneId`, not a `deliveryId`, so the
   * realtime layer needs this lookup to know which customer's `delivery:<id>`
   * WebSocket room a given drone's telemetry belongs to right now. Scoped to
   * the mission statuses where a drone is actually flying a delivery (a
   * drone that's `IDLE`/between missions has no active delivery to route
   * telemetry to). Same cross-module-read-through-the-owning-service
   * convention as `getDeliverySnapshotForMission`/`getHubCoordinates`.
   */
  async findActiveMissionByDroneId(droneId: string): Promise<{ missionId: string; deliveryId: string } | null> {
    const mission = await this.prisma.mission.findFirst({
      where: { droneId, status: { in: ["DISPATCHED", "IN_PROGRESS", "RETURNING"] } },
      select: { id: true, deliveryId: true },
    });
    return mission ? { missionId: mission.id, deliveryId: mission.deliveryId } : null;
  }

  /** Read-only current safety snapshot (weather + geofence-route status) for the admin mission-detail view — never mutates `safetyState`; use `recheckSafety` for that. */
  async getSafetySnapshot(
    missionId: string,
  ): Promise<{ safetyState: Mission["safetyState"]; weather: Awaited<ReturnType<WeatherService["getCurrentWeather"]>>; weatherSafety: WeatherSafetyResult; geofenceViolations: Array<Pick<GeofenceView, "id" | "name" | "type">> }> {
    const mission = await this.getMissionWithWaypointsOrThrow(missionId);
    const routePoints: LatLng[] = [
      { lat: mission.originLat, lng: mission.originLng },
      ...mission.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
      { lat: mission.destinationLat, lng: mission.destinationLng },
    ];
    const weather = await this.weatherService.getCurrentWeather(mission.originLat, mission.originLng, this.weatherService.zoneKeyFor(mission.originLat, mission.originLng));
    const weatherSafety = this.weatherService.evaluateSafety(weather);
    const geofenceViolations = await this.geofencingService.findRouteViolations(routePoints);
    return {
      safetyState: mission.safetyState,
      weather,
      weatherSafety,
      geofenceViolations: geofenceViolations.map((z) => ({ id: z.id, name: z.name, type: z.type })),
    };
  }

  /**
   * The explainability surface (phase-09) — every route/ETA/risk/drone-recommendation/reroute
   * decision logged for this mission, most recent first. Merges decisions
   * logged against the mission id with decisions logged against its
   * delivery id: the very first route-optimization decision at mission
   * creation (`createForDelivery()`) is necessarily logged before the
   * mission row exists, so it only ever carries a `deliveryId` — without
   * this merge, "why was this route chosen" would never appear here.
   */
  async getAiDecisions(missionId: string, limit?: number): Promise<AiDecisionLogView[]> {
    const mission = await this.getOrThrow(missionId);
    const effectiveLimit = limit ?? 50;
    const [byMission, byDelivery] = await Promise.all([
      this.aiService.getDecisionLogForMission(missionId, effectiveLimit),
      this.aiService.getDecisionLogForDelivery(mission.deliveryId, effectiveLimit),
    ]);
    const merged = new Map<string, AiDecisionLogView>();
    for (const entry of [...byMission, ...byDelivery]) {
      merged.set(entry.id, entry);
    }
    return [...merged.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, effectiveLimit);
  }

  /** Read-only, on-demand drone-ranking refresh (e.g. an admin reloading the mission page) — deliberately not logged/re-emitted on every call, unlike the automatic one at mission creation (see `createForDelivery`). */
  async getDroneRecommendations(missionId: string): Promise<DroneRankingResult[]> {
    const mission = await this.getOrThrow(missionId);
    const snapshot = await this.deliveryService.getDeliverySnapshotForMission(mission.deliveryId);
    const distanceMeters = haversineMeters({ lat: mission.originLat, lng: mission.originLng }, { lat: mission.destinationLat, lng: mission.destinationLng });
    return this.aiService.peekDroneRecommendations({
      origin: { lat: mission.originLat, lng: mission.originLng },
      distanceMeters,
      payloadKg: DEFAULT_PAYLOAD_KG,
      hubId: snapshot.hubId ?? undefined,
    });
  }

  /**
   * Explicitly re-evaluates weather/geofence safety for a `PLANNED`/
   * `DISPATCHED` mission and updates `safetyState` accordingly — lets an
   * operator clear (or reaffirm) a hold without needing to attempt
   * `start()` again. `start()` performs this exact same evaluation itself
   * on every call, so this endpoint is a convenience, never the only gate.
   */
  async recheckSafety(missionId: string, actor: AuthenticatedUser): Promise<MissionDetailView> {
    const mission = await this.getMissionWithWaypointsOrThrow(missionId);
    if (mission.status !== "PLANNED" && mission.status !== "DISPATCHED") {
      throw new ConflictException(`Safety can only be rechecked while a mission is planned or dispatched (currently ${mission.status})`);
    }
    const routePoints: LatLng[] = [
      { lat: mission.originLat, lng: mission.originLng },
      ...mission.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
      { lat: mission.destinationLat, lng: mission.destinationLng },
    ];

    const routeViolations = await this.geofencingService.findRouteViolations(routePoints);
    if (routeViolations.length > 0) {
      await this.blockOnGeofenceViolation(missionId, mission.deliveryId, routeViolations, actor.sub);
      return this.getById(missionId);
    }

    // forceRefresh: true — an explicit "is it safe right now" request must
    // never read back a stale cached unsafe reading (see WeatherService's
    // doc comment on getCurrentWeather).
    const weather = await this.weatherService.getCurrentWeather(
      mission.originLat,
      mission.originLng,
      this.weatherService.zoneKeyFor(mission.originLat, mission.originLng),
      { forceRefresh: true },
    );
    const weatherSafety = this.weatherService.evaluateSafety(weather);
    if (weatherSafety.level === "UNSAFE") {
      await this.blockOnUnsafeWeather(missionId, mission.deliveryId, weatherSafety, actor.sub);
      return this.getById(missionId);
    }

    if (mission.safetyState === "WEATHER_HOLD" || mission.safetyState === "GEOFENCE_BREACH") {
      await this.clearSafetyHold(missionId, mission.deliveryId, actor.sub);
    }
    return this.getById(missionId);
  }

  /** Fleet-wide safety/incident feed for the admin "safety incidents" view — filters the existing append-only `MissionEvent` log rather than a new table (see `docs/ARCHITECTURE.md`'s Phase 8 section for why). */
  async listSafetyEvents(limit = 50): Promise<Array<MissionEventView & { missionId: string; deliveryId: string; droneName: string | null }>> {
    const events = await this.prisma.missionEvent.findMany({
      where: { type: { in: SAFETY_EVENT_TYPES } },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
      include: { mission: { select: { id: true, deliveryId: true, drone: { select: { name: true } } } } },
    });
    return events.map((e) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
      missionId: e.mission.id,
      deliveryId: e.mission.deliveryId,
      droneName: e.mission.drone?.name ?? null,
    }));
  }

  async assignDrone(missionId: string, dto: AssignDroneDto, actor: AuthenticatedUser): Promise<MissionDetailView> {
    const mission = await this.getOrThrow(missionId);
    if (!DRONE_ASSIGNABLE_STATUSES.includes(mission.status)) {
      throw new ConflictException(`Drone cannot be assigned while mission status is ${mission.status}`);
    }

    const precheckDrone = await this.dronesService.getById(dto.droneId);
    if (precheckDrone.isMaintenanceMode || precheckDrone.status !== "IDLE") {
      throw new BadRequestException(`Drone ${precheckDrone.name} is not available (status ${precheckDrone.status})`);
    }

    // Phase 12 fix: the check above is a friendly precondition check for the
    // common case; this atomic compare-and-swap is what actually prevents
    // two concurrent assignments from both claiming the same drone (a plain
    // `getById()` read followed by a later, separate `setStatus()` write
    // left a window where a second concurrent request's own `getById()`
    // could still observe IDLE) — see `DronesService.assignIfAvailable()`.
    const drone = await this.dronesService.assignIfAvailable(dto.droneId, `Assigned to mission ${missionId}`);

    await this.prisma.mission.update({
      where: { id: missionId },
      data: { droneId: dto.droneId, operatorId: dto.operatorId },
    });
    await this.recordEvent(missionId, "drone_assigned", null, null, actor.sub, `Assigned drone ${drone.name}`);
    await this.auditService.log({
      actorId: actor.sub,
      action: "mission.drone_assigned",
      targetType: "Mission",
      targetId: missionId,
      metadata: { droneId: dto.droneId, operatorId: dto.operatorId },
    });

    // Risk assessment — now that a real drone (battery, health) is known,
    // this is the natural point to compute the "borderline-risk missions
    // require explicit approval before dispatch" gate (phase-09), well
    // before `start()` would otherwise be attempted.
    await this.assessAndRecordRisk(mission, drone.id, drone.batteryHealthPercent, drone.maxRangeKm);

    return this.getById(missionId);
  }

  async unassignDrone(missionId: string, actor: AuthenticatedUser): Promise<MissionDetailView> {
    const mission = await this.getOrThrow(missionId);
    if (!DRONE_ASSIGNABLE_STATUSES.includes(mission.status)) {
      throw new ConflictException(`Drone cannot be unassigned while mission status is ${mission.status}`);
    }
    if (mission.droneId) {
      await this.dronesService.setStatus(mission.droneId, "IDLE", "Unassigned from mission");
    }
    await this.prisma.mission.update({ where: { id: missionId }, data: { droneId: null, operatorId: null } });
    await this.recordEvent(missionId, "drone_unassigned", null, null, actor.sub);
    await this.auditService.log({ actorId: actor.sub, action: "mission.drone_unassigned", targetType: "Mission", targetId: missionId });

    return this.getById(missionId);
  }

  async start(missionId: string, actor: AuthenticatedUser): Promise<MissionDetailView> {
    const mission = await this.getMissionWithWaypointsOrThrow(missionId);
    if (!STARTABLE_STATUSES.includes(mission.status)) {
      throw new ConflictException(`Mission cannot be started from status ${mission.status}`);
    }
    if (!mission.droneId) {
      throw new ConflictException("Mission has no drone assigned");
    }
    const firstWaypoint = mission.waypoints[0];
    if (!firstWaypoint) {
      throw new ConflictException("Mission has no route planned");
    }

    // Risk-approval gate (Phase 9) — a HIGH-risk mission cannot dispatch
    // without an explicit human sign-off first, however this endpoint is
    // called. `POST /missions/:id/approve` is the only way to clear it.
    if (mission.requiresApproval && !mission.approvedAt) {
      throw new ConflictException(
        `Cannot dispatch — this mission is ${mission.riskLevel ?? "elevated"}-risk (${mission.riskScore ?? "?"}/100) and requires operator approval first`,
      );
    }

    // Safety gate, re-evaluated fresh on every start attempt — this runs
    // inside the same server-side handler every caller of `POST
    // /missions/:id/start` goes through, so unsafe conditions can never be
    // bypassed by calling the endpoint directly (Phase 8 security
    // requirement). Geofence is rechecked too, in case a zone was added
    // after the mission was planned.
    const routePoints: LatLng[] = [
      { lat: mission.originLat, lng: mission.originLng },
      ...mission.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
      { lat: mission.destinationLat, lng: mission.destinationLng },
    ];
    const routeViolations = await this.geofencingService.findRouteViolations(routePoints);
    if (routeViolations.length > 0) {
      await this.blockOnGeofenceViolation(missionId, mission.deliveryId, routeViolations, actor.sub);
      throw new ConflictException(`Cannot dispatch — route crosses a restricted/no-fly zone: ${routeViolations.map((z) => z.name).join(", ")}`);
    }

    const weather = await this.weatherService.getCurrentWeather(mission.originLat, mission.originLng, this.weatherService.zoneKeyFor(mission.originLat, mission.originLng));
    const weatherSafety = this.weatherService.evaluateSafety(weather);
    if (weatherSafety.level === "UNSAFE") {
      await this.blockOnUnsafeWeather(missionId, mission.deliveryId, weatherSafety, actor.sub);
      throw new ConflictException(`Cannot dispatch — unsafe weather: ${weatherSafety.reasons.join("; ")}`);
    }
    if (mission.safetyState === "WEATHER_HOLD" || mission.safetyState === "GEOFENCE_BREACH") {
      // Conditions cleared since planning (or a prior blocked attempt).
      await this.clearSafetyHold(missionId, mission.deliveryId, actor.sub);
    }

    const drone = await this.prisma.drone.findUniqueOrThrow({ where: { id: mission.droneId } });
    this.dronesService.ensureSimulatedAdapterRegistered(drone);

    await this.droneAdapter.connect(mission.droneId);
    await this.droneAdapter.arm(mission.droneId);
    await this.droneAdapter.takeoff(mission.droneId, firstWaypoint.altitudeMeters);
    await this.droneAdapter.gotoWaypoint(mission.droneId, {
      lat: firstWaypoint.lat,
      lng: firstWaypoint.lng,
      altitudeMeters: firstWaypoint.altitudeMeters,
    });

    await this.prisma.mission.update({ where: { id: missionId }, data: { status: "DISPATCHED", startedAt: new Date() } });
    await this.dronesService.setStatus(mission.droneId, "IN_FLIGHT", "Mission dispatched");
    await this.recordEvent(missionId, "dispatched", mission.status, "DISPATCHED", actor.sub);
    await this.auditService.log({ actorId: actor.sub, action: "mission.started", targetType: "Mission", targetId: missionId });
    this.eventEmitter.emit("mission.started", { missionId, deliveryId: mission.deliveryId });

    return this.getById(missionId);
  }

  /** One deterministic simulation step — invoked by an admin's "Simulate next step" action or the background autoplay interval. See `SimulatedDroneAdapter`'s class doc for why one call = one step. */
  async progress(missionId: string, actor?: AuthenticatedUser): Promise<MissionDetailView> {
    const mission = await this.getMissionWithWaypointsOrThrow(missionId);
    if (!PROGRESSABLE_STATUSES.includes(mission.status)) {
      throw new ConflictException(`Mission cannot be progressed from status ${mission.status}`);
    }
    if (!mission.droneId) {
      throw new ConflictException("Mission has no drone assigned");
    }

    const telemetry = await this.droneAdapter.getTelemetry(mission.droneId);
    await this.telemetryService.ingest({
      droneId: mission.droneId,
      missionId,
      lat: telemetry.lat,
      lng: telemetry.lng,
      altitudeMeters: telemetry.altitudeMeters,
      speedMps: telemetry.speedMps,
      headingDegrees: telemetry.headingDegrees,
      batteryPercent: telemetry.batteryPercent,
      signalStrengthPercent: telemetry.signalStrengthPercent,
    });

    const triggeredBy = actor?.sub ?? null;

    if (mission.status === "DISPATCHED") {
      await this.prisma.mission.update({ where: { id: missionId }, data: { status: "IN_PROGRESS" } });
      await this.recordEvent(missionId, "in_progress", "DISPATCHED", "IN_PROGRESS", triggeredBy, "Drone en route");
      // Cross-module side effect via the event bus only (PROJECT_CONTEXT.md
      // #1) — DeliveryMissionEventsListener reacts to mission.progressed and
      // calls DeliveryService.markInTransit() itself; MissionsService never
      // calls DeliveryService's write methods directly.
      this.eventEmitter.emit("mission.progressed", { missionId, deliveryId: mission.deliveryId });
    }

    if (telemetry.emergency) {
      return this.applyAbort(missionId, mission.deliveryId, mission.droneId, "Simulated emergency (crash)", null);
    }

    const lowBatteryThreshold = this.configService.get("DRONE_LOW_BATTERY_THRESHOLD_PERCENT", { infer: true });
    if (
      mission.status !== "RETURNING" &&
      !mission.rthTriggered &&
      telemetry.batteryPercent <= lowBatteryThreshold &&
      RTH_TRIGGERABLE_STATUSES.includes(mission.status)
    ) {
      return this.triggerReturnToHome(missionId, mission.deliveryId, mission.droneId, `Low battery (${telemetry.batteryPercent}%)`, null);
    }

    // In-flight safety re-checks (Phase 8) — Phase 9 adds one step before
    // the existing RTH fallback: try a safe reroute to the *original*
    // destination first (smart rerouting), and only fall back to RTH
    // (unchanged Phase 8 mechanism) if no safe alternative exists. Hard
    // safety semantics are never weakened — a reroute is only ever applied
    // if it independently passes the same authoritative geofence/weather/
    // battery checks a fresh mission would.
    if (mission.status !== "RETURNING" && RTH_TRIGGERABLE_STATUSES.includes(mission.status)) {
      const currentPosition: LatLng = { lat: telemetry.lat, lng: telemetry.lng };
      const pointViolations = await this.geofencingService.findPointViolations(currentPosition);
      const zoneKey = this.weatherService.zoneKeyFor(telemetry.lat, telemetry.lng);
      const weather = await this.weatherService.getCurrentWeather(telemetry.lat, telemetry.lng, zoneKey);
      const inFlightSafety = this.weatherService.evaluateSafety(weather);

      const geofenceBreach = pointViolations.length > 0;
      const weatherUnsafe = inFlightSafety.level === "UNSAFE";

      if (geofenceBreach || weatherUnsafe) {
        const reason = geofenceBreach
          ? `Geofence breach: entered ${pointViolations.map((z) => z.name).join(", ")}`
          : `Weather escalation: ${inFlightSafety.reasons[0] ?? "unsafe conditions"}`;

        if (geofenceBreach) {
          this.eventEmitter.emit("geofence.violation", { missionId, deliveryId: mission.deliveryId, zoneNames: pointViolations.map((z) => z.name) });
        } else {
          this.eventEmitter.emit("weather.unsafe", { missionId, deliveryId: mission.deliveryId, reasons: inFlightSafety.reasons });
        }

        const rerouted = geofenceBreach
          ? await this.attemptInFlightReroute(mission, missionId, currentPosition, telemetry.batteryPercent, weather, inFlightSafety, reason)
          : null; // weather escalation has no route-shaped fix — always falls back to RTH, matching Phase 8.
        if (rerouted) {
          return rerouted;
        }
        return this.triggerReturnToHome(missionId, mission.deliveryId, mission.droneId, reason, null);
      }
    }

    if (telemetry.signalStrengthPercent === 0 && mission.safetyState !== "SIGNAL_LOSS") {
      await this.prisma.mission.update({ where: { id: missionId }, data: { safetyState: "SIGNAL_LOSS" } });
      await this.recordEvent(missionId, "signal_loss", null, null, null, "Signal lost");
    } else if (telemetry.signalStrengthPercent > 0 && mission.safetyState === "SIGNAL_LOSS") {
      await this.prisma.mission.update({ where: { id: missionId }, data: { safetyState: "NOMINAL" } });
      await this.recordEvent(missionId, "signal_recovered", null, null, null, "Signal recovered");
    }

    if (mission.status === "RETURNING") {
      // RTH targets the hub (mission.origin), not the forward-route waypoint
      // chain — arrival is judged against the origin coordinate directly.
      const distanceHome = Math.hypot(mission.originLat - telemetry.lat, mission.originLng - telemetry.lng);
      if (distanceHome < 0.001) {
        return this.completeReturnToHome(missionId, mission.deliveryId, mission.droneId, mission.abortReason ?? "Returned to hub");
      }
      return this.getById(missionId);
    }

    const currentWaypoint = mission.waypoints.find((w) => w.status === "PENDING");
    if (currentWaypoint) {
      const distance = Math.hypot(currentWaypoint.lat - telemetry.lat, currentWaypoint.lng - telemetry.lng);
      if (distance < 0.001) {
        await this.prisma.waypoint.update({ where: { id: currentWaypoint.id }, data: { status: "REACHED", reachedAt: new Date() } });
        const next = mission.waypoints.find((w) => w.sequence === currentWaypoint.sequence + 1 && w.status === "PENDING");

        if (next) {
          await this.droneAdapter.gotoWaypoint(mission.droneId, { lat: next.lat, lng: next.lng, altitudeMeters: next.altitudeMeters });
        } else {
          return this.completeMission(missionId, mission.deliveryId, mission.droneId);
        }
      }
    }

    return this.getById(missionId);
  }

  /** Operator override — pre-empts the automated plan. Requires `missions.override` and a mandatory reason; every use is audited (blueprint Section I/S). */
  async override(missionId: string, dto: MissionOverrideDto, actor: AuthenticatedUser): Promise<MissionDetailView> {
    const mission = await this.getOrThrow(missionId);
    if (!mission.droneId) {
      throw new ConflictException("Mission has no drone assigned");
    }

    // Validate before writing any audit/event trail — a rejected override
    // attempt must never leave behind a MissionEvent implying it happened.
    if (dto.action === "RETURN_TO_HOME") {
      if (!RTH_TRIGGERABLE_STATUSES.includes(mission.status)) {
        throw new ConflictException(`Mission cannot return to home from status ${mission.status}`);
      }
    } else if (!ABORTABLE_STATUSES.includes(mission.status)) {
      throw new ConflictException(`Mission cannot be ${dto.action === "ABORT" ? "aborted" : "landed"} from status ${mission.status}`);
    }

    await this.auditService.log({
      actorId: actor.sub,
      action: "mission.operator_override",
      targetType: "Mission",
      targetId: missionId,
      metadata: { action: dto.action, reason: dto.reason },
    });
    await this.recordEvent(missionId, "operator_override", null, null, actor.sub, `${dto.action}: ${dto.reason}`);

    if (dto.action === "RETURN_TO_HOME") {
      return this.triggerReturnToHome(missionId, mission.deliveryId, mission.droneId, dto.reason, actor.sub);
    }

    if (dto.action === "ABORT") {
      await this.droneAdapter.emergencyStop(mission.droneId);
      return this.applyAbort(missionId, mission.deliveryId, mission.droneId, dto.reason, actor.sub);
    }

    // LAND — force-land in place, ending the mission without completing delivery.
    await this.droneAdapter.land(mission.droneId);
    return this.applyAbort(missionId, mission.deliveryId, mission.droneId, dto.reason, actor.sub);
  }

  /** Called once, right after a mission is created, with the weather already fetched by the caller (never a second fetch) — sets `WEATHER_HOLD` and emits the safety-blocked events if conditions are unsafe at the origin; a no-op (CAUTION just gets an advisory log) otherwise. Never blocks creation itself. */
  private async applyWeatherGateAtCreation(missionId: string, deliveryId: string, weatherSafety: WeatherSafetyResult): Promise<void> {
    if (weatherSafety.level === "UNSAFE") {
      await this.blockOnUnsafeWeather(missionId, deliveryId, weatherSafety, null);
    } else if (weatherSafety.level === "CAUTION") {
      await this.recordEvent(missionId, "weather_caution", null, null, null, weatherSafety.reasons.join("; "));
      this.eventEmitter.emit("weather.warning", { missionId, deliveryId, reasons: weatherSafety.reasons });
    }
  }

  private async blockOnUnsafeWeather(missionId: string, deliveryId: string, weatherSafety: WeatherSafetyResult, actorId: string | null): Promise<void> {
    const mission = await this.prisma.mission.findUniqueOrThrow({ where: { id: missionId } });
    await this.recordEvent(missionId, "weather_unsafe", null, null, actorId, weatherSafety.reasons.join("; "));
    await this.auditService.log({
      actorId: actorId ?? undefined,
      action: "weather.unsafe",
      targetType: "Mission",
      targetId: missionId,
      metadata: { reasons: weatherSafety.reasons },
    });
    this.eventEmitter.emit("weather.unsafe", { missionId, deliveryId, reasons: weatherSafety.reasons });
    if (mission.safetyState !== "WEATHER_HOLD") {
      await this.prisma.mission.update({ where: { id: missionId }, data: { safetyState: "WEATHER_HOLD" } });
      this.eventEmitter.emit("mission.safety_blocked", { missionId, deliveryId, category: "WEATHER", reason: weatherSafety.reasons[0] ?? "Unsafe weather" });
    }
  }

  private async blockOnGeofenceViolation(missionId: string, deliveryId: string, violations: GeofenceView[], actorId: string | null): Promise<void> {
    const mission = await this.prisma.mission.findUniqueOrThrow({ where: { id: missionId } });
    const names = violations.map((z) => z.name).join(", ");
    await this.recordEvent(missionId, "geofence_violation", null, null, actorId, `Route crosses: ${names}`);
    await this.auditService.log({
      actorId: actorId ?? undefined,
      action: "geofence.violation",
      targetType: "Mission",
      targetId: missionId,
      metadata: { zoneIds: violations.map((z) => z.id), zoneNames: violations.map((z) => z.name) },
    });
    this.eventEmitter.emit("geofence.violation", { missionId, deliveryId, zoneNames: violations.map((z) => z.name), zoneIds: violations.map((z) => z.id) });
    if (mission.safetyState !== "GEOFENCE_BREACH") {
      await this.prisma.mission.update({ where: { id: missionId }, data: { safetyState: "GEOFENCE_BREACH" } });
      this.eventEmitter.emit("mission.safety_blocked", { missionId, deliveryId, category: "GEOFENCE", reason: `Route crosses ${names}` });
    }
  }

  private async clearSafetyHold(missionId: string, deliveryId: string, actorId: string | null): Promise<void> {
    await this.prisma.mission.update({ where: { id: missionId }, data: { safetyState: "NOMINAL" } });
    await this.recordEvent(missionId, "safety_cleared", null, null, actorId, "Safety recheck passed — conditions are now within thresholds");
    this.eventEmitter.emit("mission.safety_cleared", { missionId, deliveryId });
  }

  /**
   * `DeliveryRiskAnalyzer` (blueprint Section T), run once a real drone is
   * known. `requiresApproval` is set exactly when the computed level is
   * `HIGH` — `start()` checks this flag on every call, so a borderline
   * mission can never be dispatched without an explicit
   * `POST /missions/:id/approve` first, however the endpoint is called.
   */
  private async assessAndRecordRisk(mission: Mission, droneId: string, droneBatteryHealthPercent: number, droneMaxRangeKm: number): Promise<void> {
    const snapshot = await this.deliveryService.getDeliverySnapshotForMission(mission.deliveryId);
    const distanceMeters = haversineMeters({ lat: mission.originLat, lng: mission.originLng }, { lat: mission.destinationLat, lng: mission.destinationLng });
    const zoneKey = this.weatherService.zoneKeyFor(mission.originLat, mission.originLng);
    const weather = await this.weatherService.getCurrentWeather(mission.originLat, mission.originLng, zoneKey);
    const weatherSafety = this.weatherService.evaluateSafety(weather);
    const drone = await this.dronesService.getById(droneId);
    const batteryFeasibility = this.aiService.evaluateBatteryFeasibility(drone.batteryPercent, distanceMeters);

    const risk = await this.aiService.assessRisk(
      {
        weatherSafetyLevel: weatherSafety.level,
        batteryFeasibilityLevel: batteryFeasibility.level,
        distanceMeters,
        droneMaxRangeKm,
        droneBatteryHealthPercent,
        priority: snapshot.priority,
      },
      { deliveryId: mission.deliveryId, missionId: mission.id },
    );

    const requiresApproval = risk.level === "HIGH";
    await this.prisma.mission.update({
      where: { id: mission.id },
      data: { riskScore: risk.score, riskLevel: risk.level, requiresApproval },
    });
    await this.recordEvent(mission.id, "risk_assessed", null, null, null, `${risk.level} risk (${risk.score}/100)`);
    this.eventEmitter.emit("delivery.risk_assessed", {
      missionId: mission.id,
      deliveryId: mission.deliveryId,
      score: risk.score,
      level: risk.level,
      requiresApproval,
      reasons: risk.reasons,
    });
  }

  /** `POST /missions/:id/approve` — the human sign-off `start()` requires before dispatching a `HIGH`-risk mission. Rejecting is the existing `override` ABORT action (Phase 6), not a separate endpoint. */
  async approve(missionId: string, actor: AuthenticatedUser): Promise<MissionDetailView> {
    const mission = await this.getOrThrow(missionId);
    if (!mission.requiresApproval) {
      throw new ConflictException("This mission does not require approval");
    }
    if (mission.approvedAt) {
      throw new ConflictException("This mission has already been approved");
    }
    await this.prisma.mission.update({ where: { id: missionId }, data: { approvedById: actor.sub, approvedAt: new Date() } });
    await this.recordEvent(missionId, "risk_approved", null, null, actor.sub, `Approved despite ${mission.riskLevel ?? "elevated"} risk (${mission.riskScore ?? "?"}/100)`);
    await this.auditService.log({
      actorId: actor.sub,
      action: "mission.risk_approved",
      targetType: "Mission",
      targetId: missionId,
      metadata: { riskScore: mission.riskScore, riskLevel: mission.riskLevel },
    });
    return this.getById(missionId);
  }

  /**
   * Smart rerouting (Phase 9) — called only for a geofence breach (weather
   * escalation has no route-shaped fix, see the caller). Asks
   * `RouteOptimizer` for a safe path from the drone's *current* position to
   * the mission's original destination, with the drone's real live battery
   * as an authoritative feasibility filter this time (unlike the
   * drone-agnostic estimate at mission creation). Returns `null` — never
   * throws — whenever no safe alternative exists, letting the caller fall
   * back to the existing RTH behavior unchanged.
   */
  private async attemptInFlightReroute(
    mission: Mission & { waypoints: Waypoint[] },
    missionId: string,
    currentPosition: LatLng,
    droneBatteryPercent: number,
    weather: { windSpeedMps: number; condition: WeatherCondition },
    weatherSafety: WeatherSafetyResult,
    triggerReason: string,
  ): Promise<MissionDetailView | null> {
    if (!mission.droneId || weatherSafety.level === "UNSAFE") {
      return null;
    }

    const result = await this.aiService.rerouteAround(
      {
        origin: currentPosition,
        destination: { lat: mission.destinationLat, lng: mission.destinationLng },
        droneMaxSpeedMps: DEFAULT_DRONE_MAX_SPEED_MPS,
        droneMaxRangeKm: DEFAULT_DRONE_MAX_RANGE_KM,
        droneBatteryPercent,
        weather: { windSpeedMps: weather.windSpeedMps, condition: weather.condition, safetyLevel: weatherSafety.level },
      },
      { deliveryId: mission.deliveryId, missionId },
    );
    if (!result.selected) {
      return null;
    }

    const maxSequence = mission.waypoints.reduce((max, w) => Math.max(max, w.sequence), 0);
    await this.prisma.waypoint.updateMany({ where: { missionId, status: "PENDING" }, data: { status: "SKIPPED" } });
    await this.prisma.waypoint.createMany({
      data: result.selected.waypoints.map((w, i) => ({ missionId, sequence: maxSequence + i + 1, lat: w.lat, lng: w.lng, altitudeMeters: w.altitudeMeters, status: "PENDING" })),
    });

    const firstNewWaypoint = result.selected.waypoints[0] ?? { lat: mission.destinationLat, lng: mission.destinationLng, altitudeMeters: 60 };
    await this.droneAdapter.gotoWaypoint(mission.droneId, firstNewWaypoint);

    await this.recordEvent(missionId, "rerouted", null, null, null, `${triggerReason} — rerouted via "${result.selected.id}"`);
    this.eventEmitter.emit("route.rerouted", {
      missionId,
      deliveryId: mission.deliveryId,
      routeId: result.selected.id,
      distanceMeters: Math.round(result.selected.distanceMeters),
      reason: triggerReason,
    });

    return this.getById(missionId);
  }

  private async triggerReturnToHome(
    missionId: string,
    deliveryId: string,
    droneId: string,
    reason: string,
    actorId: string | null,
  ): Promise<MissionDetailView> {
    await this.droneAdapter.returnToHome(droneId);
    await this.prisma.mission.update({
      where: { id: missionId },
      data: {
        status: "RETURNING",
        rthTriggered: true,
        abortReason: reason,
        safetyState: classifyRthSafetyState(reason),
      },
    });
    await this.dronesService.setStatus(droneId, "RETURNING", reason);
    await this.recordEvent(missionId, "rth_triggered", null, "RETURNING", actorId, reason);
    this.eventEmitter.emit("drone.return_to_home", { missionId, deliveryId, droneId, reason });

    return this.getById(missionId);
  }

  private async completeReturnToHome(missionId: string, deliveryId: string, droneId: string, reason: string): Promise<MissionDetailView> {
    return this.applyAbort(missionId, deliveryId, droneId, reason, null);
  }

  private async applyAbort(
    missionId: string,
    deliveryId: string,
    droneId: string,
    reason: string,
    actorId: string | null,
  ): Promise<MissionDetailView> {
    const mission = await this.prisma.mission.findUniqueOrThrow({ where: { id: missionId } });
    await this.prisma.mission.update({
      where: { id: missionId },
      data: { status: "ABORTED", abortedAt: new Date(), abortReason: reason, safetyState: reason.toLowerCase().includes("emergency") || reason.toLowerCase().includes("crash") ? "EMERGENCY" : mission.safetyState },
    });
    await this.dronesService.setStatus(droneId, "IDLE", `Mission aborted: ${reason}`);
    await this.recordEvent(missionId, "aborted", mission.status, "ABORTED", actorId, reason);
    await this.auditService.log({ actorId: actorId ?? undefined, action: "mission.aborted", targetType: "Mission", targetId: missionId, metadata: { reason } });
    // DeliveryMissionEventsListener reacts to mission.aborted and calls
    // DeliveryService.markReturnedToHubFromMission() itself — see the note
    // in progress() above.
    this.eventEmitter.emit("mission.aborted", { missionId, deliveryId, reason });

    return this.getById(missionId);
  }

  private async completeMission(missionId: string, deliveryId: string, droneId: string): Promise<MissionDetailView> {
    await this.droneAdapter.land(droneId);
    const now = new Date();
    await this.prisma.mission.update({
      where: { id: missionId },
      data: { status: "COMPLETED", arrivedAt: now, completedAt: now },
    });
    await this.dronesService.setStatus(droneId, "IDLE", "Mission completed");
    await this.prisma.drone.update({ where: { id: droneId }, data: { totalMissionsCompleted: { increment: 1 } } });
    await this.recordEvent(missionId, "completed", "IN_PROGRESS", "COMPLETED", null, "Arrived at destination");
    await this.auditService.log({ action: "mission.completed", targetType: "Mission", targetId: missionId });
    this.eventEmitter.emit("mission.completed", { missionId, deliveryId });

    return this.getById(missionId);
  }

  private async tickAllActiveMissions(): Promise<void> {
    const active = await this.prisma.mission.findMany({
      where: { status: { in: ["DISPATCHED", "IN_PROGRESS", "RETURNING"] } },
      select: { id: true },
    });
    for (const mission of active) {
      await this.progress(mission.id).catch(() => undefined);
    }
  }

  private async recordEvent(
    missionId: string,
    type: string,
    fromStatus: MissionStatus | null,
    toStatus: MissionStatus | null,
    actorId: string | null,
    note?: string,
  ): Promise<void> {
    await this.prisma.missionEvent.create({ data: { missionId, type, fromStatus, toStatus, actorId, note } });
  }

  private async getOrThrow(missionId: string): Promise<Mission> {
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId } });
    if (!mission) {
      throw new NotFoundException("Mission not found");
    }
    return mission;
  }

  private async getMissionWithWaypointsOrThrow(missionId: string): Promise<Mission & { waypoints: Waypoint[] }> {
    const mission = await this.prisma.mission.findUnique({ where: { id: missionId }, include: { waypoints: { orderBy: { sequence: "asc" } } } });
    if (!mission) {
      throw new NotFoundException("Mission not found");
    }
    return mission;
  }

  private toDetailView(mission: MissionWithRelations): MissionDetailView {
    return {
      id: mission.id,
      deliveryId: mission.deliveryId,
      droneId: mission.droneId,
      droneName: mission.drone?.name ?? null,
      operatorId: mission.operatorId,
      type: mission.type,
      status: mission.status,
      safetyState: mission.safetyState,
      originLat: mission.originLat,
      originLng: mission.originLng,
      destinationLat: mission.destinationLat,
      destinationLng: mission.destinationLng,
      rthTriggered: mission.rthTriggered,
      abortReason: mission.abortReason,
      riskScore: mission.riskScore,
      riskLevel: mission.riskLevel,
      requiresApproval: mission.requiresApproval,
      approvedById: mission.approvedById,
      approvedAt: mission.approvedAt ? mission.approvedAt.toISOString() : null,
      plannedAt: mission.plannedAt.toISOString(),
      startedAt: mission.startedAt ? mission.startedAt.toISOString() : null,
      arrivedAt: mission.arrivedAt ? mission.arrivedAt.toISOString() : null,
      completedAt: mission.completedAt ? mission.completedAt.toISOString() : null,
      abortedAt: mission.abortedAt ? mission.abortedAt.toISOString() : null,
      waypoints: mission.waypoints.map((w) => ({
        id: w.id,
        sequence: w.sequence,
        lat: w.lat,
        lng: w.lng,
        altitudeMeters: w.altitudeMeters,
        status: w.status,
        reachedAt: w.reachedAt ? w.reachedAt.toISOString() : null,
      })),
      events: mission.events.map((e) => ({
        id: e.id,
        type: e.type,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}

/** Classifies an RTH `reason` string into the `MissionSafetyState` it represents — extended in Phase 8 to also recognize geofence/weather-triggered RTH, alongside Phase 6's original battery classification. */
function classifyRthSafetyState(reason: string): "LOW_BATTERY" | "GEOFENCE_BREACH" | "WEATHER_HOLD" | "NOMINAL" {
  const lower = reason.toLowerCase();
  if (lower.includes("battery")) return "LOW_BATTERY";
  if (lower.includes("geofence")) return "GEOFENCE_BREACH";
  if (lower.includes("weather")) return "WEATHER_HOLD";
  return "NOMINAL";
}
