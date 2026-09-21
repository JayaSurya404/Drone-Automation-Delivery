import { generateHmacSignature } from '../../../shared/contracts/security.js';
import {
  BaseEvent,
  OrderStatusUpdatedPayload,
  DroneAssignedPayload,
  MissionLaunchedPayload,
  TelemetryUpdatePayload,
  DeliveryTouchdownPayload,
  ProductSyncPayload,
} from '../../../shared/contracts/events.js';

const CUSTOMER_API_BASE = process.env.CUSTOMER_API_BASE_URL || 'http://localhost:5000';
const SHARED_SECRET = process.env.SKYNAV_INTERNAL_SERVICE_KEY || 'skynav_secure_internal_service_key_2026';

async function sendEvent<T>(endpoint: string, event: BaseEvent<T>, retries = 3): Promise<boolean> {
  const timestamp = new Date().toISOString();
  const signature = generateHmacSignature(event, SHARED_SECRET, timestamp);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${CUSTOMER_API_BASE}${endpoint}`, {
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
        return true;
      }

      console.warn(`[CustomerIntegrationClient] Failed ${event.eventType} (status ${response.status}), attempt ${attempt}/${retries}`);
    } catch (err: any) {
      console.warn(`[CustomerIntegrationClient] Network error on ${event.eventType}: ${err.message}, attempt ${attempt}/${retries}`);
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  return false;
}

export const customerIntegrationClient = {
  notifyOrderStatus: async (payload: OrderStatusUpdatedPayload): Promise<boolean> => {
    return sendEvent('/api/internal/delivery-update', {
      eventType: 'ORDER_STATUS_UPDATED',
      eventId: `evt_status_${payload.customerOrderId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: payload,
    });
  },

  notifyDroneAssigned: async (payload: DroneAssignedPayload): Promise<boolean> => {
    return sendEvent('/api/internal/delivery-update', {
      eventType: 'DRONE_ASSIGNED',
      eventId: `evt_assign_${payload.customerOrderId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: payload,
    });
  },

  notifyMissionLaunched: async (payload: MissionLaunchedPayload): Promise<boolean> => {
    return sendEvent('/api/internal/delivery-update', {
      eventType: 'MISSION_LAUNCHED',
      eventId: `evt_launch_${payload.customerOrderId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: payload,
    });
  },

  notifyTelemetryMilestone: async (payload: TelemetryUpdatePayload): Promise<boolean> => {
    return sendEvent('/api/internal/telemetry', {
      eventType: 'TELEMETRY_UPDATE',
      eventId: `evt_telem_${payload.customerOrderId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: payload,
    });
  },

  sendTelemetryUpdate: async (payload: TelemetryUpdatePayload): Promise<boolean> => {
    return sendEvent('/api/internal/telemetry', {
      eventType: 'TELEMETRY_UPDATE',
      eventId: `evt_telem_${payload.customerOrderId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: payload,
    });
  },


  notifyDeliveryTouchdown: async (payload: DeliveryTouchdownPayload): Promise<boolean> => {
    return sendEvent('/api/internal/delivery-update', {
      eventType: 'DELIVERY_TOUCHDOWN',
      eventId: `evt_touchdown_${payload.customerOrderId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: payload,
    });
  },

  syncProduct: async (payload: ProductSyncPayload): Promise<boolean> => {
    return sendEvent('/api/internal/products/sync', {
      eventType: 'PRODUCT_SYNC',
      eventId: `evt_prod_${payload.product.id}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: payload,
    });
  },
};
