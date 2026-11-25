import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuditModule } from "../audit/audit.module";
import { DronesModule } from "../drones/drones.module";
import { UsersModule } from "../users/users.module";
import { VisionModule } from "../vision/vision.module";
import { WeatherModule } from "../weather/weather.module";
import { DigitalTwinController } from "./digital-twin.controller";
import { DigitalTwinService } from "./digital-twin.service";

/**
 * Part 6/7 — the digital twin. Imports `AiModule` for the exact
 * `ROUTE_OPTIMIZER`/`DeliveryRiskAnalyzerService` real missions use,
 * `WeatherModule` for the real safety evaluation, and `VisionModule` to
 * reuse `LandingZoneService` for the destination check — never a parallel
 * implementation of any of these (Part 6's "use the existing... AI...
 * Safety... architecture instead of creating parallel systems").
 */
@Module({
  imports: [AiModule, DronesModule, WeatherModule, VisionModule, AuditModule, UsersModule],
  controllers: [DigitalTwinController],
  providers: [DigitalTwinService],
  exports: [DigitalTwinService],
})
export class DigitalTwinModule {}
