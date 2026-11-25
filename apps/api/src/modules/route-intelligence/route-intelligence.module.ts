import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { RouteIntelligenceController } from "./route-intelligence.controller";
import { RouteIntelligenceService } from "./route-intelligence.service";

@Module({
  imports: [UsersModule],
  controllers: [RouteIntelligenceController],
  providers: [RouteIntelligenceService],
  exports: [RouteIntelligenceService],
})
export class RouteIntelligenceModule {}
