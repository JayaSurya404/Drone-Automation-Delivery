import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { SwarmPlanStatus } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { BatteryAwareRouterService } from "../ai/battery-aware-router.service";
import { scoreDroneCandidate } from "../ai/drone-selection.util";
import { haversineMeters } from "../ai/route-geo.util";
import { DronesService, type DroneView } from "../drones/drones.service";
import { GeofencingService } from "../geofencing/geofencing.service";
import { WeatherService } from "../weather/weather.service";
import type { CreateSwarmPlanDto, SwarmPlanTargetDto } from "./dto/create-swarm-plan.dto";
import type { ReassignSwarmTaskDto } from "./dto/reassign-swarm-task.dto";
import { allocateSwarmTasks, type ScoredSwarmCandidate, type SwarmAllocationTarget } from "./swarm-allocation.util";
import { SwarmService } from "./swarm.service";

export interface SwarmAssignmentView {
  id: string;
  droneId: string | null;
  droneName: string | null;
  deliveryId: string | null;
  targetLat: number;
  targetLng: number;
  sequence: number;
  estimatedDistanceMeters: number;
  estimatedDurationSeconds: number;
  batteryFeasibility: string;
  payloadSuitable: boolean;
  score: number;
  reason: string;
}

export interface SwarmPlanUnassignedTargetView {
  deliveryId: string | null;
  lat: number;
  lng: number;
  reason: string;
}

export interface SwarmPlanView {
  id: string;
  swarmId: string;
  status: SwarmPlanStatus;
  objective: string;
  summary: string;
  assignments: SwarmAssignmentView[];
  /** Only populated on the response to the `createPlan()` call that produced them — an unmet target has no real operational value once the plan already exists (no drone was ever committed to it), so it isn't persisted; a later `getById()`/`listForSwarm()` read always reports this as `[]`. `summary` (`"N/M target(s) assigned"`) is the durable record of how many were left over. */
  unassignedTargets: SwarmPlanUnassignedTargetView[];
  createdAt: string;
}

/**
 * Part 4/5 — cooperative task allocation / load balancing across a swarm's
 * member drones. Every candidate is scored with the *exact same*
 * `scoreDroneCandidate()` function `DroneSelectionService` uses for a
 * single-drone recommendation (Part 4's "reuse the existing AI
 * recommendation/optimization layer"), then additionally checked against
 * the *existing* `GeofencingService`/`WeatherService` for the leg from the
 * drone's current position to the target (Part 12's "swarm planning must
 * pass normal safety validation" — the same reuse discipline the rest of
 * this phase follows). This never assigns a drone itself in a way that
 * bypasses an operator: a plan is a recommendation set an operator can
 * accept, reassign, or discard (`reassign()` is the explicit override
 * path).
 */
