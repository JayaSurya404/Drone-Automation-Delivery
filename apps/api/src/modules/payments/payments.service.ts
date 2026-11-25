import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, type PaymentProviderType, type PaymentStatus } from "@prisma/client";
import type Stripe from "stripe";
import type { EnvConfig } from "../../config/env.validation";
import { PrismaService } from "../../prisma/prisma.service";
import type { PaymentOutcomeEvent } from "./payment-events";
import { CodPaymentProvider } from "./providers/cod-payment.provider";
import type { InitiatePaymentInput, InitiatePaymentResult, PaymentProviderAdapter } from "./providers/payment-provider.interface";
import { SimulatedPaymentProvider } from "./providers/simulated-payment.provider";
import { StripeProvider } from "./providers/stripe.provider";

export interface ApplyPaymentEventInput {
  provider: PaymentProviderType;
  /** Unique per (provider, this id) — the DB constraint on this pair is what makes re-delivery a no-op. */
  providerEventId: string;
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  providerReference?: string;
  failureReason?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class PaymentsService {
  private readonly providers: Map<PaymentProviderType, PaymentProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService<EnvConfig, true>,
    simulated: SimulatedPaymentProvider,
    cod: CodPaymentProvider,
    private readonly stripe: StripeProvider,
  ) {
    this.providers = new Map<PaymentProviderType, PaymentProviderAdapter>([
      [simulated.type, simulated],
      [cod.type, cod],
      [stripe.type, stripe],
    ]);
  }

  /**
   * Calls the chosen provider and, for providers that resolve synchronously
   * (SIMULATED, COD), immediately applies the resulting event through the
   * same idempotent path a webhook would use — by the time this resolves,
   * OrdersModule's listener has already reacted (see `applyPaymentEvent`,
   * which awaits `emitAsync`). Stripe returns "pending" instead; its outcome
   * arrives later via `handleStripeWebhook`.
   */
  async initiatePayment(input: {
    paymentId: string;
    orderId: string;
    amount: number;
    currency: string;
    provider: PaymentProviderType;
    testCardNumber?: string;
  }): Promise<InitiatePaymentResult> {
    const provider = this.providers.get(input.provider);
    if (!provider) {
      throw new BadRequestException(`Unsupported payment provider: ${input.provider}`);
    }

    const providerInput: InitiatePaymentInput = {
      paymentId: input.paymentId,
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      testCardNumber: input.testCardNumber,
    };
    const result = await provider.initiate(providerInput);

    if (result.status === "pending") {
      await this.prisma.payment.update({
        where: { id: input.paymentId },
        data: { providerReference: result.providerReference },
      });
      return result;
    }

    await this.applyPaymentEvent({
      provider: input.provider,
      providerEventId: result.providerReference,
      type: result.status === "succeeded" ? "payment.succeeded" : "payment.failed",
      paymentId: input.paymentId,
      providerReference: result.providerReference,
      failureReason: result.failureReason,
    });
    return result;
  }

  /**
   * Idempotency ledger + state transition, shared by every provider path
   * (Simulated/COD's synchronous call above, and the Stripe webhook below).
   * The insert into `PaymentEvent` is the idempotency check: its unique
   * `(provider, providerEventId)` constraint makes a duplicate delivery of
   * the same event fail here and return early — the payment/order state is
   * never touched a second time, and the emitted domain event never fires
   * twice, so a duplicate webhook can't double-confirm an order or
   * double-release stock.
   */
  async applyPaymentEvent(input: ApplyPaymentEventInput): Promise<{ applied: boolean }> {
    try {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: input.paymentId,
          provider: input.provider,
          providerEventId: input.providerEventId,
          type: input.type,
          payload: input.payload as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { applied: false };
      }
      throw error;
    }

    const newStatus: PaymentStatus = input.type === "payment.succeeded" ? "SUCCEEDED" : "FAILED";
    const payment = await this.prisma.payment.update({
      where: { id: input.paymentId },
      data: {
        status: newStatus,
        providerReference: input.providerReference,
        failureReason: input.failureReason,
      },
    });

    const eventPayload: PaymentOutcomeEvent = {
      orderId: payment.orderId,
      paymentId: payment.id,
      failureReason: input.failureReason,
    };
    await this.eventEmitter.emitAsync(input.type, eventPayload);

    return { applied: true };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    const webhookSecret = this.configService.get("STRIPE_WEBHOOK_SECRET", { infer: true });
    if (!webhookSecret) {
      throw new BadRequestException("Stripe webhooks are not configured in this environment");
    }
    if (!signature) {
      throw new BadRequestException("Missing Stripe-Signature header");
    }

    const event = this.stripe.verifyWebhookEvent(rawBody, signature, webhookSecret);
    if (event.type !== "payment_intent.succeeded" && event.type !== "payment_intent.payment_failed") {
      return;
    }

    const intent = event.data.object as Stripe.PaymentIntent;
    const paymentId = intent.metadata.paymentId;
    if (!paymentId) {
      return;
    }

    await this.applyPaymentEvent({
      provider: "STRIPE",
      providerEventId: event.id,
      type: event.type === "payment_intent.succeeded" ? "payment.succeeded" : "payment.failed",
      paymentId,
      providerReference: intent.id,
      failureReason: event.type === "payment_intent.payment_failed" ? intent.last_payment_error?.message : undefined,
    });
  }
}
