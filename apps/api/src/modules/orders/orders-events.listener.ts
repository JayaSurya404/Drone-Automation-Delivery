import { Injectable } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { InventoryService } from "../inventory/inventory.service";
import type { OrderLifecycleEvent } from "./order-events";
import type { PaymentOutcomeEvent } from "../payments/payment-events";

const PENDING_STATUSES = ["CREATED", "PAYMENT_PENDING"] as const;

/**
 * Reacts to the payment outcomes PaymentsService emits — this is the
 * cross-module side-effect path the architecture calls for (event bus, not
 * a direct call from PaymentsService into OrdersService). Both handlers
 * guard their update with a `status: { in: PENDING_STATUSES }` filter and
 * check the affected row count, so a payment event that arrives for an
 * order that's no longer pending (already handled, or concurrently
 * cancelled) is a safe no-op rather than a double transition.
 */
@Injectable()
export class OrdersEventsListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent("payment.succeeded")
  async onPaymentSucceeded(payload: PaymentOutcomeEvent): Promise<void> {
    // Order.status has no separate PAID row in practice: Phase 4 has no
    // post-payment gate (e.g. fraud review) between payment success and
    // confirmation, so this moves straight to CONFIRMED. PAID stays in the
    // enum for schema completeness per the blueprint's full state machine.
    const result = await this.prisma.order.updateMany({
      where: { id: payload.orderId, status: { in: [...PENDING_STATUSES] } },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    if (result.count > 0) {
      await this.auditService.log({
        action: "orders.confirmed",
        targetType: "Order",
        targetId: payload.orderId,
        metadata: { paymentId: payload.paymentId },
      });
      // Phase 5's DeliveryModule subscribes to this to create a Delivery —
      // OrdersModule never calls DeliveryModule directly (event bus, not a
      // direct cross-module call, per PROJECT_CONTEXT.md #1). `emitAsync` so
      // delivery creation completes before checkout's HTTP response is sent,
      // same reasoning as the payment-event chain above.
      const event: OrderLifecycleEvent = { orderId: payload.orderId };
      await this.eventEmitter.emitAsync("order.confirmed", event);
    }
  }

  @OnEvent("payment.failed")
  async onPaymentFailed(payload: PaymentOutcomeEvent): Promise<void> {
    const result = await this.prisma.order.updateMany({
      where: { id: payload.orderId, status: { in: [...PENDING_STATUSES] } },
      data: { status: "PAYMENT_FAILED" },
    });
    if (result.count > 0) {
      await this.inventoryService.releaseStockForOrder(payload.orderId);
      await this.auditService.log({
        action: "orders.payment_failed",
        targetType: "Order",
        targetId: payload.orderId,
        metadata: { paymentId: payload.paymentId, reason: payload.failureReason },
      });
    }
  }
}
