import { Test, type TestingModule } from "@nestjs/testing";
import { OrdersService } from "../orders/orders.service";
import { DeliveryEventsListener } from "./delivery-events.listener";
import { DeliveryService } from "./delivery.service";

describe("DeliveryEventsListener", () => {
  let listener: DeliveryEventsListener;
  let deliveryService: { createFromOrder: jest.Mock; cancelForOrder: jest.Mock };
  let ordersService: { getOrderSnapshotForDelivery: jest.Mock };

  const snapshot = {
    orderId: "order-1",
    userId: "customer-1",
    orderNumber: "SN-1",
    shippingAddress: {},
    itemSummary: "Widget x2",
  };

  beforeEach(async () => {
    deliveryService = {
      createFromOrder: jest.fn().mockResolvedValue(undefined),
      cancelForOrder: jest.fn().mockResolvedValue(undefined),
    };
    ordersService = { getOrderSnapshotForDelivery: jest.fn().mockResolvedValue(snapshot) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryEventsListener,
        { provide: DeliveryService, useValue: deliveryService },
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();

    listener = module.get(DeliveryEventsListener);
  });

  it("on order.confirmed, reads the order snapshot through OrdersService and creates a Delivery", async () => {
    await listener.onOrderConfirmed({ orderId: "order-1" });

    expect(ordersService.getOrderSnapshotForDelivery).toHaveBeenCalledWith("order-1");
    expect(deliveryService.createFromOrder).toHaveBeenCalledWith(snapshot);
  });

  it("on order.cancelled, cancels the linked delivery without reading order details", async () => {
    await listener.onOrderCancelled({ orderId: "order-1" });

    expect(deliveryService.cancelForOrder).toHaveBeenCalledWith("order-1", "Order cancelled");
    expect(ordersService.getOrderSnapshotForDelivery).not.toHaveBeenCalled();
  });
});
