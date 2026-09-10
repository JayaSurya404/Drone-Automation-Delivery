import { CustomerOrder, CustomerOrderStatus } from '../types/order';
import { HubLocation, LiveTrackingState, RealtimeCustomerEvent } from '../types/tracking';
import { api } from './api';

type EventListener = (event: RealtimeCustomerEvent) => void;

// SkyHub Chinniyampalayam Fulfillment Center
const DEFAULT_HUB: HubLocation = {
  name: 'SkyHub Chinniyampalayam',
  latitude: 11.0550,
  longitude: 77.0650,
};

class RealtimeDeliveryService {
  private listeners: Set<EventListener> = new Set();
  private activeWs: WebSocket | null = null;
  private activePollInterval: ReturnType<typeof setInterval> | null = null;
  private currentOrderId: string | null = null;

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

  // Connect to authoritative WebSocket telemetry stream from Customer Backend
  public connectToOrderStream(orderId: string, _destLat?: number, _destLng?: number): () => void {
    // Clean up any existing connection
    this.disconnect();
    this.currentOrderId = orderId;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use host (proxied by Vite in dev to :5000) or explicit backend port
    const wsHost = window.location.host;
    const wsUrl = `${protocol}//${wsHost}/ws?orderId=${orderId}`;

    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(wsUrl);
      this.activeWs = socket;

      socket.onopen = () => {
        console.log(`[Realtime] Connected to telemetry WebSocket for order: ${orderId}`);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'TELEMETRY_UPDATE' && message.data) {
            const t = message.data;
            const eventType = t.isCompleted || t.status === 'Delivered'
              ? 'DELIVERY_COMPLETED'
              : 'DRONE_LOCATION_UPDATED';

            this.emit({
              type: eventType,
              orderId: t.orderId || orderId,
              timestamp: t.timestamp || new Date().toISOString(),
              status: t.status as CustomerOrderStatus,
              location: t.currentLocation ? {
                latitude: t.currentLocation.latitude,
                longitude: t.currentLocation.longitude,
                altitudeMeters: t.currentLocation.altitudeMeters,
                speedKmh: t.currentLocation.speedKmh,
                bearing: t.currentLocation.bearing,
              } : undefined,
              remainingDistanceKm: t.remainingDistanceKm,
              estimatedArrivalMins: t.estimatedArrivalMins,
              message: `Drone status: ${t.status}. Alt: ${t.currentLocation?.altitudeMeters || 0}m, Speed: ${t.currentLocation?.speedKmh || 0} km/h`,
            });
          } else if (message.type === 'SNAPSHOT' && message.data) {
            const s = message.data;
            if (s.currentDroneLocation) {
              this.emit({
                type: 'DRONE_LOCATION_UPDATED',
                orderId: s.orderId || orderId,
                timestamp: s.lastUpdated || new Date().toISOString(),
                status: s.orderStatus as CustomerOrderStatus,
                location: s.currentDroneLocation,
                remainingDistanceKm: s.remainingDistanceKm,
                estimatedArrivalMins: s.estimatedArrivalMins,
                message: `Current status: ${s.orderStatus}`,
              });
            }
          }
        } catch (e) {
          console.error('[Realtime] Failed to parse WebSocket message:', e);
        }
      };

      socket.onerror = (err) => {
        console.warn('[Realtime] WebSocket error, starting polling fallback:', err);
        this.startPollingFallback(orderId);
      };

      socket.onclose = () => {
        console.log(`[Realtime] WebSocket closed for order: ${orderId}`);
      };
    } catch (err) {
      console.warn('[Realtime] WebSocket initialization error, starting polling fallback:', err);
      this.startPollingFallback(orderId);
    }

    return () => {
      this.disconnect();
    };
  }

  private startPollingFallback(orderId: string) {
    if (this.activePollInterval) return;

    this.activePollInterval = setInterval(async () => {
      try {
        const snapshot = await api.tracking.getSnapshot(orderId);
        if (snapshot && snapshot.currentDroneLocation) {
          const isDone = snapshot.orderStatus === 'Delivered' || snapshot.isCompleted;
          this.emit({
            type: isDone ? 'DELIVERY_COMPLETED' : 'DRONE_LOCATION_UPDATED',
            orderId,
            timestamp: snapshot.lastUpdated || new Date().toISOString(),
            status: snapshot.orderStatus as CustomerOrderStatus,
            location: snapshot.currentDroneLocation,
            remainingDistanceKm: snapshot.remainingDistanceKm,
            estimatedArrivalMins: snapshot.estimatedArrivalMins,
            message: `Current status: ${snapshot.orderStatus}`,
          });

          if (isDone && this.activePollInterval) {
            clearInterval(this.activePollInterval);
            this.activePollInterval = null;
          }
        }
      } catch (err) {
        console.warn('[Realtime] Polling fallback error:', err);
      }
    }, 2500);
  }

  public disconnect() {
    if (this.activeWs) {
      try {
        this.activeWs.close();
      } catch {}
      this.activeWs = null;
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
    const destLat = order.deliveryAddress?.latitude || 11.0550;
    const destLng = order.deliveryAddress?.longitude || 77.0650;

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