@Injectable()
export class SwarmPlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly swarmService: SwarmService,
    private readonly dronesService: DronesService,
    private readonly batteryAwareRouter: BatteryAwareRouterService,
    private readonly geofencingService: GeofencingService,
    private readonly weatherService: WeatherService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createPlan(swarmId: string, dto: CreateSwarmPlanDto, actor: AuthenticatedUser): Promise<SwarmPlanView> {
    const swarm = await this.swarmService.getById(swarmId);
    if (swarm.status === "DISBANDED") {
      throw new BadRequestException("This swarm has been disbanded");
    }
    if (swarm.members.length === 0) {
      throw new BadRequestException("Swarm has no member drones to plan against");
    }

    const drones = await Promise.all(swarm.members.map((m) => this.dronesService.getById(m.droneId)));

    const targets: SwarmAllocationTarget[] = [];
    for (const [index, rawTarget] of dto.targets.entries()) {
      const candidates: ScoredSwarmCandidate[] = [];
      for (const drone of drones) {
        candidates.push(await this.scoreCandidate(drone, rawTarget));
      }
      targets.push({
        key: rawTarget.deliveryId ?? `target-${index}`,
        deliveryId: rawTarget.deliveryId ?? null,
        lat: rawTarget.lat,
        lng: rawTarget.lng,
        priority: rawTarget.priority ?? "STANDARD",
        candidates,
      });
    }

    const { assignments, unassigned } = allocateSwarmTasks(targets);

    const plan = await this.prisma.swarmPlan.create({
      data: {
        swarmId,
        status: assignments.length > 0 ? "ACTIVE" : "DRAFT",
        objective: dto.objective,
        summary: `${assignments.length}/${dto.targets.length} target(s) assigned`,
        createdById: actor.sub,
        assignments: {
          create: assignments.map((a) => ({
            droneId: a.drone.droneId,
            deliveryId: a.deliveryId,
            targetLat: a.lat,
            targetLng: a.lng,
            sequence: a.sequence,
            estimatedDistanceMeters: a.drone.distanceMeters,
            estimatedDurationSeconds: a.drone.durationSeconds,
            batteryFeasibility: a.drone.batteryFeasibility,
            payloadSuitable: a.drone.payloadSuitable,
            score: a.drone.score,
            reason: a.drone.reason,
          })),
        },
      },
      include: { assignments: { include: { drone: { select: { id: true, name: true } } }, orderBy: { sequence: "asc" } } },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: "swarm.plan_created",
      targetType: "SwarmPlan",
      targetId: plan.id,
      metadata: { swarmId, assignmentCount: assignments.length, unassignedCount: unassigned.length },
    });
    this.eventEmitter.emit("swarm.plan_created", { swarmId, planId: plan.id, assignmentCount: assignments.length, unassignedCount: unassigned.length });

    return this.toView(plan, unassigned);
  }

  async getById(planId: string): Promise<SwarmPlanView> {
    const plan = await this.prisma.swarmPlan.findUnique({
      where: { id: planId },
      include: { assignments: { include: { drone: { select: { id: true, name: true } } }, orderBy: { sequence: "asc" } } },
    });
    if (!plan) {
      throw new NotFoundException(`Swarm plan ${planId} not found`);
    }
    return this.toView(plan, []);
  }

  async listForSwarm(swarmId: string): Promise<SwarmPlanView[]> {
    // Phase 12 fix: previously unbounded — a long-lived swarm accumulates plans indefinitely.
    const plans = await this.prisma.swarmPlan.findMany({
      where: { swarmId },
      orderBy: { createdAt: "desc" },
      include: { assignments: { include: { drone: { select: { id: true, name: true } } }, orderBy: { sequence: "asc" } } },
      take: 200,
    });
    return plans.map((p) => this.toView(p, []));
  }

  /** The explicit human-override path (Part 5's "do not directly override human/operator controls unless explicitly allowed" — this endpoint *is* that allowance). Recomputes feasibility for the newly chosen drone against the assignment's original target point, so a reassignment can't silently paper over a battery/payload mismatch. */
  async reassign(planId: string, assignmentId: string, dto: ReassignSwarmTaskDto, actor: AuthenticatedUser): Promise<SwarmPlanView> {
    const assignment = await this.prisma.swarmAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || assignment.swarmPlanId !== planId) {
      throw new NotFoundException(`Swarm assignment ${assignmentId} not found on plan ${planId}`);
    }
    const drone = await this.dronesService.getById(dto.droneId);
    const scored = await this.scoreCandidate(drone, { lat: assignment.targetLat, lng: assignment.targetLng, payloadKg: 0 });

    await this.prisma.swarmAssignment.update({
      where: { id: assignmentId },
      data: {
        droneId: drone.id,
        estimatedDistanceMeters: scored.distanceMeters,
        estimatedDurationSeconds: scored.durationSeconds,
        batteryFeasibility: scored.batteryFeasibility,
        score: scored.score,
        reason: `Manually reassigned by operator — ${scored.reason}`,
      },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: "swarm.assignment_reassigned",
      targetType: "SwarmAssignment",
      targetId: assignmentId,
      metadata: { planId, newDroneId: drone.id },
    });
    this.eventEmitter.emit("swarm.assignment_changed", { planId, assignmentId, droneId: drone.id });

    return this.getById(planId);
  }

  private async scoreCandidate(drone: DroneView, target: Pick<SwarmPlanTargetDto, "lat" | "lng" | "payloadKg">): Promise<ScoredSwarmCandidate> {
    if (drone.status !== "IDLE") {
      return {
        droneId: drone.id,
        droneName: drone.name,
        eligible: false,
        score: 0,
        distanceMeters: 0,
        durationSeconds: 0,
        batteryFeasibility: "INSUFFICIENT",
        payloadSuitable: drone.maxPayloadKg >= target.payloadKg,
        reason: `Drone is not currently available (status ${drone.status})`,
      };
    }

    const origin = drone.currentLat != null && drone.currentLng != null ? { lat: drone.currentLat, lng: drone.currentLng } : { lat: target.lat, lng: target.lng };
    const destination = { lat: target.lat, lng: target.lng };
    const distanceMeters = haversineMeters(origin, destination);
    const durationSeconds = Math.round(distanceMeters / Math.max(drone.maxSpeedMps, 1));
    const feasibility = this.batteryAwareRouter.evaluate(drone.batteryPercent, distanceMeters);

    const scored = scoreDroneCandidate({
      droneId: drone.id,
      droneName: drone.name,
      batteryPercent: drone.batteryPercent,
      batteryHealthPercent: drone.batteryHealthPercent,
      maxPayloadKg: drone.maxPayloadKg,
      distanceFromOriginMeters: distanceMeters,
      droneMaxRangeKm: drone.maxRangeKm,
      batteryFeasibilityLevel: feasibility.level,
      payloadKg: target.payloadKg,
    });

    if (!scored.eligible) {
      return {
        droneId: drone.id,
        droneName: drone.name,
        eligible: false,
        score: 0,
        distanceMeters,
        durationSeconds,
        batteryFeasibility: feasibility.level,
        payloadSuitable: drone.maxPayloadKg >= target.payloadKg,
        reason: scored.reasons[0] ?? "Not eligible",
      };
    }

    const violations = await this.geofencingService.findRouteViolations([origin, destination]);
    if (violations.length > 0) {
      return {
        droneId: drone.id,
        droneName: drone.name,
        eligible: false,
        score: 0,
        distanceMeters,
        durationSeconds,
        batteryFeasibility: feasibility.level,
        payloadSuitable: true,
        reason: `Route intersects ${violations.length} active no-fly/restricted geofence(s)`,
      };
    }

    const zoneKey = this.weatherService.zoneKeyFor(origin.lat, origin.lng);
    const weather = await this.weatherService.getCurrentWeather(origin.lat, origin.lng, zoneKey);
    const weatherSafety = this.weatherService.evaluateSafety(weather);
    if (weatherSafety.level === "UNSAFE") {
      return {
        droneId: drone.id,
        droneName: drone.name,
        eligible: false,
        score: 0,
        distanceMeters,
        durationSeconds,
        batteryFeasibility: feasibility.level,
        payloadSuitable: true,
        reason: "Weather conditions are unsafe at the drone's current location",
      };
    }

    return {
      droneId: drone.id,
      droneName: drone.name,
      eligible: true,
      score: scored.score,
      distanceMeters,
      durationSeconds,
      batteryFeasibility: feasibility.level,
      payloadSuitable: true,
      reason: scored.reasons.join("; "),
    };
  }

  private toView(
    plan: {
      id: string;
      swarmId: string;
      status: SwarmPlanStatus;
      objective: string;
      summary: string;
      createdAt: Date;
      assignments: Array<{
        id: string;
        droneId: string | null;
        drone: { id: string; name: string } | null;
        deliveryId: string | null;
        targetLat: number;
        targetLng: number;
        sequence: number;
        estimatedDistanceMeters: number;
        estimatedDurationSeconds: number;
        batteryFeasibility: string;
        payloadSuitable: boolean;
        score: number;
        reason: string;
      }>;
    },
    unassigned: Array<{ deliveryId: string | null; lat: number; lng: number; reason: string }>,
  ): SwarmPlanView {
    return {
      id: plan.id,
      swarmId: plan.swarmId,
      status: plan.status,
      objective: plan.objective,
      summary: plan.summary,
      createdAt: plan.createdAt.toISOString(),
      assignments: plan.assignments.map((a) => ({
        id: a.id,
        droneId: a.droneId,
        droneName: a.drone?.name ?? null,
        deliveryId: a.deliveryId,
        targetLat: a.targetLat,
        targetLng: a.targetLng,
        sequence: a.sequence,
        estimatedDistanceMeters: a.estimatedDistanceMeters,
        estimatedDurationSeconds: a.estimatedDurationSeconds,
        batteryFeasibility: a.batteryFeasibility,
        payloadSuitable: a.payloadSuitable,
        score: a.score,
        reason: a.reason,
      })),
      unassignedTargets: unassigned.map((u) => ({ deliveryId: u.deliveryId, lat: u.lat, lng: u.lng, reason: u.reason })),
    };
  }
}
