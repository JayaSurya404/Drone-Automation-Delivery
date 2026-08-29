import { CustomerOrder, CustomerOrderStatus } from '../types/order';
import { DroneLocation, HubLocation, LiveTrackingState, RealtimeCustomerEvent } from '../types/tracking';

type EventListener = (event: RealtimeCustomerEvent) => void;

// SkyHub Central Fulfillment Center
const DEFAULT_HUB: HubLocation = {
  name: 'SkyHub Aero Fulfillment Central #1',
  latitude: 37.7625,
  longitude: -122.4480,
};

class RealtimeDeliveryService {
  private activeSimulations: Map<string, any> = new Map();
  private listeners: Set<EventListener> = new Set();
  private connectionStates: Map<string, 'connected' | 'reconnecting' | 'disconnected'> = new Map();
  private progressMap: Map<string, number> = new Map(); // 0 to 1
  private lastFiredMilestones: Map<string, Set<string>> = new Map();

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

  // Calculate distance using Haversine formula (km)
  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  // Calculate bearing angle in degrees
  public calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.cos(((lon2 - lon1) * Math.PI) / 180);
    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }

  // Generate smooth flight waypoints with safe air corridor deviation
  public generateFlightRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    numPoints: number = 40
  ): [number, number][] {
    const points: [number, number][] = [];
    const midLat = (startLat + endLat) / 2 + 0.0025;
    const midLng = (startLng + endLng) / 2 - 0.0035;

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      // Quadratic bezier for realistic curved flight path
      const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * midLat + t * t * endLat;
      const lng = (1 - t) * (1 - t) * startLng + 2 * (1 - t) * t * midLng + t * t * endLng;
      points.push([parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
    }
    return points;
  }

  // Get current live tracking state snapshot for an order
  public getLiveTrackingSnapshot(order: CustomerOrder): LiveTrackingState {
    const destLat = order.deliveryAddress.latitude || 37.7749;
    const destLng = order.deliveryAddress.longitude || -122.4194;
    const route = this.generateFlightRoute(DEFAULT_HUB.latitude, DEFAULT_HUB.longitude, destLat, destLng);

    const isPreFlight =
      order.status === 'Order Placed' ||
      order.status === 'Order Confirmed' ||
      order.status === 'Preparing';

    // If pre-flight, drone is at Hub launchpad
    const progress = isPreFlight
      ? 0.0
      : order.status === 'Delivered'
      ? 1.0
      : this.progressMap.get(order.id) ?? 0.55;

    const index = Math.min(Math.floor(progress * (route.length - 1)), route.length - 1);
    const nextIndex = Math.min(index + 1, route.length - 1);

    const currentCoords = route[index];
    const nextCoords = route[nextIndex];
    const bearing = this.calculateBearing(currentCoords[0], currentCoords[1], nextCoords[0], nextCoords[1]);

    const totalDist = this.calculateDistanceKm(DEFAULT_HUB.latitude, DEFAULT_HUB.longitude, destLat, destLng);
    const remainingDist = isPreFlight
      ? totalDist
      : parseFloat((totalDist * (1 - progress)).toFixed(2));

    const remainingMins = isPreFlight
      ? Math.ceil(totalDist * 2.2) + 4
      : Math.max(1, Math.ceil(remainingDist * 2.2));

    let altitude = isPreFlight ? 0 : 65; // Safe cruising altitude
    if (!isPreFlight) {
      if (progress < 0.1) altitude = Math.round(progress * 10 * 65);
      else if (progress > 0.9) altitude = Math.max(2, Math.round((1 - progress) * 10 * 65));
    }

    const speed = isPreFlight || order.status === 'Delivered' ? 0 : 48.5;
    const connection = this.connectionStates.get(order.id) || 'connected';

    return {
      orderId: order.id,
      orderStatus: order.status,
      hubLocation: DEFAULT_HUB,
      destinationLocation: {
        latitude: destLat,
        longitude: destLng,
        address: `${order.deliveryAddress.building}, ${order.deliveryAddress.street}`,
      },
      currentDroneLocation: {
        latitude: currentCoords[0],
        longitude: currentCoords[1],
        altitudeMeters: altitude,
        speedKmh: speed,
        bearing: Math.round(bearing),
      },
      flightRoute: route,
      remainingDistanceKm: remainingDist,
      estimatedArrivalMins: remainingMins,
      estimatedArrivalFormatted: isPreFlight ? `~${remainingMins} mins` : `${remainingMins} mins`,
      droneAssignedName: isPreFlight ? 'Assigning launchpad drone...' : 'AeroSky Drone #04',
      connectionStatus: connection,
      lastUpdated: new Date().toISOString(),
      isCompleted: order.status === 'Delivered',
      handoverOtp: order.deliveryOtp || '8492',
    };
  }

  // Start real-time drone simulation ticker with smooth coordinate stepping
  public startTrackingSimulation(
    order: CustomerOrder,
    onStatusChange?: (newStatus: CustomerOrderStatus) => void
  ) {
    if (this.activeSimulations.has(order.id)) return;
    if (order.status === 'Delivered' || order.status === 'Cancelled') return;

    if (!this.lastFiredMilestones.has(order.id)) {
      this.lastFiredMilestones.set(order.id, new Set());
    }
    const firedSet = this.lastFiredMilestones.get(order.id)!;

    let currentProgress = this.progressMap.get(order.id) ?? 0.35;

    const interval = setInterval(() => {
      if (currentProgress < 1.0) {
        currentProgress = Math.min(1.0, currentProgress + 0.015);
        this.progressMap.set(order.id, currentProgress);

        let newStatus: CustomerOrderStatus = order.status;
        if (currentProgress < 0.15) newStatus = 'Drone Launched';
        else if (currentProgress < 0.8) newStatus = 'Out for Delivery';
        else if (currentProgress < 0.94) newStatus = 'Near Destination';
        else if (currentProgress < 0.99) newStatus = 'Arriving';
        else newStatus = 'Delivered';

        const snapshot = this.getLiveTrackingSnapshot({ ...order, status: newStatus });

        // Emit silent telemetry update for UI smoothing
        this.emit({
          type: 'DRONE_LOCATION_UPDATED',
          orderId: order.id,
          timestamp: new Date().toISOString(),
          status: newStatus,
          location: snapshot.currentDroneLocation,
          remainingDistanceKm: snapshot.remainingDistanceKm,
          estimatedArrivalMins: snapshot.estimatedArrivalMins,
          message: 'Silent flight coordinate interpolation.',
        });

        // Trigger meaningful milestone event ONCE
        if (newStatus === 'Near Destination' && !firedSet.has('NEAR_DESTINATION')) {
          firedSet.add('NEAR_DESTINATION');
          this.emit({
            type: 'DELIVERY_APPROACHING',
            orderId: order.id,
            timestamp: new Date().toISOString(),
            status: newStatus,
            message: 'Your delivery drone is approaching your landing zone (approx. 2 mins away).',
          });
        }

        if (newStatus !== order.status && onStatusChange) {
          onStatusChange(newStatus);
        }

        if (currentProgress >= 1.0) {
          this.stopTrackingSimulation(order.id);
          if (!firedSet.has('DELIVERED')) {
            firedSet.add('DELIVERED');
            this.emit({
              type: 'DELIVERY_COMPLETED',
              orderId: order.id,
              timestamp: new Date().toISOString(),
              status: 'Delivered',
              message: 'Your package has been safely released at your designated drop-off spot.',
            });
          }
        }
      }
    }, 2500);

    this.activeSimulations.set(order.id, interval);
  }

  public stopTrackingSimulation(orderId: string) {
    const interval = this.activeSimulations.get(orderId);
    if (interval) {
      clearInterval(interval);
      this.activeSimulations.delete(orderId);
    }
  }

  // Simulate network interruption & automatic reconnection
  public simulateNetworkDrop(orderId: string, durationMs: number = 4000) {
    this.connectionStates.set(orderId, 'reconnecting');
    this.emit({
      type: 'DELIVERY_DELAYED',
      orderId,
      timestamp: new Date().toISOString(),
      message: 'Live location temporarily unavailable. Reconnecting...',
    });

    setTimeout(() => {
      this.connectionStates.set(orderId, 'connected');
      this.emit({
        type: 'DRONE_LOCATION_UPDATED',
        orderId,
        timestamp: new Date().toISOString(),
        message: 'Live connection restored.',
      });
    }, durationMs);
  }
}

export const realtimeDeliveryService = new RealtimeDeliveryService();
