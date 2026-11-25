import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { OrderLifecycleEvent } from "../orders/order-events";
import { OrdersService } from "../orders/orders.service";
import { DeliveryService } from "./delivery.service";

/**
 * The cross-module side-effect path the architecture calls for: OrdersModule
 * never calls DeliveryModule directly, it only emits `order.confirmed`/
 * `order.cancelled` on the event bus, and this listener reacts. Order data
 * needed to build the Delivery is fetched via `OrdersService`'s exported
 * `getOrderSnapshotForDelivery()` — a cross-module read through the owning
 * module's service, never a direct read of the `orders` table.
 */
@Injectable()
export class DeliveryEventsListener {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly ordersService: OrdersService,
  ) {}

  @OnEvent("order.confirmed")
  async onOrderConfirmed(payload: OrderLifecycleEvent): Promise<void> {
    const snapshot = await this.ordersService.getOrderSnapshotForDelivery(payload.orderId);
    await this.deliveryService.createFromOrder(snapshot);
  }

  @OnEvent("order.cancelled")
  async onOrderCancelled(payload: OrderLifecycleEvent): Promise<void> {
    await this.deliveryService.cancelForOrder(payload.orderId, "Order cancelled");
  }
}
