import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import type { EnvConfig } from "../../config/env.validation";
import { MissionsService } from "../missions/missions.service";
import { EventCoalescer } from "./event-coalescer";
import { OpsGateway } from "./ops.gateway";
import { buildEnvelope } from "./realtime-envelope";
import { TrackingGateway } from "./tracking.gateway";

interface DroneCreatedPayload {
  droneId: string;
}
interface DroneStatusChangedPayload {
  droneId: string;
  fromStatus: string;
  toStatus: string;
}
interface DroneLocationPayload {
  droneId: string;
  lat: number;
  lng: number;
}
interface DroneBatteryPayload {
  droneId: string;
  batteryPercent: number;
}
interface MissionLifecyclePayload {
  missionId: string;
  deliveryId: string;
}
interface MissionAbortedPayload extends MissionLifecyclePayload {
  reason: string;
}
interface DroneReturnToHomePayload extends MissionAbortedPayload {
  droneId: string;
}
interface DeliveryStatusChangedPayload {
  deliveryId: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
}
interface WeatherSafetyPayload {
  missionId: string;
  deliveryId: string;
  reasons: string[];
}
interface GeofenceViolationPayload {
  missionId?: string;
  deliveryId: string;
  zoneNames: string[];
  zoneIds?: string[];
}
type MissionSafetyCategory = "WEATHER" | "GEOFENCE";
interface MissionSafetyBlockedPayload {
  missionId: string;
  deliveryId: string;
  category: MissionSafetyCategory;
  reason: string;
}
interface MissionSafetyClearedPayload {
  missionId: string;
  deliveryId: string;
}
interface RouteOptimizedPayload {
  missionId: string;
  deliveryId: string;
  routeId: string;
  distanceMeters: number;
  alternativesConsidered: number;
}
interface RouteRejectedPayload {
  deliveryId: string;
  reasons: string[];
}
interface RouteReroutedPayload {
  missionId: string;
  deliveryId: string;
  routeId: string;
  distanceMeters: number;
  reason: string;
}
interface EtaPredictedPayload {
  missionId: string;
  deliveryId: string;
  etaAt: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  factors: string[];
}
interface DeliveryRiskAssessedPayload {
  missionId: string;
  deliveryId: string;
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  requiresApproval: boolean;
  reasons: string[];
}
interface DroneRecommendedPayload {
  missionId: string;
  deliveryId: string;
  droneId: string;
  droneName: string;
  score: number;
}
interface VisionDetectedPayload {
  analysisId: string;
  droneId: string | null;
  missionId: string | null;
  objectCount: number;
  obstructed: boolean;
  humanDetected: boolean;
}
interface LandingZoneEvaluatedPayload {
  evaluationId: string;
  missionId: string | null;
  deliveryId: string | null;
  verdict: string;
  suitabilityScore: number;
}
interface SwarmPlanCreatedPayload {
  swarmId: string;
  planId: string;
  assignmentCount: number;
  unassignedCount: number;
}
interface SwarmAssignmentChangedPayload {
  planId: string;
  assignmentId: string;
  droneId: string;
}
interface SwarmDisbandedPayload {
  swarmId: string;
}
interface DigitalTwinSimulationStartedPayload {
  scenarioId: string;
  startedAt: string;
}
interface DigitalTwinSimulationCompletedPayload {
  scenarioId: string;
  runId: string;
  status: string;
  riskFindingCount: number;
}
interface AdvancedRiskDetectedPayload {
  source: string;
  missionId?: string | null;
  deliveryId?: string | null;
  scenarioId?: string;
  runId?: string;
  severity: string;
  message: string;
}

/** The only place a Phase 8 safety category is turned into customer-visible text — deliberately generic, never the raw ops reason (wind speed readings, zone names). See `docs/ARCHITECTURE.md`'s "Weather, Geofencing, and Safety" section. */
function customerSafeSafetyMessage(category: MissionSafetyCategory): string {
  return category === "WEATHER"
    ? "Your delivery is delayed due to weather conditions. We'll resume once it's safe to fly."
    : "Your delivery is delayed for a safety review. We'll resume shortly.";
}

