import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuditModule } from "../audit/audit.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { DronesModule } from "../drones/drones.module";
import { GeofencingModule } from "../geofencing/geofencing.module";
import { TelemetryModule } from "../telemetry/telemetry.module";
import { UsersModule } from "../users/users.module";
import { WeatherModule } from "../weather/weather.module";
import { MissionsController } from "./missions.controller";
import { MissionsService } from "./missions.service";

@Module({
  imports: [UsersModule, AuditModule, DeliveryModule, DronesModule, TelemetryModule, GeofencingModule, WeatherModule, AiModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
