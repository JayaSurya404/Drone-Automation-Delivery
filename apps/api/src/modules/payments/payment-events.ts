/** Payload emitted on the in-process event bus for `"payment.succeeded"` / `"payment.failed"` — consumed by OrdersModule's listener. */
export interface PaymentOutcomeEvent {
  orderId: string;
  paymentId: string;
  failureReason?: string;
}
