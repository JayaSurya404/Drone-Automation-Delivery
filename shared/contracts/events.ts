import { LocationCoordinates, SharedProduct, AdminOrderStatus, CustomerOrderStatus } from './types.js';

export type EventType =
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_UPDATED'
  | 'DRONE_ASSIGNED'
  | 'MISSION_LAUNCHED'
  | 'TELEMETRY_UPDATE'
  | 'DELIVERY_TOUCHDOWN'
  | 'DELIVERY_COMPLETED'
  | 'PRODUCT_SYNC'
  | 'EMERGENCY_TRIGGERED';

export interface BaseEvent<T> {
  eventType: EventType;
  eventId: string;
  timestamp: string;
  data: T;
}

export interface OrderCreatedPayload {
  customerOrderId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  items: Array<{
    productId: string;
    productName: string;
    price: number;
    quantity: number;
    weightGrams: number;
  }>;
  totalWeightKg: number;
  packageDimensions?: string;
  isDroneEligible: boolean;
  deliverySpeed: 'standard' | 'express' | 'scheduled';
  scheduledTime?: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryOtp: string;
  pickup: {
    hubId?: string;
    hubName: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    addressId?: string;
    addressText: string;
    latitude: number;
    longitude: number;
    dropZoneType: string;
    clearanceRadiusMeters: number;
    instructions?: string;
  };
}

export interface OrderStatusUpdatedPayload {
  customerOrderId: string;
  operationalOrderId: string;
  adminStatus: AdminOrderStatus;
  customerStatus: CustomerOrderStatus;
  description: string;
  updatedAt: string;
}

export interface DroneAssignedPayload {
  customerOrderId: string;
  operationalOrderId: string;
  missionId: string;
  drone: {
    id: string;
    name: string;
    model: string;
    battery: number;
    batteryHealth?: number;
    payloadCapacity: number;
  };
  estimatedDepartureTime?: string;
  estimatedFlightMinutes: number;
}

export interface MissionLaunchedPayload {
  customerOrderId: string;
  operationalOrderId: string;
  missionId: string;
  droneId: string;
  droneName: string;
  plannedRoute: Array<[number, number]>;
  distanceKm: number;
  estimatedDurationMins: number;
  launchedAt: string;
}

export interface TelemetryUpdatePayload {
  customerOrderId: string;
  missionId: string;
  droneId: string;
  droneName: string;
  status: CustomerOrderStatus;
  currentLocation: {
    latitude: number;
    longitude: number;
    altitudeMeters: number;
    speedKmh: number;
    bearing: number;
  };
  remainingDistanceKm: number;
  estimatedArrivalMins: number;
  progressPercent: number;
  timestamp: string;
  handoverOtp?: string;
}

export interface DeliveryTouchdownPayload {
  customerOrderId: string;
  missionId: string;
  droneId: string;
  arrivedAt: string;
  requiresOtp: boolean;
  message: string;
  latitude?: number;
  longitude?: number;
}

export interface DeliveryCompletedPayload {
  customerOrderId: string;
  missionId: string;
  droneId?: string;
  verifiedOtp: string;
  completedAt: string;
  notes?: string;
}

export interface ProductSyncPayload {
  action: 'create' | 'update' | 'delete';
  product: SharedProduct;
}

export interface EmergencyPayload {
  customerOrderId?: string;
  missionId?: string;
  droneId: string;
  issueType: string;
  actionTaken: 'RTH' | 'LAND' | 'PAUSE' | 'RESUME';
  message: string;
  timestamp: string;
}
