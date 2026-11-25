import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CartModule } from "../cart/cart.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PaymentsModule } from "../payments/payments.module";
import { UsersModule } from "../users/users.module";
import { OrdersController } from "./orders.controller";
import { OrdersEventsListener } from "./orders-events.listener";
import { OrdersService } from "./orders.service";
import { ServiceAreaChecker } from "./service-area.stub";

@Module({
  imports: [UsersModule, AuditModule, CartModule, InventoryModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersEventsListener, ServiceAreaChecker],
  exports: [OrdersService],
})
export class OrdersModule {}
