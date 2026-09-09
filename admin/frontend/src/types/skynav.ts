export type DroneStatus = 'available' | 'in_flight' | 'charging' | 'returning' | 'maintenance' | 'offline' | 'emergency';

export interface LocationCoordinates {
  lat: number;
  lng: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface Drone {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  registration: string;
  status: DroneStatus;
  battery: number; // percentage
  batteryHealth: number; // percentage
  batteryCycles: number;
  temperature: number; // Celsius
  payloadCapacity: number; // kg
  currentPayloadWeight: number; // kg
  location: LocationCoordinates;
  distanceTravelledKm: number;
  remainingDistanceKm: number;
  signalStrength: number; // percentage
  currentMissionId?: string;
  lastServiceDate: string;
  nextServiceDate: string;
  issuesCount: number;
  imageUrl?: string;
  isRecommended?: boolean;
}

export type OrderStatus =
  | 'pending'
  | 'pending_dispatch'
  | 'accepted'
  | 'packing'
  | 'packed'
  | 'ready_for_dispatch'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'drone_assigned'
  | 'pickup_in_progress'
  | 'in_transit'
  | 'in_flight'
  | 'arriving'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  merchantId: string;
  merchantName: string;
  packageId: string;
  packageName: string;
  packageWeightKg: number;
  packageDimensions: string;
  packageImageUrl?: string;
  pickupAddress: string;
  pickupCoords: LocationCoordinates;
  destinationAddress: string;
  destinationCoords: LocationCoordinates;
  droneId?: string;
  missionId?: string;
  paymentStatus: 'successful' | 'pending' | 'failed' | 'refunded';
  paymentAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  timestamps: {
    created: string;
    confirmed?: string;
    verified?: string;
    droneAssigned?: string;
    pickupCompleted?: string;
    inTransit?: string;
    delivered?: string;
  };
}

export type MissionStatus =
  | 'created'
  | 'awaiting_drone'
  | 'assigned'
  | 'preparing'
  | 'pickup'
  | 'in_flight'
  | 'approaching'
  | 'delivered'
  | 'returning'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'emergency';

export interface Mission {
  id: string;
  orderId: string;
  droneId: string;
  pickupAddress: string;
  pickupCoords: LocationCoordinates;
  destinationAddress: string;
  destinationCoords: LocationCoordinates;
  plannedRoute: LocationCoordinates[];
  actualRoute: LocationCoordinates[];
  distanceKm: number;
  estimatedDurationMinutes: number;
  currentStatus: MissionStatus;
  batteryAtStart: number;
  currentBattery: number;
  currentSpeedKmH: number;
  currentAltitudeM: number;
  etaSeconds: number;
  remainingDistanceKm?: number;
  createdAt: string;
  startTime?: string;
  completionTime?: string;
}

export interface PackageItem {
  id: string;
  orderId: string;
  type: string;
  weightKg: number;
  dimensions: string;
  pickupAddress: string;
  destinationAddress: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'rejected';
  hazardLevel: 'None' | 'Fragile' | 'Temperature Sensitive' | 'High Value';
}

export interface FlightRoute {
  id: string;
  name: string;
  plannedPoints: LocationCoordinates[];
  actualPoints: LocationCoordinates[];
  distanceKm: number;
  estFlightTimeMin: number;
  deviationDetected: boolean;
  restrictedZoneCrossings: number;
  status: 'optimal' | 'deviated' | 'blocked';
}

export type GeofenceType = 'delivery' | 'restricted' | 'nofly' | 'caution';

export interface GeofenceZone {
  id: string;
  name: string;
  type: GeofenceType;
  coordinates: [number, number][];
  boundsRadiusMeters: number;
  active: boolean;
  maxAltitudeMeters: number;
  description: string;
}

export interface EmergencyAlert {
  id: string;
  droneId: string;
  missionId?: string;
  issueType: 'Critical Battery' | 'GPS Failure' | 'Communication Loss' | 'Route Deviation' | 'Motor Anomaly' | 'Weather Obstacle';
  priority: 'Critical' | 'High' | 'Medium';
  batteryLevel: number;
  gpsStatus: 'Available' | 'Degraded' | 'Lost';
  signalStatus: 'Strong' | 'Weak' | 'Lost';
  timestamp: string;
  status: 'active' | 'resolved' | 'escalated';
  recommendedAction: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  totalOrders: number;
  successfulDeliveries: number;
  status: 'Active' | 'Suspended' | 'Inactive';
  joinedDate: string;
  defaultAddress: string;
  defaultCoords: LocationCoordinates;
}

export interface Merchant {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  category: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Suspended';
  successRate: number;
  totalOrders: number;
  revenue: number;
  address: string;
  coords: LocationCoordinates;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  customerName: string;
  amount: number;
  paymentMethod: 'Credit Card' | 'Apple Pay' | 'Google Pay' | 'Crypto' | 'Corporate Account';
  status: 'Successful' | 'Pending' | 'Failed' | 'Refunded';
  timestamp: string;
  refundStatus?: 'None' | 'Requested' | 'Completed';
}

export interface MaintenanceRecord {
  id: string;
  droneId: string;
  issue: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  reportedDate: string;
  scheduledDate: string;
  status: 'Scheduled' | 'Under Maintenance' | 'Repaired' | 'Overdue';
  technician?: string;
  notes?: string;
}

export interface SupportTicket {
  id: string;
  customerId: string;
  customerName: string;
  orderId?: string;
  issue: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Waiting' | 'Resolved' | 'Closed';
  createdAt: string;
  assignedAdmin: string;
  messages: {
    sender: 'customer' | 'admin' | 'system';
    senderName: string;
    text: string;
    timestamp: string;
  }[];
}

export interface AuditLog {
  id: string;
  adminName: string;
  adminRole: string;
  action: string;
  entity: string;
  entityId: string;
  severity: 'Info' | 'Warning' | 'Critical';
  timestamp: string;
  details: string;
}

export type AdminRole =
  | 'super_admin'
  | 'ops_admin'
  | 'fleet_manager'
  | 'dispatch_manager'
  | 'support_admin'
  | 'analytics_admin'
  | 'analyst';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: AdminRole;
  avatar?: string;
  status: 'Active' | 'Inactive';
  lastLogin: string;
  permissions?: string[];
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  category: 'critical' | 'warning' | 'info' | 'success';
  timestamp: string;
  read: boolean;
}
