import { generateHmacSignature } from '../../../shared/contracts/security.js';
import { BaseEvent, OrderCreatedPayload, DeliveryCompletedPayload } from '../../../shared/contracts/events.js';

const ADMIN_API_BASE = process.env.ADMIN_API_BASE_URL || 'http://localhost:5001';
const SHARED_SECRET = process.env.SKYNAV_INTERNAL_SERVICE_KEY || 'skynav_secure_internal_service_key_2026';

async function sendEvent<T>(endpoint: string, event: BaseEvent<T>, retries = 3): Promise<any> {
  const timestamp = new Date().toISOString();
  const signature = generateHmacSignature(event, SHARED_SECRET, timestamp);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SkyNav-Timestamp': timestamp,
          'X-SkyNav-Signature': signature,
          'X-SkyNav-Event-Type': event.eventType,
          'X-SkyNav-Idempotency-Key': event.eventId,
        },
        body: JSON.stringify(event),
      });

      if (response.ok) {
        return await response.json().catch(() => ({ success: true }));
      }

      console.warn(`[AdminIntegrationClient] Failed ${event.eventType} (status ${response.status}), attempt ${attempt}/${retries}`);
    } catch (err: any) {
      console.warn(`[AdminIntegrationClient] Network error on ${event.eventType}: ${err.message}, attempt ${attempt}/${retries}`);
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  return null;
}

export const adminIntegrationClient = {
  notifyOrderCreated: async (payload: OrderCreatedPayload): Promise<any> => {
    return sendEvent('/api/internal/orders', {
      eventType: 'ORDER_CREATED',
      eventId: `evt_ord_created_${payload.customerOrderId}`,
      timestamp: new Date().toISOString(),
      data: payload,
    });
  },

  notifyDeliveryCompleted: async (payload: DeliveryCompletedPayload): Promise<any> => {
    return sendEvent('/api/internal/delivery-completed', {
      eventType: 'DELIVERY_COMPLETED',
      eventId: `evt_completed_${payload.customerOrderId}`,
      timestamp: new Date().toISOString(),
      data: payload,
    });
  },
};
