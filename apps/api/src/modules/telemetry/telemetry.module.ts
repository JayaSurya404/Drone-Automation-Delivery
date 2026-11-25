import { Module } from "@nestjs/common";
import { DronesModule } from "../drones/drones.module";
import { UsersModule } from "../users/users.module";
import { GazeboBridgeService } from "./gazebo-bridge.service";
import { TelemetryController } from "./telemetry.controller";
import { TelemetryService } from "./telemetry.service";

@Module({
  imports: [UsersModule, DronesModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, GazeboBridgeService],
  exports: [TelemetryService, GazeboBridgeService],
})
export class TelemetryModule {}
