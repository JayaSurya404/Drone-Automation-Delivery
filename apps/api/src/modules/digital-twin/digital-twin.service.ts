import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { SimulationStatus } from "@prisma/client";
import type { WeatherCondition } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { DEFAULT_PAYLOAD_KG } from "../ai/ai.constants";
import { DeliveryRiskAnalyzerService } from "../ai/delivery-risk-analyzer.service";
import { ROUTE_OPTIMIZER, type RouteOptimizer } from "../ai/interfaces/route-optimizer.interface";
import { DronesService, type DroneView } from "../drones/drones.service";
import { WeatherService } from "../weather/weather.service";
import { LandingZoneService } from "../vision/landing-zone.service";
import type { CreateSimulationScenarioDto } from "./dto/create-simulation-scenario.dto";
import { deriveSimulationRiskFindings, type SimulationRiskCategory, type SimulationRiskSeverity } from "./digital-twin-risk.util";

/** Phase 12 hardening — a bound on every currently-unpaginated admin list read in this service, so an unbounded amount of ad-hoc-created scenarios/runs can never be pulled into one response. */
const MAX_LIST_ROWS = 200;

export interface SimulationScenarioView {
  id: string;
  name: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  droneId: string | null;
  payloadKg: number;
  priority: string;
  weatherOverride: unknown;
  notes: string | null;
  createdAt: string;
}

export interface SimulationRiskFindingView {
  id: string;
  category: SimulationRiskCategory;
  severity: SimulationRiskSeverity;
  message: string;
}

export interface SimulationRunView {
  id: string;
  scenarioId: string;
  status: SimulationStatus;
  routeSelected: boolean;
  distanceMeters: number | null;
  durationSeconds: number | null;
  estimatedBatteryUsedPercent: number | null;
  riskScore: number | null;
  riskLevel: string | null;
  summary: string;
  riskFindings: SimulationRiskFindingView[];
  startedAt: string;
  completedAt: string;
  createdAt: string;
}

/**
 * Part 6/7 — the digital twin. `runSimulation()` never touches
 * `Mission`/`Delivery`/`Drone` tables (Part 12's "digital twin simulations
 * must be isolated from production mission state") — it computes an
 * outcome using the *exact same* algorithms real dispatch uses
 * (`HeuristicRouteOptimizer`, `DeliveryRiskAnalyzerService`,
 * `WeatherService`, `LandingZoneService`/`GeofencingService` transitively),
 * so a simulated result is honestly comparable to what a real mission would
 * do, then records only the computed result — never a full internal trace
 * or a real order/delivery row.
 */
