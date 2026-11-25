/** Payload emitted on the in-process event bus for `"order.confirmed"` / `"order.cancelled"` — consumed by DeliveryModule's listener. */
export interface OrderLifecycleEvent {
  orderId: string;
}
