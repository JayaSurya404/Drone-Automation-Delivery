import { Module } from "@nestjs/common";
import { DronesModule } from "../drones/drones.module";
import { UsersModule } from "../users/users.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [DronesModule, UsersModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