@Injectable()
export class DigitalTwinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dronesService: DronesService,
    @Inject(ROUTE_OPTIMIZER) private readonly routeOptimizer: RouteOptimizer,
    private readonly weatherService: WeatherService,
    private readonly landingZoneService: LandingZoneService,
    private readonly riskAnalyzer: DeliveryRiskAnalyzerService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createScenario(dto: CreateSimulationScenarioDto, actor: AuthenticatedUser): Promise<SimulationScenarioView> {
    if (dto.droneId) {
      await this.dronesService.getById(dto.droneId);
    }
    const scenario = await this.prisma.simulationScenario.create({
      data: {
        name: dto.name,
        createdById: actor.sub,
        originLat: dto.originLat,
        originLng: dto.originLng,
        destinationLat: dto.destinationLat,
        destinationLng: dto.destinationLng,
        droneId: dto.droneId ?? null,
        payloadKg: dto.payloadKg ?? DEFAULT_PAYLOAD_KG,
        priority: dto.priority ?? "STANDARD",
        weatherOverride: (dto.weatherOverride as never) ?? undefined,
        notes: dto.notes ?? null,
      },
    });
    await this.auditService.log({ actorId: actor.sub, action: "simulation.scenario_created", targetType: "SimulationScenario", targetId: scenario.id });
    return this.toScenarioView(scenario);
  }

  async listScenarios(): Promise<SimulationScenarioView[]> {
    // Phase 12 fix: previously unbounded — scenarios are user-creatable with
    // no volume ceiling and nothing prunes old ones.
    const scenarios = await this.prisma.simulationScenario.findMany({ orderBy: { createdAt: "desc" }, take: MAX_LIST_ROWS });
    return scenarios.map((s) => this.toScenarioView(s));
  }

  async getScenario(id: string): Promise<SimulationScenarioView> {
    const scenario = await this.getScenarioRowOrThrow(id);
    return this.toScenarioView(scenario);
  }

  async runSimulation(scenarioId: string, actor: AuthenticatedUser): Promise<SimulationRunView> {
    const scenario = await this.getScenarioRowOrThrow(scenarioId);
    const startedAt = new Date();
    this.eventEmitter.emit("digital_twin.simulation_started", { scenarioId, startedAt: startedAt.toISOString() });

    const drone = await this.resolveDrone(scenario.droneId);
    const origin = { lat: scenario.originLat, lng: scenario.originLng };
    const destination = { lat: scenario.destinationLat, lng: scenario.destinationLng };

    const override = scenario.weatherOverride as { windSpeedMps: number; precipitationMm: number; condition: WeatherCondition } | null;
    const weatherReading = override ?? (await this.weatherService.getCurrentWeather(origin.lat, origin.lng, this.weatherService.zoneKeyFor(origin.lat, origin.lng)));
    const weatherSafety = this.weatherService.evaluateSafety(weatherReading);

    const routeResult = await this.routeOptimizer.optimize({
      origin,
      destination,
      droneMaxSpeedMps: drone?.maxSpeedMps ?? 15,
      droneMaxRangeKm: drone?.maxRangeKm ?? 10,
      droneBatteryPercent: drone?.batteryPercent,
      weather: { windSpeedMps: weatherReading.windSpeedMps, condition: weatherReading.condition, safetyLevel: weatherSafety.level },
    });
    const selected = routeResult.selected;
    const payloadExceedsCapacity = drone !== null && scenario.payloadKg > drone.maxPayloadKg;

    let riskScore: number | null = null;
    let riskLevel: string | null = null;
    if (drone && selected) {
      const risk = this.riskAnalyzer.assess({
        weatherSafetyLevel: weatherSafety.level,
        batteryFeasibilityLevel: selected.batteryFeasibility.level,
        distanceMeters: selected.distanceMeters,
        droneMaxRangeKm: drone.maxRangeKm,
        droneBatteryHealthPercent: drone.batteryHealthPercent,
        priority: scenario.priority === "EXPRESS" ? "EXPRESS" : "STANDARD",
      });
      riskScore = risk.score;
      riskLevel = risk.level;
    }

    const landingZone = await this.landingZoneService.evaluate({ lat: destination.lat, lng: destination.lng, droneId: drone?.id ?? null });

    const findings = deriveSimulationRiskFindings({
      droneAvailable: drone !== null,
      payloadExceedsCapacity,
      routeSelected: selected !== null,
      geofenceBlocked: selected === null && routeResult.alternatives.length > 0 && routeResult.alternatives.every((a) => !a.geofenceCleared),
      batteryFeasibilityLevel: selected?.batteryFeasibility.level ?? null,
      weatherSafetyLevel: weatherSafety.level,
      landingZoneVerdict: landingZone.verdict,
      obstructionDetected: landingZone.visionAnalysis.obstructed,
    });

    const completedAt = new Date();
    const summary = this.buildSummary(drone, selected, findings.length);

    const run = await this.prisma.simulationRun.create({
      data: {
        scenarioId,
        status: "COMPLETED",
        routeSelected: selected !== null,
        distanceMeters: selected?.distanceMeters ?? null,
        durationSeconds: selected?.durationSeconds ?? null,
        estimatedBatteryUsedPercent: selected?.batteryFeasibility.estimatedConsumptionPercent ?? null,
        riskScore,
        riskLevel,
        summary,
        startedAt,
        completedAt,
        riskFindings: { create: findings.map((f) => ({ category: f.category, severity: f.severity, message: f.message })) },
      },
      include: { riskFindings: true },
    });

    await this.auditService.log({
      actorId: actor.sub,
      action: "simulation.run_executed",
      targetType: "SimulationRun",
      targetId: run.id,
      metadata: { scenarioId, riskFindingCount: findings.length },
    });
    this.eventEmitter.emit("digital_twin.simulation_completed", { scenarioId, runId: run.id, status: run.status, riskFindingCount: findings.length });
    if (findings.some((f) => f.severity === "HIGH")) {
      this.eventEmitter.emit("advanced_risk.detected", { source: "DIGITAL_TWIN", scenarioId, runId: run.id, severity: "HIGH", message: summary });
    }

    return this.toRunView(run);
  }

  async listRuns(scenarioId: string): Promise<SimulationRunView[]> {
    await this.getScenarioRowOrThrow(scenarioId);
    // Phase 12 fix: previously unbounded — a scenario can be re-run indefinitely.
    const runs = await this.prisma.simulationRun.findMany({
      where: { scenarioId },
      orderBy: { createdAt: "desc" },
      include: { riskFindings: true },
      take: MAX_LIST_ROWS,
    });
    return runs.map((r) => this.toRunView(r));
  }

  async getRun(runId: string): Promise<SimulationRunView> {
    const run = await this.prisma.simulationRun.findUnique({ where: { id: runId }, include: { riskFindings: true } });
    if (!run) {
      throw new NotFoundException(`Simulation run ${runId} not found`);
    }
    return this.toRunView(run);
  }

  private async resolveDrone(droneId: string | null): Promise<DroneView | null> {
    if (droneId) {
      return this.dronesService.getById(droneId);
    }
    const available = await this.dronesService.listAvailable();
    return available[0] ?? null;
  }

  private async getScenarioRowOrThrow(id: string) {
    const scenario = await this.prisma.simulationScenario.findUnique({ where: { id } });
    if (!scenario) {
      throw new NotFoundException(`Simulation scenario ${id} not found`);
    }
    return scenario;
  }

  private buildSummary(drone: DroneView | null, selected: { distanceMeters: number } | null, riskFindingCount: number): string {
    if (!drone) {
      return `No eligible drone available — ${riskFindingCount} risk finding(s)`;
    }
    if (!selected) {
      return `No feasible route found for ${drone.name} — ${riskFindingCount} risk finding(s)`;
    }
    return `${drone.name} — ${(selected.distanceMeters / 1000).toFixed(2)} km route, ${riskFindingCount} risk finding(s)`;
  }

  private toScenarioView(scenario: {
    id: string;
    name: string;
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
    droneId: string | null;
    payloadKg: number;
    priority: string;
    weatherOverride: unknown;
    notes: string | null;
    createdAt: Date;
  }): SimulationScenarioView {
    return {
      id: scenario.id,
      name: scenario.name,
      originLat: scenario.originLat,
      originLng: scenario.originLng,
      destinationLat: scenario.destinationLat,
      destinationLng: scenario.destinationLng,
      droneId: scenario.droneId,
      payloadKg: scenario.payloadKg,
      priority: scenario.priority,
      weatherOverride: scenario.weatherOverride,
      notes: scenario.notes,
      createdAt: scenario.createdAt.toISOString(),
    };
  }

  private toRunView(run: {
    id: string;
    scenarioId: string;
    status: SimulationStatus;
    routeSelected: boolean;
    distanceMeters: number | null;
    durationSeconds: number | null;
    estimatedBatteryUsedPercent: number | null;
    riskScore: number | null;
    riskLevel: string | null;
    summary: string;
    startedAt: Date;
    completedAt: Date;
    createdAt: Date;
    riskFindings: Array<{ id: string; category: SimulationRiskCategory; severity: SimulationRiskSeverity; message: string }>;
  }): SimulationRunView {
    return {
      id: run.id,
      scenarioId: run.scenarioId,
      status: run.status,
      routeSelected: run.routeSelected,
      distanceMeters: run.distanceMeters,
      durationSeconds: run.durationSeconds,
      estimatedBatteryUsedPercent: run.estimatedBatteryUsedPercent,
      riskScore: run.riskScore,
      riskLevel: run.riskLevel,
      summary: run.summary,
      riskFindings: run.riskFindings.map((f) => ({ id: f.id, category: f.category, severity: f.severity, message: f.message })),
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt.toISOString(),
      createdAt: run.createdAt.toISOString(),
    };
  }
}
