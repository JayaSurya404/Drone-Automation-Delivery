import { Injectable } from "@nestjs/common";
import type { InitiatePaymentInput, InitiatePaymentResult, PaymentProviderAdapter } from "./payment-provider.interface";

/** Stripe's own published test-card numbers, reused here so the deterministic behavior is recognizable to anyone who has used Stripe test mode. */
const DECLINE_TEST_CARDS = new Set(["4000000000000002", "4000000000009995"]);

/**
 * Local-development payment simulation (blueprint Section X / the explicit
 * "local development can use a deterministic mock/simulation" requirement).
 * Resolves synchronously so checkout can return the final order state in one
 * request/response — no external account, no network call, no webhook wait.
 */
@Injectable()
export class SimulatedPaymentProvider implements PaymentProviderAdapter {
  readonly type = "SIMULATED" as const;

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const providerReference = `sim_${input.paymentId}`;
    if (input.testCardNumber && DECLINE_TEST_CARDS.has(input.testCardNumber)) {
      return { providerReference, status: "failed", failureReason: "card_declined" };
    }
    return { providerReference, status: "succeeded" };
  }
}
