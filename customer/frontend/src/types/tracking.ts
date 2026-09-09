import { CustomerOrderStatus } from './order';

export interface DroneLocation {
  latitude: number;
  longitude: number;
  altitudeMeters?: number; // Safe consumer display e.g. "Cruising at safe altitude (65m)"
  speedKmh?: number;       // Safe consumer display e.g. "48 km/h"
  bearing?: number;        // Rotation angle in degrees
}

export interface HubLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface LiveTrackingState {
  orderId: string;
  orderStatus: CustomerOrderStatus;
  hubLocation: HubLocation;
  destinationLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  currentDroneLocation: DroneLocation;
  flightRoute: [number, number][]; // [[lat, lng], ...]
  remainingDistanceKm: number;
  estimatedArrivalMins: number;
  estimatedArrivalFormatted: string; // e.g. "8 mins"
  droneAssignedName: string; // e.g. "AeroSky Drone #04"
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  lastUpdated: string;
  isCompleted: boolean;
  handoverOtp: string;
}

export type RealtimeCustomerEventType = 
  | 'ORDER_CREATED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_STATUS_UPDATED'
  | 'DRONE_ASSIGNED'
  | 'DRONE_LAUNCHED'
  | 'DRONE_LOCATION_UPDATED'
  | 'DELIVERY_ETA_UPDATED'
  | 'DELIVERY_APPROACHING'
  | 'DELIVERY_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'DELIVERY_DELAYED';

export interface RealtimeCustomerEvent {
  type: RealtimeCustomerEventType;
  orderId: string;
  timestamp: string;
  status?: CustomerOrderStatus;
  location?: DroneLocation;
  remainingDistanceKm?: number;
  estimatedArrivalMins?: number;
  message: string;
}
