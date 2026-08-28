export interface NotificationDeliveryAdapter { deliver(notification: { recipientId: string; template: string }): Promise<void>; }
