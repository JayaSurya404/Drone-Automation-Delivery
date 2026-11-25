import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import { AuditModule } from "../audit/audit.module";
import { UsersModule } from "../users/users.module";
import { MavlinkDroneAdapter } from "./adapters/mavlink-drone.adapter";
import { DRONE_ADAPTER, type DroneAdapter } from "./adapters/drone-adapter.interface";
import { SimulatedDroneAdapter } from "./adapters/simulated-drone.adapter";
import { DronesController } from "./drones.controller";
import { DronesService } from "./drones.service";

@Module({
  imports: [UsersModule, AuditModule],
  controllers: [DronesController],
  providers: [
    DronesService,
    SimulatedDroneAdapter,
    MavlinkDroneAdapter,
    {
      provide: DRONE_ADAPTER,
      useFactory: (
        configService: ConfigService<EnvConfig, true>,
        simulated: SimulatedDroneAdapter,
        mavlink: MavlinkDroneAdapter,
      ): DroneAdapter => (configService.get("DRONE_ADAPTER", { infer: true }) === "mavlink" ? mavlink : simulated),
      inject: [ConfigService, SimulatedDroneAdapter, MavlinkDroneAdapter],
    },
  ],
  exports: [DronesService, DRONE_ADAPTER, SimulatedDroneAdapter],
})
export class DronesModule {}
