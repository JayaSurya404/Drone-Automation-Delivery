import { Module } from "@nestjs/common";
import { DeliveryModule } from "../delivery/delivery.module";
import { MissionsModule } from "../missions/missions.module";
import { UsersModule } from "../users/users.module";
import { OpsGateway } from "./ops.gateway";
import { RealtimeBroadcasterService } from "./realtime-broadcaster.service";
import { TrackingGateway } from "./tracking.gateway";

/**
 * Phase 7 — the WebSocket layer. Imports `UsersModule` for `JwtService`
 * (exported from there since Phase 2, same as every other guard-bearing
 * module), `DeliveryModule` for the customer ownership check
 * (`DeliveryService.getDeliveryForViewer`), and `MissionsModule` for the
 * drone-to-active-delivery lookup the broadcaster needs. No module imports
 * `RealtimeModule` back — it sits at the top of the dependency graph,
 * consuming events other modules already emit, never the reverse — so
 * there's no circular-import risk to reason about.
 */
@Module({
  imports: [UsersModule, DeliveryModule, MissionsModule],
  providers: [TrackingGateway, OpsGateway, RealtimeBroadcasterService],
  exports: [TrackingGateway, OpsGateway],
})
export class RealtimeModule {}
