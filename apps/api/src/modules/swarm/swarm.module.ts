import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuditModule } from "../audit/audit.module";
import { DronesModule } from "../drones/drones.module";
import { GeofencingModule } from "../geofencing/geofencing.module";
import { UsersModule } from "../users/users.module";
import { WeatherModule } from "../weather/weather.module";
import { SwarmController } from "./swarm.controller";
import { SwarmPlanningService } from "./swarm-planning.service";
import { SwarmService } from "./swarm.service";

/**
 * Part 4/5 — swarm coordination and load-balancing. Imports `AiModule` to
 * reuse `BatteryAwareRouterService` and the `scoreDroneCandidate()` pure
 * function directly (never a parallel scoring model), `GeofencingModule`/
 * `WeatherModule` for the same safety-validation reuse every other Phase 11
 * module follows, and `DronesModule` for live drone state.
 */
@Module({
  imports: [AiModule, DronesModule, GeofencingModule, WeatherModule, AuditModule, UsersModule],
  controllers: [SwarmController],
  providers: [SwarmService, SwarmPlanningService],
  exports: [SwarmService, SwarmPlanningService],
})
export class SwarmModule {}
