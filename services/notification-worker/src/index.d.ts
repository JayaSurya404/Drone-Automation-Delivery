export interface NotificationDeliveryAdapter {
    deliver(notification: {
        recipientId: string;
        template: string;
    }): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map