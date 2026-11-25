import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import { GeofencingModule } from "../geofencing/geofencing.module";
import { UsersModule } from "../users/users.module";
import { ModelVisionAdapter } from "./adapters/model-vision.adapter";
import { SimulatedVisionAdapter } from "./adapters/simulated-vision.adapter";
import { COMPUTER_VISION_ADAPTER, type ComputerVisionAdapter } from "./interfaces/computer-vision-adapter.interface";
import { LandingZoneService } from "./landing-zone.service";
import { VisionController } from "./vision.controller";
import { VisionService } from "./vision.service";

/**
 * Part 1/2/3 — computer vision, landing-zone intelligence, visual
 * navigation. Imports `GeofencingModule` because `LandingZoneService` calls
 * the *existing* `GeofencingService.findPointViolations()` for its safety
 * component, never a parallel spatial check (`PROJECT_CONTEXT.md` #5).
 * `UsersModule` is imported for `JwtAuthGuard`'s `JwtService` dependency,
 * the same pattern every controller-owning module already uses.
 */
@Module({
  imports: [GeofencingModule, UsersModule],
  controllers: [VisionController],
  providers: [
    VisionService,
    LandingZoneService,
    SimulatedVisionAdapter,
    ModelVisionAdapter,
    {
      provide: COMPUTER_VISION_ADAPTER,
      useFactory: (
        configService: ConfigService<EnvConfig, true>,
        simulated: SimulatedVisionAdapter,
        model: ModelVisionAdapter,
      ): ComputerVisionAdapter => (configService.get("VISION_ADAPTER", { infer: true }) === "model" ? model : simulated),
      inject: [ConfigService, SimulatedVisionAdapter, ModelVisionAdapter],
    },
  ],
  exports: [VisionService, LandingZoneService],
})
export class VisionModule {}
