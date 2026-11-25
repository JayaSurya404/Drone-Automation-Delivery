import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import type { EnvConfig } from "../../../config/env.validation";
import type { InitiatePaymentInput, InitiatePaymentResult, PaymentProviderAdapter } from "./payment-provider.interface";

/**
 * Real Stripe integration (blueprint Section X default provider), kept
 * behind the same `PaymentProviderAdapter` interface as SIMULATED/COD so
 * core checkout/order logic never changes when this is wired up. `STRIPE_*`
 * env vars are optional (see env.validation.ts) — with no key configured,
 * this provider is present but inert, and `initiate`/webhook verification
 * fail with a clear 400 rather than silently pretending to charge anything.
 *
 * Confirmation is asynchronous: `initiate` creates a PaymentIntent and
 * returns "pending" — the actual success/failure is reported later by
 * Stripe's webhook, verified and applied via `PaymentsService.applyPaymentEvent`,
 * the exact same idempotent path SIMULATED/COD use synchronously.
 *
 * Untested against a live Stripe account in this environment (no test-mode
 * credentials available here) — see docs/CURRENT_STATUS.md.
 */
@Injectable()
export class StripeProvider implements PaymentProviderAdapter {
  readonly type = "STRIPE" as const;
  private readonly client: Stripe | null;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {
    const secretKey = this.configService.get("STRIPE_SECRET_KEY", { infer: true });
    this.client = secretKey ? new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" }) : null;
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!this.client) {
      throw new BadRequestException("Stripe is not configured in this environment");
    }
    const intent = await this.client.paymentIntents.create({
      amount: Math.round(input.amount * 100),
      currency: input.currency.toLowerCase(),
      metadata: { orderId: input.orderId, paymentId: input.paymentId },
    });
    return { providerReference: intent.id, status: "pending" };
  }

  verifyWebhookEvent(rawBody: Buffer, signature: string, webhookSecret: string): Stripe.Event {
    if (!this.client) {
      throw new BadRequestException("Stripe is not configured in this environment");
    }
    return this.client.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