/**
 * The "Realtime Gateway" node in the Phase 7 architecture diagram
 * (`Drone/Mission/Delivery -> Domain Events -> Realtime Gateway ->
 * WebSocket -> Authorized clients`) — the only place that listens to the
 * domain-event bus for realtime purposes and decides which Socket.IO
 * room(s) each event belongs in. It never writes to the database and never
 * drives business logic (that stays in `MissionsService`/`DronesService`/
 * `DeliveryService`); it only reads (`MissionsService.findActiveMissionByDroneId`,
 * a cross-module read through the owning service, same convention as
 * everywhere else) to resolve which customer's delivery room a drone-scoped
 * event belongs to. High-frequency events (location/battery) are coalesced
 * per drone via `EventCoalescer`; low-frequency lifecycle events
 * (mission/delivery status changes, RTH) are relayed immediately.
 */
@Injectable()
export class RealtimeBroadcasterService implements OnModuleDestroy {
  private readonly coalescer = new EventCoalescer();
  private readonly throttleMs: number;

  constructor(
    private readonly trackingGateway: TrackingGateway,
    private readonly opsGateway: OpsGateway,
    private readonly missionsService: MissionsService,
    configService: ConfigService<EnvConfig, true>,
  ) {
    this.throttleMs = configService.get("REALTIME_TELEMETRY_THROTTLE_MS", { infer: true });
  }

  onModuleDestroy(): void {
    this.coalescer.clear();
  }

  @OnEvent("drone.created")
  onDroneCreated(payload: DroneCreatedPayload): void {
    this.toOps("drone.created", payload, ["ops:fleet"]);
  }

  @OnEvent("drone.status_changed")
  async onDroneStatusChanged(payload: DroneStatusChangedPayload): Promise<void> {
    this.toOps("drone.status_changed", payload, ["ops:fleet", `drone:${payload.droneId}`]);
    const active = await this.missionsService.findActiveMissionByDroneId(payload.droneId);
    if (active) {
      this.toTracking("drone.status_changed", { ...payload, missionId: active.missionId, deliveryId: active.deliveryId }, [
        `delivery:${active.deliveryId}`,
      ]);
    }
  }

  @OnEvent("drone.location_updated")
  onDroneLocationUpdated(payload: DroneLocationPayload): void {
    this.coalescer.schedule(
      `drone:${payload.droneId}:location`,
      () => {
        void this.relayDroneTelemetry("drone.location_updated", payload);
      },
      this.throttleMs,
    );
  }

  @OnEvent("drone.battery_updated")
  onDroneBatteryUpdated(payload: DroneBatteryPayload): void {
    this.coalescer.schedule(
      `drone:${payload.droneId}:battery`,
      () => {
        void this.relayDroneTelemetry("drone.battery_updated", payload);
      },
      this.throttleMs,
    );
  }

  @OnEvent("mission.created")
  async onMissionCreated(payload: MissionLifecyclePayload): Promise<void> {
    this.relayMissionEvent("mission.created", payload);
  }

  @OnEvent("mission.started")
  onMissionStarted(payload: MissionLifecyclePayload): void {
    this.relayMissionEvent("mission.started", payload);
  }

  @OnEvent("mission.progressed")
  onMissionProgressed(payload: MissionLifecyclePayload): void {
    this.relayMissionEvent("mission.progressed", payload);
  }

  @OnEvent("mission.completed")
  onMissionCompleted(payload: MissionLifecyclePayload): void {
    this.relayMissionEvent("mission.completed", payload);
  }

  @OnEvent("mission.aborted")
  onMissionAborted(payload: MissionAbortedPayload): void {
    this.relayMissionEvent("mission.aborted", payload);
  }

  @OnEvent("drone.return_to_home")
  onDroneReturnToHome(payload: DroneReturnToHomePayload): void {
    this.toOps("drone.return_to_home", payload, ["ops:fleet", `mission:${payload.missionId}`, `drone:${payload.droneId}`]);
    this.toTracking("drone.return_to_home", payload, [`delivery:${payload.deliveryId}`]);
  }

  @OnEvent("delivery.status_changed")
  onDeliveryStatusChanged(payload: DeliveryStatusChangedPayload): void {
    // Customer-facing only, per the note on DeliveryService.recordEvent() —
    // admin/ops already gets equivalent signal from the mission.* events.
    this.toTracking("delivery.status_changed", payload, [`delivery:${payload.deliveryId}`]);
  }

