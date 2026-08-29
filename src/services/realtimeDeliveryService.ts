import { CustomerOrder } from '../types/order';
import { HubLocation, LiveTrackingState, RealtimeCustomerEvent } from '../types/tracking';
import { api } from './api';

type EventListener = (event: RealtimeCustomerEvent) => void;

// SkyHub Central Fulfillment Center
const DEFAULT_HUB: HubLocation = {
  name: 'SkyHub Aero Fulfillment Central #1',
  latitude: 37.7625,
  longitude: -122.4480,
};

class RealtimeDeliveryService {
  private listeners: Set<EventListener> = new Set();
  private activeIntervals: Map<string, any> = new Map();

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

  // Live telemetry broadcaster for autonomous flight path
  public connectToOrderStream(orderId: string, destLat: number = 37.7749, destLng: number = -122.4194): () => void {
    if (this.activeIntervals.has(orderId)) {
      clearInterval(this.activeIntervals.get(orderId));
    }

    let progress = 0.15; // 15% along flight route
    let currentDist = 3.8;
    let currentEta = 11;
    let currentAlt = 120;
    let currentSpeed = 68;

    const interval = setInterval(() => {
      progress += 0.05;

      if (progress >= 1.0) {
        // Touchdown reached
        this.emit({
          type: 'DELIVERY_COMPLETED',
          orderId,
          timestamp: new Date().toISOString(),
          status: 'Delivered',
          location: {
            latitude: destLat,
            longitude: destLng,
            altitudeMeters: 0,
            speedKmh: 0,
            bearing: 0,
          },
          remainingDistanceKm: 0,
          estimatedArrivalMins: 0,
          message: 'Drone has touched down. Package delivered safely onto your designated drop zone.',
        });
        clearInterval(interval);
        this.activeIntervals.delete(orderId);
        return;
      }

      // Interpolate coordinates between Hub and Destination
      const lat = DEFAULT_HUB.latitude + (destLat - DEFAULT_HUB.latitude) * progress;
      const lng = DEFAULT_HUB.longitude + (destLng - DEFAULT_HUB.longitude) * progress;
      currentDist = Math.max(0.1, Math.round((1 - progress) * 4.2 * 10) / 10);
      currentEta = Math.max(1, Math.round((1 - progress) * 12));

      // Descend when close to drop zone
      if (progress > 0.8) {
        currentAlt = Math.max(15, Math.round((1 - progress) * 200));
        currentSpeed = 25;
      } else {
        currentAlt = 110 + Math.floor(Math.random() * 15);
        currentSpeed = 64 + Math.floor(Math.random() * 8);
      }

      const flightStatus = progress > 0.85 ? 'Arriving' : progress > 0.5 ? 'In Flight' : 'En Route';

      this.emit({
        type: 'DRONE_LOCATION_UPDATED',
        orderId,
        timestamp: new Date().toISOString(),
        status: flightStatus,
        location: {
          latitude: lat,
          longitude: lng,
          altitudeMeters: currentAlt,
          speedKmh: currentSpeed,
          bearing: 45,
        },
        remainingDistanceKm: currentDist,
        estimatedArrivalMins: currentEta,
        message: `Drone is ${flightStatus}. Altitude: ${currentAlt}m · Airspeed: ${currentSpeed} km/h.`,
      });
    }, 3000);

    this.activeIntervals.set(orderId, interval);

    return () => {
      clearInterval(interval);
      this.activeIntervals.delete(orderId);
    };
  }

  // Get current snapshot of tracking state
  public async getLiveTrackingSnapshotAsync(orderId: string): Promise<LiveTrackingState> {
    return api.tracking.getSnapshot(orderId);
  }

  // Fallback sync helper
  public getLiveTrackingSnapshot(order: CustomerOrder): LiveTrackingState {
    const destLat = order.deliveryAddress.latitude || 37.7749;
    const destLng = order.deliveryAddress.longitude || -122.4194;

    return {
      orderId: order.id,
      orderStatus: order.status,
      hubLocation: DEFAULT_HUB,
      destinationLocation: {
        latitude: destLat,
        longitude: destLng,
        address: `${order.deliveryAddress.building ? order.deliveryAddress.building + ', ' : ''}${order.deliveryAddress.street}, ${order.deliveryAddress.city}`,
      },
      currentDroneLocation: {
        latitude: DEFAULT_HUB.latitude + (destLat - DEFAULT_HUB.latitude) * 0.2,
        longitude: DEFAULT_HUB.longitude + (destLng - DEFAULT_HUB.longitude) * 0.2,
        altitudeMeters: 120,
        speedKmh: 64,
        bearing: 45,
      },
      flightRoute: [
        [DEFAULT_HUB.latitude, DEFAULT_HUB.longitude],
        [destLat, destLng],
      ],
      remainingDistanceKm: 3.8,
      estimatedArrivalMins: 11,
      estimatedArrivalFormatted: '11 mins',
      droneAssignedName: 'SkyLink Swift-04 (Hexacopter)',
      connectionStatus: 'connected',
      lastUpdated: new Date().toISOString(),
      isCompleted: order.status === 'Delivered',
      handoverOtp: order.deliveryOtp || '8492',
    };
  }
}

export const realtimeDeliveryService = new RealtimeDeliveryService();
