import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { InventoryService } from "../inventory/inventory.service";
import { OrdersEventsListener } from "./orders-events.listener";

describe("OrdersEventsListener", () => {
  let listener: OrdersEventsListener;
  let prisma: { order: { updateMany: jest.Mock } };
  let inventoryService: { releaseStockForOrder: jest.Mock };
  let auditService: { log: jest.Mock };
  let eventEmitter: { emitAsync: jest.Mock };

  beforeEach(async () => {
    prisma = { order: { updateMany: jest.fn() } };
    inventoryService = { releaseStockForOrder: jest.fn().mockResolvedValue(undefined) };
    auditService = { log: jest.fn() };
    eventEmitter = { emitAsync: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersEventsListener,
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryService, useValue: inventoryService },
        { provide: AuditService, useValue: auditService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    listener = module.get(OrdersEventsListener);
  });

  it("on payment.succeeded, confirms a still-pending order and audits it", async () => {
    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });

    await listener.onPaymentSucceeded({ orderId: "order-1", paymentId: "payment-1" });

    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1", status: { in: ["CREATED", "PAYMENT_PENDING"] } },
        data: expect.objectContaining({ status: "CONFIRMED" }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: "orders.confirmed" }));
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith("order.confirmed", { orderId: "order-1" });
  });

  it("on payment.succeeded, is a no-op if the order already moved on (e.g. concurrently cancelled)", async () => {
    prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });

    await listener.onPaymentSucceeded({ orderId: "order-1", paymentId: "payment-1" });

    expect(auditService.log).not.toHaveBeenCalled();
    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it("on payment.failed, marks the order failed, releases stock, and audits it", async () => {
    prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });

    await listener.onPaymentFailed({ orderId: "order-1", paymentId: "payment-1", failureReason: "card_declined" });

    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PAYMENT_FAILED" }) }),
    );
    expect(inventoryService.releaseStockForOrder).toHaveBeenCalledWith("order-1");
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: "orders.payment_failed" }));
  });

  it("on payment.failed, does not release stock twice for an order that's no longer pending", async () => {
    prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });

    await listener.onPaymentFailed({ orderId: "order-1", paymentId: "payment-1" });

    expect(inventoryService.releaseStockForOrder).not.toHaveBeenCalled();
  });
});
