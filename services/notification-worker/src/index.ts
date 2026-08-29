export * from "./publisher.js";
export * from "./processor.js";
export * from "./worker.js";

// Backward-compatibility alias
export interface NotificationDeliveryAdapter {
  deliver(notification: { recipientId: string; template: string }): Promise<void>;
}
