import type { PaymentProviderType } from "@prisma/client";

export interface InitiatePaymentInput {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  /** SIMULATED only — a Stripe-style test card number used to force a deterministic outcome. */
  testCardNumber?: string;
}

export interface InitiatePaymentResult {
  providerReference: string;
  /**
   * "pending" means the outcome is not known synchronously — the caller
   * (Stripe) confirms later via a webhook routed through the same
   * `PaymentsService.applyPaymentEvent`. SIMULATED and COD always resolve
   * synchronously, so they never return "pending".
   */
  status: "succeeded" | "pending" | "failed";
  failureReason?: string;
}

/**
 * The payment adapter interface (blueprint Section X / PROJECT_CONTEXT #3):
 * business logic (checkout, PaymentsService) only ever talks to this — never
 * to a concrete provider's SDK directly — so a real provider can be added or
 * swapped without touching order logic.
 */
export interface PaymentProviderAdapter {
  readonly type: PaymentProviderType;
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
}
