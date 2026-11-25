import { Inject, Injectable } from "@nestjs/common";
import { BatteryAwareRouterService } from "./battery-aware-router.service";
import { AiDecisionLogService, type AiDecisionLogView } from "./ai-decision-log.service";
import { DeliveryRiskAnalyzerService, type RiskAnalysisInput } from "./delivery-risk-analyzer.service";
import { DroneSelectionService, type DroneRecommendationInput } from "./drone-selection.service";
import type { DroneRankingResult } from "./drone-selection.util";
import { ETA_PREDICTOR, type EtaPredictionResult, type EtaPredictor, type EtaPredictorInput } from "./interfaces/eta-predictor.interface";
import { ROUTE_OPTIMIZER, type RouteOptimizationResult, type RouteOptimizer, type RouteOptimizerInput } from "./interfaces/route-optimizer.interface";
import type { RiskScoreResult } from "./risk-scoring.util";

interface DecisionContext {
  deliveryId?: string | null;
  missionId?: string | null;
}

/**
 * The one thing other modules inject — `MissionsService`/`DeliveryService`
 * never reach into `RouteOptimizer`/`ETAPredictor`/etc. directly, the same
 * "one cohesive facade, not five separate dependencies" convention
 * `WeatherService` established in Phase 8. Also the only place that writes
 * to `AiDecisionLog` — every method here logs exactly one *final* decision
 * per call, never intermediate candidates, per the phase-09 "don't store
 * every transient calculation" instruction. `AiModule` still has no new
 * runtime (`PROJECT_CONTEXT.md` #8) — everything lives in-process.
 */
@Injectable()
export class AiService {
  constructor(
    @Inject(ROUTE_OPTIMIZER) private readonly routeOptimizer: RouteOptimizer,
    @Inject(ETA_PREDICTOR) private readonly etaPredictor: EtaPredictor,
    private readonly batteryAwareRouter: BatteryAwareRouterService,
    private readonly riskAnalyzer: DeliveryRiskAnalyzerService,
    private readonly droneSelection: DroneSelectionService,
    private readonly decisionLog: AiDecisionLogService,
  ) {}

  async optimizeRoute(input: RouteOptimizerInput, context: DecisionContext): Promise<RouteOptimizationResult> {
    const result = await this.routeOptimizer.optimize(input);
    await this.decisionLog.record({
      type: "ROUTE_OPTIMIZATION",
      deliveryId: context.deliveryId,
      missionId: context.missionId,
      summary: result.selected
        ? `Selected "${result.selected.id}" route — ${(result.selected.distanceMeters / 1000).toFixed(2)} km, ${result.alternatives.length} alternative(s) considered`
        : `No feasible route found among ${result.alternatives.length} candidate(s) — ${result.reasons[0] ?? "blocked"}`,
      inputs: input as unknown as object,
      outputs: result as unknown as object,
      score: result.selected?.distanceMeters ?? null,
    });
    return result;
  }

  async rerouteAround(input: RouteOptimizerInput, context: DecisionContext): Promise<RouteOptimizationResult> {
    const result = await this.routeOptimizer.optimize(input);
    await this.decisionLog.record({
      type: "REROUTE",
      deliveryId: context.deliveryId,
      missionId: context.missionId,
      summary: result.selected
        ? `In-flight reroute — selected "${result.selected.id}", ${(result.selected.distanceMeters / 1000).toFixed(2)} km to destination`
        : `In-flight reroute found no safe alternative — falling back to return-to-home`,
      inputs: input as unknown as object,
      outputs: result as unknown as object,
      score: result.selected?.distanceMeters ?? null,
    });
    return result;
  }

  async predictEta(input: EtaPredictorInput, context: DecisionContext): Promise<EtaPredictionResult> {
    const result = this.etaPredictor.predict(input);
    await this.decisionLog.record({
      type: "ETA_PREDICTION",
      deliveryId: context.deliveryId,
      missionId: context.missionId,
      summary: `ETA ${result.etaAt.toISOString()} (${Math.round(result.durationSeconds / 60)} min, ${result.confidence.toLowerCase()} confidence)`,
      inputs: input as unknown as object,
      outputs: { ...result, etaAt: result.etaAt.toISOString(), predictedAt: result.predictedAt.toISOString() },
      score: result.durationSeconds,
    });
    return result;
  }

  async assessRisk(input: RiskAnalysisInput, context: DecisionContext): Promise<RiskScoreResult> {
    const result = this.riskAnalyzer.assess(input);
    await this.decisionLog.record({
      type: "RISK_ASSESSMENT",
      deliveryId: context.deliveryId,
      missionId: context.missionId,
      summary: `Risk ${result.level} (${result.score}/100)`,
      inputs: input as unknown as object,
      outputs: result as unknown as object,
      score: result.score,
    });
    return result;
  }

  async recommendDrones(input: DroneRecommendationInput, context: DecisionContext): Promise<DroneRankingResult[]> {
    const ranked = await this.droneSelection.recommend(input);
    const top = ranked.find((r) => r.eligible);
    await this.decisionLog.record({
      type: "DRONE_RECOMMENDATION",
      deliveryId: context.deliveryId,
      missionId: context.missionId,
      summary: top ? `Recommended ${top.droneName} (score ${top.score}/100) of ${ranked.length} candidate(s)` : `No eligible drone found among ${ranked.length} candidate(s)`,
      inputs: input as unknown as object,
      outputs: { ranked } as unknown as object,
      score: top?.score ?? null,
    });
    return ranked;
  }

  /** Read-only recommendation refresh (e.g. an admin reloading the mission detail page) — deliberately NOT logged/re-emitted on every call, only the initial automatic computation at mission creation is (see `recommendDrones`'s caller). Keeps this bounded per the phase-09 performance requirement. */
  async peekDroneRecommendations(input: DroneRecommendationInput): Promise<DroneRankingResult[]> {
    return this.droneSelection.recommend(input);
  }

  evaluateBatteryFeasibility(batteryPercent: number, distanceMeters: number) {
    return this.batteryAwareRouter.evaluate(batteryPercent, distanceMeters);
  }

  async getDecisionLogForMission(missionId: string, limit?: number): Promise<AiDecisionLogView[]> {
    return this.decisionLog.listForMission(missionId, limit);
  }

  async getDecisionLogForDelivery(deliveryId: string, limit?: number): Promise<AiDecisionLogView[]> {
    return this.decisionLog.listForDelivery(deliveryId, limit);
  }
}