  // --- Phase 8 safety events -----------------------------------------
  // weather.*/geofence.violation are ops-only: raw wind readings and zone
  // names are internal detail a customer should never see (Phase 8 security
  // requirement). mission.safety_blocked/mission.safety_cleared reach both
  // rooms, but with different payloads — ops gets the full reason, the
  // customer's `/tracking` room gets only a generic, pre-written message via
  // customerSafeSafetyMessage().

  @OnEvent("weather.warning")
  onWeatherWarning(payload: WeatherSafetyPayload): void {
    this.toOps("weather.warning", payload, ["ops:fleet", `mission:${payload.missionId}`]);
  }

  @OnEvent("weather.unsafe")
  onWeatherUnsafe(payload: WeatherSafetyPayload): void {
    this.toOps("weather.unsafe", payload, ["ops:fleet", `mission:${payload.missionId}`]);
  }

  @OnEvent("geofence.violation")
  onGeofenceViolation(payload: GeofenceViolationPayload): void {
    const rooms = ["ops:fleet"];
    if (payload.missionId) {
      rooms.push(`mission:${payload.missionId}`);
    }
    this.toOps("geofence.violation", payload, rooms);
  }

  @OnEvent("mission.safety_blocked")
  onMissionSafetyBlocked(payload: MissionSafetyBlockedPayload): void {
    this.toOps("mission.safety_blocked", payload, ["ops:fleet", `mission:${payload.missionId}`]);
    this.toTracking(
      "mission.safety_blocked",
      { deliveryId: payload.deliveryId, category: payload.category, message: customerSafeSafetyMessage(payload.category) },
      [`delivery:${payload.deliveryId}`],
    );
  }

  @OnEvent("mission.safety_cleared")
  onMissionSafetyCleared(payload: MissionSafetyClearedPayload): void {
    this.toOps("mission.safety_cleared", payload, ["ops:fleet", `mission:${payload.missionId}`]);
    this.toTracking("mission.safety_cleared", { deliveryId: payload.deliveryId }, [`delivery:${payload.deliveryId}`]);
  }

  // --- Phase 9 AI events -----------------------------------------------
  // All six carry their full, explainable payload to ops only — internal
  // route/risk/fleet-scoring detail must never reach a customer (phase-09
  // security requirement). eta.predicted is the one exception: it also
  // reaches the customer's `/tracking` room, but with a sanitized
  // `{ deliveryId, etaAt }` echo only — never confidence/factors.

  @OnEvent("route.optimized")
  onRouteOptimized(payload: RouteOptimizedPayload): void {
    this.toOps("route.optimized", payload, ["ops:fleet", `mission:${payload.missionId}`]);
  }

  @OnEvent("route.rejected")
  onRouteRejected(payload: RouteRejectedPayload): void {
    this.toOps("route.rejected", payload, ["ops:fleet"]);
  }

  @OnEvent("route.rerouted")
  onRouteRerouted(payload: RouteReroutedPayload): void {
    this.toOps("route.rerouted", payload, ["ops:fleet", `mission:${payload.missionId}`]);
  }

  @OnEvent("eta.predicted")
  onEtaPredicted(payload: EtaPredictedPayload): void {
    this.toOps("eta.predicted", payload, ["ops:fleet", `mission:${payload.missionId}`]);
    this.toTracking("eta.predicted", { deliveryId: payload.deliveryId, etaAt: payload.etaAt }, [`delivery:${payload.deliveryId}`]);
  }

  @OnEvent("delivery.risk_assessed")
  onDeliveryRiskAssessed(payload: DeliveryRiskAssessedPayload): void {
    this.toOps("delivery.risk_assessed", payload, ["ops:fleet", `mission:${payload.missionId}`]);
  }

  @OnEvent("drone.recommended")
  onDroneRecommended(payload: DroneRecommendedPayload): void {
    this.toOps("drone.recommended", payload, ["ops:fleet", `mission:${payload.missionId}`]);
  }

