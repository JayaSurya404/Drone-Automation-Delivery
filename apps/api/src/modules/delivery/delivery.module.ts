import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuditModule } from "../audit/audit.module";
import { DronesModule } from "../drones/drones.module";
import { OrdersModule } from "../orders/orders.module";
import { UsersModule } from "../users/users.module";
import { WeatherModule } from "../weather/weather.module";
import { DeliveryController } from "./delivery.controller";
import { DeliveryEventsListener } from "./delivery-events.listener";
import { DeliveryMissionEventsListener } from "./delivery-mission-events.listener";
import { DeliveryService } from "./delivery.service";

@Module({
  imports: [UsersModule, AuditModule, OrdersModule, WeatherModule, AiModule, DronesModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, DeliveryEventsListener, DeliveryMissionEventsListener],
  exports: [DeliveryService],
})
export class DeliveryModule {}
