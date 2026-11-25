import { Module } from "@nestjs/common";
import { DronesModule } from "../drones/drones.module";
import { GeofencingModule } from "../geofencing/geofencing.module";
import { AiDecisionLogService } from "./ai-decision-log.service";
import { AiService } from "./ai.service";
import { BatteryAwareRouterService } from "./battery-aware-router.service";
import { DeliveryRiskAnalyzerService } from "./delivery-risk-analyzer.service";
import { DroneSelectionService } from "./drone-selection.service";
import { HeuristicEtaPredictor } from "./heuristic-eta-predictor";
import { HeuristicRouteOptimizer } from "./heuristic-route-optimizer";
import { ETA_PREDICTOR } from "./interfaces/eta-predictor.interface";
import { ROUTE_OPTIMIZER } from "./interfaces/route-optimizer.interface";

/**
 * Phase 9 — still the same Phase 1 placeholder module, no new runtime
 * (`PROJECT_CONTEXT.md` #8: "AI v1 is heuristic TypeScript inside
 * `AiModule`"). Imports `GeofencingModule` because `HeuristicRouteOptimizer`
 * calls the *existing* `GeofencingService.findRouteViolations()` for every
 * candidate route — never a parallel spatial engine — and `DronesModule`
 * because `DroneSelectionService` calls the *existing*
 * `DronesService.listAvailable()` for eligible-drone candidates. Does NOT
 * import `WeatherModule` — weather data flows in as plain parameters from
 * whichever caller (`MissionsService`) already fetched it via
 * `WeatherService`, so this module never talks to the weather subsystem
 * directly (reuse, not a second integration point).
 *
 * Phase 11 additionally exports the individual heuristic services/tokens
 * (not just the `AiService` facade) so `SwarmModule`/`DigitalTwinModule` can
 * reuse the exact same route/battery/risk/drone-selection algorithms
 * directly, without going through `AiService`'s `AiDecisionLog`-writing
 * wrapper — swarm planning and digital-twin simulations are deliberately
 * NOT real dispatch decisions, so they must not be recorded in the audit
 * trail real missions use (see `docs/ARCHITECTURE.md`'s "Advanced Drone
 * Intelligence" section). This is purely additive: every existing caller
 * (`MissionsModule`, `DeliveryModule`) still only ever injects `AiService`,
 * whose method signatures are unchanged.
 */
@Module({
  imports: [GeofencingModule, DronesModule],
  providers: [
    AiService,
    AiDecisionLogService,
    BatteryAwareRouterService,
    DeliveryRiskAnalyzerService,
    DroneSelectionService,
    HeuristicRouteOptimizer,
    HeuristicEtaPredictor,
    { provide: ROUTE_OPTIMIZER, useClass: HeuristicRouteOptimizer },
    { provide: ETA_PREDICTOR, useClass: HeuristicEtaPredictor },
  ],
  exports: [AiService, BatteryAwareRouterService, DeliveryRiskAnalyzerService, DroneSelectionService, ROUTE_OPTIMIZER, ETA_PREDICTOR],
})
export class AiModule {}