  // --- Phase 11 advanced-intelligence events ---------------------------
  // Every event here is ops-only (Part 12: "sensitive operational
  // information must not be broadcast through customer realtime
  // channels") — computer-vision detections, swarm planning, and
  // simulation results are all internal operational/planning detail, with
  // no customer-safe summary to translate them into (unlike Phase 8's
  // safety holds or Phase 9's ETA, which have one). Payloads are bounded
  // (ids, counts, scores) — never a raw detection array or full
  // simulation trace (Part 9's explicit instruction).

  @OnEvent("vision.detected")
  onVisionDetected(payload: VisionDetectedPayload): void {
    const rooms = ["ops:fleet"];
    if (payload.missionId) {
      rooms.push(`mission:${payload.missionId}`);
    }
    this.toOps("vision.detected", payload, rooms);
  }

  @OnEvent("landing_zone.evaluated")
  onLandingZoneEvaluated(payload: LandingZoneEvaluatedPayload): void {
    const rooms = ["ops:fleet"];
    if (payload.missionId) {
      rooms.push(`mission:${payload.missionId}`);
    }
    this.toOps("landing_zone.evaluated", payload, rooms);
  }

  @OnEvent("swarm.plan_created")
  onSwarmPlanCreated(payload: SwarmPlanCreatedPayload): void {
    this.toOps("swarm.plan_created", payload, ["ops:fleet"]);
  }

  @OnEvent("swarm.assignment_changed")
  onSwarmAssignmentChanged(payload: SwarmAssignmentChangedPayload): void {
    this.toOps("swarm.assignment_changed", payload, ["ops:fleet"]);
  }

  @OnEvent("swarm.disbanded")
  onSwarmDisbanded(payload: SwarmDisbandedPayload): void {
    this.toOps("swarm.disbanded", payload, ["ops:fleet"]);
  }

  @OnEvent("digital_twin.simulation_started")
  onDigitalTwinSimulationStarted(payload: DigitalTwinSimulationStartedPayload): void {
    this.toOps("digital_twin.simulation_started", payload, ["ops:fleet"]);
  }

  @OnEvent("digital_twin.simulation_completed")
  onDigitalTwinSimulationCompleted(payload: DigitalTwinSimulationCompletedPayload): void {
    this.toOps("digital_twin.simulation_completed", payload, ["ops:fleet"]);
  }

  @OnEvent("advanced_risk.detected")
  onAdvancedRiskDetected(payload: AdvancedRiskDetectedPayload): void {
    const rooms = ["ops:fleet"];
    if (payload.missionId) {
      rooms.push(`mission:${payload.missionId}`);
    }
    this.toOps("advanced_risk.detected", payload, rooms);
  }

  private relayMissionEvent(type: Parameters<typeof buildEnvelope>[0], payload: MissionLifecyclePayload | MissionAbortedPayload): void {
    this.toOps(type, payload, ["ops:fleet", `mission:${payload.missionId}`]);
    this.toTracking(type, payload, [`delivery:${payload.deliveryId}`]);
  }

  private async relayDroneTelemetry(
    type: "drone.location_updated" | "drone.battery_updated",
    payload: DroneLocationPayload | DroneBatteryPayload,
  ): Promise<void> {
    this.toOps(type, payload, ["ops:fleet", `drone:${payload.droneId}`]);
    const active = await this.missionsService.findActiveMissionByDroneId(payload.droneId);
    if (active) {
      this.toOps(type, payload, [`mission:${active.missionId}`]);
      this.toTracking(type, { ...payload, missionId: active.missionId, deliveryId: active.deliveryId }, [`delivery:${active.deliveryId}`]);
    }
  }

  private toOps(type: Parameters<typeof buildEnvelope>[0], data: object, rooms: string[]): void {
    if (!this.opsGateway.server) {
      return;
    }
    const envelope = buildEnvelope(type, data);
    for (const room of rooms) {
      this.opsGateway.server.to(room).emit("event", envelope);
    }
  }

  private toTracking(type: Parameters<typeof buildEnvelope>[0], data: object, rooms: string[]): void {
    if (!this.trackingGateway.server) {
      return;
    }
    const envelope = buildEnvelope(type, data);
    for (const room of rooms) {
      this.trackingGateway.server.to(room).emit("event", envelope);
    }
  }
}
