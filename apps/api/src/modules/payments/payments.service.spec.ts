import { Test, type TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "./payments.service";
import { CodPaymentProvider } from "./providers/cod-payment.provider";
import { SimulatedPaymentProvider } from "./providers/simulated-payment.provider";
import { StripeProvider } from "./providers/stripe.provider";

function duplicateKeyError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
  });
}

describe("PaymentsService.applyPaymentEvent", () => {
  let service: PaymentsService;
  let prisma: {
    paymentEvent: { create: jest.Mock };
    payment: { update: jest.Mock };
  };
  let eventEmitter: { emitAsync: jest.Mock };

  const payment = { id: "payment-1", orderId: "order-1", provider: "SIMULATED" as const };

  beforeEach(async () => {
    prisma = {
      paymentEvent: { create: jest.fn().mockResolvedValue({}) },
      payment: { update: jest.fn().mockResolvedValue(payment) },
    };
    eventEmitter = { emitAsync: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        SimulatedPaymentProvider,
        CodPaymentProvider,
        StripeProvider,
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  it("applies a payment.succeeded event: updates the payment and emits the domain event", async () => {
    const result = await service.applyPaymentEvent({
      provider: "SIMULATED",
      providerEventId: "sim_payment-1",
      type: "payment.succeeded",
      paymentId: "payment-1",
      providerReference: "sim_payment-1",
    });

    expect(result.applied).toBe(true);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "payment-1" }, data: expect.objectContaining({ status: "SUCCEEDED" }) }),
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      "payment.succeeded",
      expect.objectContaining({ orderId: "order-1", paymentId: "payment-1" }),
    );
  });

  it("is a no-op for a duplicate (provider, providerEventId) — the DB unique constraint rejects the insert", async () => {
    prisma.paymentEvent.create.mockRejectedValueOnce(duplicateKeyError());

    const result = await service.applyPaymentEvent({
      provider: "SIMULATED",
      providerEventId: "sim_payment-1",
      type: "payment.succeeded",
      paymentId: "payment-1",
      providerReference: "sim_payment-1",
    });

    expect(result.applied).toBe(false);
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it("re-throws an unrelated database error instead of swallowing it as a duplicate", async () => {
    prisma.paymentEvent.create.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      service.applyPaymentEvent({
        provider: "SIMULATED",
        providerEventId: "sim_payment-1",
        type: "payment.succeeded",
        paymentId: "payment-1",
      }),
    ).rejects.toThrow("connection lost");
  });
});
