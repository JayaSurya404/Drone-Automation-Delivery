import { ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CartService } from "../cart/cart.service";
import { InventoryService } from "../inventory/inventory.service";
import { PaymentsService } from "../payments/payments.service";
import { AddressesService } from "../users/addresses.service";
import { OrdersService } from "./orders.service";
import { ServiceAreaChecker } from "./service-area.stub";

describe("OrdersService.cancelOrder", () => {
  let service: OrdersService;
  let prisma: {
    order: { findUnique: jest.Mock; updateMany: jest.Mock; findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
  };
  let inventoryService: { releaseStockForOrder: jest.Mock; releaseStockWithTx: jest.Mock };
  let auditService: { log: jest.Mock };

  const staffActor = { sub: "staff-1", email: "staff@skynav.local", roles: ["order_support_agent"], permissions: ["orders.read", "orders.cancel"] };
  const customerActor = { sub: "customer-1", email: "customer@skynav.local", roles: ["customer"], permissions: ["orders.read_own", "orders.cancel"] };

  const confirmedOrder = { id: "order-1", userId: "customer-1", status: "CONFIRMED" };
  const finalOrder = {
    id: "order-1",
    orderNumber: "SN-20260904-ABCDEF",
    userId: "customer-1",
    status: "CANCELLED",
    totalAmount: 26.59,
    currency: "USD",
    subtotal: 20,
    deliveryFee: 4.99,
    taxAmount: 1.6,
    discountAmount: 0,
    shippingAddress: {},
    deliverySlot: null,
    cancelledAt: new Date(),
    cancelReason: null,
    confirmedAt: null,
    createdAt: new Date(),
    items: [],
    payment: null,
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(confirmedOrder),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(finalOrder),
      },
      // Phase 12: cancelOrder() now wraps the status flip + stock release in
      // one transaction — the mock just invokes the callback with the same
      // mocked client, mirroring how Prisma's real `$transaction` passes a
      // scoped client through.
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    inventoryService = { releaseStockForOrder: jest.fn().mockResolvedValue(undefined), releaseStockWithTx: jest.fn().mockResolvedValue(undefined) };
    auditService = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: CartService, useValue: {} },
        { provide: InventoryService, useValue: inventoryService },
        { provide: PaymentsService, useValue: {} },
        { provide: AddressesService, useValue: {} },
        { provide: AuditService, useValue: auditService },
        { provide: ServiceAreaChecker, useValue: { check: jest.fn() } },
        { provide: EventEmitter2, useValue: { emitAsync: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it("lets the owning customer cancel their own CONFIRMED order and releases stock", async () => {
    await service.cancelOrder("order-1", customerActor, "changed my mind");

    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1", status: { in: ["CREATED", "PAYMENT_PENDING", "PAID", "CONFIRMED"] } },
        data: expect.objectContaining({ status: "CANCELLED", cancelReason: "changed my mind" }),
      }),
    );
    expect(inventoryService.releaseStockWithTx).toHaveBeenCalledWith(prisma, "order-1");
  });

  it("lets staff cancel any order regardless of ownership", async () => {
    await service.cancelOrder("order-1", staffActor, undefined);
    expect(prisma.order.updateMany).toHaveBeenCalled();
  });

  it("hides the order (404, not 403) from a non-owning, non-staff customer", async () => {
    const otherCustomer = { ...customerActor, sub: "someone-else" };
    await expect(service.cancelOrder("order-1", otherCustomer, undefined)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to cancel an order already in a terminal state", async () => {
    prisma.order.findUnique.mockResolvedValueOnce({ ...confirmedOrder, status: "PAYMENT_FAILED" });
    await expect(service.cancelOrder("order-1", customerActor, undefined)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("treats a concurrent status change (updateMany affects 0 rows) as a conflict, not a silent success", async () => {
    prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.cancelOrder("order-1", customerActor, undefined)).rejects.toBeInstanceOf(ConflictException);
    expect(inventoryService.releaseStockWithTx).not.toHaveBeenCalled();
  });
});
