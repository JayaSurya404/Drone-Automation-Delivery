import { CustomerOrder, CustomerOrderStatus } from '../types/order';
import { HubLocation, LiveTrackingState, RealtimeCustomerEvent } from '../types/tracking';
import { api } from './api';

type EventListener = (event: RealtimeCustomerEvent) => void;

// SkyHub Kurumbapalayam Fulfillment Center
const DEFAULT_HUB: HubLocation = {
  name: 'SkyHub Kurumbapalayam',
  latitude: 11.1132,
  longitude: 77.0277,
};

class RealtimeDeliveryService {
  private listeners: Set<EventListener> = new Set();
  private activeWs: WebSocket | null = null;
  private activeSse: EventSource | null = null;
  private activePollInterval: ReturnType<typeof setInterval> | null = null;
  private currentOrderId: string | null = null;
  private lastTelemetryReceivedTime: number = 0;

  public getHubLocation(): HubLocation {
    return DEFAULT_HUB;
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: RealtimeCustomerEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in realtime event listener:', err);
      }
    });
  }

  private processTelemetryPacket(t: any, orderId: string) {
    if (!t) return;
    this.lastTelemetryReceivedTime = Date.now();

    const isDone = t.isCompleted || t.status === 'Delivered';
    const loc = t.currentLocation || t.currentDroneLocation || (t.latitude !== undefined ? {
      latitude: t.latitude,
      longitude: t.longitude,
      altitudeMeters: t.altitudeMeters ?? 0,
      speedKmh: t.speedKmh ?? 0,
      bearing: t.bearing ?? 0,
    } : undefined);

    if (loc && loc.latitude && loc.longitude) {
      this.emit({
        type: isDone ? 'DELIVERY_COMPLETED' : 'DRONE_LOCATION_UPDATED',
        orderId: t.orderId || orderId,
        timestamp: t.timestamp || new Date().toISOString(),
        status: (t.status || t.orderStatus || 'in_flight') as CustomerOrderStatus,
        location: {
          latitude: Number(loc.latitude),
          longitude: Number(loc.longitude),
          altitudeMeters: Number(loc.altitudeMeters || 0),
          speedKmh: Number(loc.speedKmh || 0),
          bearing: Number(loc.bearing || 0),
        },
        remainingDistanceKm: t.remainingDistanceKm,
        estimatedArrivalMins: t.estimatedArrivalMins,
        message: `Drone status: ${t.status || t.orderStatus || 'in_flight'}. Alt: ${loc.altitudeMeters || 0}m, Speed: ${loc.speedKmh || 0} km/h`,
      });
    }
  }

  // Connect to authoritative telemetry stream (SSE + WebSocket + Fast Fallback)
  public connectToOrderStream(orderId: string, _destLat?: number, _destLng?: number): () => void {
    this.disconnect();
    this.currentOrderId = orderId;
    this.lastTelemetryReceivedTime = Date.now();

    // 1. PRIMARY TRANSPORT: Server-Sent Events (SSE) via standard HTTP proxy (/api)
    if (typeof EventSource !== 'undefined') {
      try {
        const sseUrl = `/api/tracking/${orderId}/events`;
        const es = new EventSource(sseUrl);
        this.activeSse = es;

        es.onmessage = (event) => {
          try {
            if (event.data && event.data.trim()) {
              const data = JSON.parse(event.data);
              this.processTelemetryPacket(data, orderId);
            }
          } catch (e) {
            console.error('[Realtime SSE] Error parsing:', e);
          }
        };

        es.onerror = () => {
          // SSE natively auto-reconnects
        };
      } catch (e) {
        console.warn('[Realtime] SSE initialization failed:', e);
      }
    }

    // 2. SECONDARY TRANSPORT: WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${protocol}//${wsHost}/ws?orderId=${orderId}`;

    try {
      const socket = new WebSocket(wsUrl);
      this.activeWs = socket;

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'TELEMETRY_UPDATE' && message.data) {
            this.processTelemetryPacket(message.data, orderId);
          } else if (message.type === 'SNAPSHOT' && message.data) {
            this.processTelemetryPacket(message.data, orderId);
          }
        } catch (e) {
          console.error('[Realtime WS] Failed to parse message:', e);
        }
      };

      socket.onerror = () => {
        // Will rely on SSE and polling fallback
      };
    } catch (e) {
      console.warn('[Realtime WS] WebSocket initialization error:', e);
    }

    // 3. FAST RESILIENT POLLING FALLBACK (Checks every 600ms if no stream packets arrived)
    this.activePollInterval = setInterval(async () => {
      const idleTime = Date.now() - this.lastTelemetryReceivedTime;
      if (idleTime > 1200) {
        try {
          const snapshot = await api.tracking.getSnapshot(orderId);
          if (snapshot && (snapshot.currentDroneLocation || (snapshot as any).currentLocation)) {
            this.processTelemetryPacket(snapshot, orderId);
          }
        } catch {}
      }
    }, 600);

    return () => {
      this.disconnect();
    };
  }

  public disconnect() {
    if (this.activeWs) {
      try {
        this.activeWs.close();
      } catch {}
      this.activeWs = null;
    }
    if (this.activeSse) {
      try {
        this.activeSse.close();
      } catch {}
      this.activeSse = null;
    }
    if (this.activePollInterval) {
      clearInterval(this.activePollInterval);
      this.activePollInterval = null;
    }
    this.currentOrderId = null;
  }

  // Get current snapshot of tracking state
  public async getLiveTrackingSnapshotAsync(orderId: string): Promise<LiveTrackingState> {
    return api.tracking.getSnapshot(orderId);
  }

  // Fallback sync helper
  public getLiveTrackingSnapshot(order: CustomerOrder): LiveTrackingState {
    const destLat = order.deliveryAddress?.latitude || 11.1132;
    const destLng = order.deliveryAddress?.longitude || 77.0277;

    return {
      orderId: order.id,
      orderStatus: order.status,
      hubLocation: DEFAULT_HUB,
      destinationLocation: {
        latitude: destLat,
        longitude: destLng,
        address: `${order.deliveryAddress?.building ? order.deliveryAddress.building + ', ' : ''}${order.deliveryAddress?.street || ''}, ${order.deliveryAddress?.city || ''}`,
      },
      currentDroneLocation: {
        latitude: DEFAULT_HUB.latitude,
        longitude: DEFAULT_HUB.longitude,
        altitudeMeters: 0,
        speedKmh: 0,
        bearing: 0,
      },
      flightRoute: [
        [DEFAULT_HUB.latitude, DEFAULT_HUB.longitude],
        [destLat, destLng],
      ],
      remainingDistanceKm: 4.2,
      estimatedArrivalMins: 12,
      estimatedArrivalFormatted: '12 mins',
      droneAssignedName: 'Pending Dispatch Assignment',
      connectionStatus: 'connected',
      lastUpdated: new Date().toISOString(),
      isCompleted: order.status === 'Delivered',
      handoverOtp: order.deliveryOtp || '',
    };
  }
}

export const realtimeDeliveryService = new RealtimeDeliveryService();
