import { Injectable } from "@nestjs/common";
import type { InitiatePaymentInput, InitiatePaymentResult, PaymentProviderAdapter } from "./payment-provider.interface";

/**
 * Cash-on-delivery — the blueprint's "first-class alternate path (no
 * provider needed)". `status: "succeeded"` here means "accepted for COD
 * fulfillment, nothing to charge online today", not "cash collected" — the
 * actual cash handoff is a delivery-time operational concern that doesn't
 * exist until Phase 5+. The `Payment` row still exists so COD orders sit in
 * the same ledger/reconciliation shape as every other provider.
 */
@Injectable()
export class CodPaymentProvider implements PaymentProviderAdapter {
  readonly type = "COD" as const;

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    return { providerReference: `cod_${input.paymentId}`, status: "succeeded" };
  }
}
