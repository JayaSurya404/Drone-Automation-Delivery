/**
 * Centralized Typed Demo Data for SkyNav Frontend Application Shell.
 *
 * NOTE: This is isolated demo data for UI presentation and offline testing.
 * It is cleanly decoupled from real production backend API integration.
 */

export interface DemoDrone {
  id: string;
  callsign: string;
  model: string;
  status: "IDLE" | "ASSIGNED" | "TAKEOFF" | "EN_ROUTE" | "ARRIVED" | "DELIVERING" | "RETURNING" | "LANDED" | "EMERGENCY" | "OFFLINE";
  batteryPercent: number;
  altitudeMeters: number;
  speedMetersPerSecond: number;
  headingDegrees: number;
  latitude: number;
  longitude: number;
  flightHours: number;
  payloadCapacityKg: number;
  currentMissionId?: string;
}

export interface DemoOrder {
  id: string;
  orderNumber: string;
  status: "DRAFT" | "SUBMITTED" | "ASSIGNED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
  recipientName: string;
  deliveryAddress: string;
  recipientPhone: string;
  packageDescription: string;
  weightKg: number;
  assignedDroneId?: string;
  assignedDroneCallsign?: string;
  currentMissionId?: string;
  etaTime: string;
  createdAt: string;
  proofOfDeliveryCode: string;
}

export interface DemoMission {
  id: string;
  code: string;
  status: "PLANNED" | "VALIDATING" | "READY" | "AUTHORIZED" | "DISPATCHED" | "IN_PROGRESS" | "DELIVERED" | "RETURNING" | "COMPLETED" | "ABORTED";
  droneId: string;
  droneCallsign: string;
  orderId: string;
  originAddress: string;
  destinationAddress: string;
  originCoords: { latitude: number; longitude: number };
  destinationCoords: { latitude: number; longitude: number };
  progressPercent: number;
  etaMinutes: number;
  waypointsCount: number;
  riskScore: number; // 0-100 advisory score
  weatherStatus: "OPTIMAL" | "CAUTION" | "UNFAVORABLE";
}

export interface DemoAlert {
  id: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  message: string;
  timestamp: string;
  droneId?: string;
  missionId?: string;
  acknowledged: boolean;
}

export interface DemoAuditLog {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
  organizationId: string;
  details: string;
}

export interface DemoNotification {
  id: string;
  title: string;
  message: string;
  category: "DELIVERY" | "SYSTEM" | "ALERT";
  timestamp: string;
  read: boolean;
  link?: string;
}

export const DEMO_WAREHOUSE = {
  name: "SkyNav Depot Alpha (SFO)",
  latitude: 37.7749,
  longitude: -122.4194
};

export const DEMO_DRONES: DemoDrone[] = [
  {
    id: "00000000-0000-0000-0000-000000000011",
    callsign: "SKY-001",
    model: "AeroHex Heavy V4",
    status: "EN_ROUTE",
    batteryPercent: 82,
    altitudeMeters: 58,
    speedMetersPerSecond: 15.2,
    headingDegrees: 38,
    latitude: 37.7792,
    longitude: -122.4158,
    flightHours: 142.5,
    payloadCapacityKg: 4.5,
    currentMissionId: "MIS-401"
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    callsign: "SKY-002",
    model: "Falcon Delivery Quad",
    status: "DELIVERING",
    batteryPercent: 64,
    altitudeMeters: 3,
    speedMetersPerSecond: 0.2,
    headingDegrees: 180,
    latitude: 37.7845,
    longitude: -122.4082,
    flightHours: 89.1,
    payloadCapacityKg: 2.5,
    currentMissionId: "MIS-402"
  },
  {
    id: "00000000-0000-0000-0000-000000000013",
    callsign: "SKY-003",
    model: "AeroHex Heavy V4",
    status: "RETURNING",
    batteryPercent: 41,
    altitudeMeters: 62,
    speedMetersPerSecond: 14.8,
    headingDegrees: 215,
    latitude: 37.7768,
    longitude: -122.4172,
    flightHours: 210.3,
    payloadCapacityKg: 4.5,
    currentMissionId: "MIS-403"
  },
  {
    id: "00000000-0000-0000-0000-000000000014",
    callsign: "SKY-004",
    model: "Swift Courier X",
    status: "IDLE",
    batteryPercent: 100,
    altitudeMeters: 0,
    speedMetersPerSecond: 0,
    headingDegrees: 0,
    latitude: 37.7749,
    longitude: -122.4194,
    flightHours: 34.0,
    payloadCapacityKg: 2.0
  },
  {
    id: "00000000-0000-0000-0000-000000000015",
    callsign: "SKY-005",
    model: "Falcon Delivery Quad",
    status: "OFFLINE",
    batteryPercent: 95,
    altitudeMeters: 0,
    speedMetersPerSecond: 0,
    headingDegrees: 0,
    latitude: 37.7749,
    longitude: -122.4194,
    flightHours: 312.8,
    payloadCapacityKg: 2.5
  }
];

export const DEMO_ORDERS: DemoOrder[] = [
  {
    id: "ord-9021",
    orderNumber: "ORD-9021",
    status: "IN_TRANSIT",
    recipientName: "Dr. Evelyn Reed",
    deliveryAddress: "742 Montgomery St, San Francisco, CA",
    recipientPhone: "+1 (415) 555-0192",
    packageDescription: "Emergency Medical Test Kits",
    weightKg: 1.8,
    assignedDroneId: "00000000-0000-0000-0000-000000000011",
    assignedDroneCallsign: "SKY-001",
    currentMissionId: "MIS-401",
    etaTime: "10:42 AM (in 6 mins)",
    createdAt: "2026-08-29T10:15:00Z",
    proofOfDeliveryCode: "7492"
  },
  {
    id: "ord-9022",
    orderNumber: "ORD-9022",
    status: "IN_TRANSIT",
    recipientName: "Marcus Vance",
    deliveryAddress: "101 California St, San Francisco, CA",
    recipientPhone: "+1 (415) 555-0144",
    packageDescription: "Biomedical Sample Container",
    weightKg: 2.2,
    assignedDroneId: "00000000-0000-0000-0000-000000000012",
    assignedDroneCallsign: "SKY-002",
    currentMissionId: "MIS-402",
    etaTime: "10:38 AM (arrived at pad)",
    createdAt: "2026-08-29T10:10:00Z",
    proofOfDeliveryCode: "3810"
  },
  {
    id: "ord-9023",
    orderNumber: "ORD-9023",
    status: "DELIVERED",
    recipientName: "Aria Thorne",
    deliveryAddress: "555 Mission St, San Francisco, CA",
    recipientPhone: "+1 (415) 555-0188",
    packageDescription: "Laboratory Reagents Pack",
    weightKg: 0.9,
    assignedDroneId: "00000000-0000-0000-0000-000000000013",
    assignedDroneCallsign: "SKY-003",
    currentMissionId: "MIS-403",
    etaTime: "Completed 10:24 AM",
    createdAt: "2026-08-29T09:55:00Z",
    proofOfDeliveryCode: "5591"
  },
  {
    id: "ord-9024",
    orderNumber: "ORD-9024",
    status: "SUBMITTED",
    recipientName: "TechCorp Labs",
    deliveryAddress: "201 3rd St, San Francisco, CA",
    recipientPhone: "+1 (415) 555-0112",
    packageDescription: "Sensors & Diagnostic Hardware",
    weightKg: 3.4,
    etaTime: "Estimated 11:15 AM",
    createdAt: "2026-08-29T10:22:00Z",
    proofOfDeliveryCode: "8204"
  }
];

export const DEMO_MISSIONS: DemoMission[] = [
  {
    id: "mis-401",
    code: "MIS-401",
    status: "IN_PROGRESS",
    droneId: "00000000-0000-0000-0000-000000000011",
    droneCallsign: "SKY-001",
    orderId: "ord-9021",
    originAddress: "SkyNav Depot Alpha (SFO)",
    destinationAddress: "742 Montgomery St",
    originCoords: { latitude: 37.7749, longitude: -122.4194 },
    destinationCoords: { latitude: 37.7952, longitude: -122.4028 },
    progressPercent: 68,
    etaMinutes: 6,
    waypointsCount: 5,
    riskScore: 12,
    weatherStatus: "OPTIMAL"
  },
  {
    id: "mis-402",
    code: "MIS-402",
    status: "DELIVERED",
    droneId: "00000000-0000-0000-0000-000000000012",
    droneCallsign: "SKY-002",
    orderId: "ord-9022",
    originAddress: "SkyNav Depot Alpha (SFO)",
    destinationAddress: "101 California St",
    originCoords: { latitude: 37.7749, longitude: -122.4194 },
    destinationCoords: { latitude: 37.7931, longitude: -122.3989 },
    progressPercent: 95,
    etaMinutes: 1,
    waypointsCount: 4,
    riskScore: 18,
    weatherStatus: "OPTIMAL"
  },
  {
    id: "mis-403",
    code: "MIS-403",
    status: "RETURNING",
    droneId: "00000000-0000-0000-0000-000000000013",
    droneCallsign: "SKY-003",
    orderId: "ord-9023",
    originAddress: "SkyNav Depot Alpha (SFO)",
    destinationAddress: "555 Mission St",
    originCoords: { latitude: 37.7749, longitude: -122.4194 },
    destinationCoords: { latitude: 37.7892, longitude: -122.4011 },
    progressPercent: 88,
    etaMinutes: 4,
    waypointsCount: 6,
    riskScore: 8,
    weatherStatus: "OPTIMAL"
  }
];

export const DEMO_ALERTS: DemoAlert[] = [
  {
    id: "alt-101",
    severity: "WARNING",
    title: "Airspace Density Advisory",
    message: "Corridor Alpha-4 experiencing elevated localized UAS traffic near Embarcadero.",
    timestamp: "10:28 AM",
    missionId: "mis-401",
    acknowledged: false
  },
  {
    id: "alt-102",
    severity: "INFO",
    title: "Depot Charging Pad Ready",
    message: "Charging Pad #3 cleared and ready for incoming SKY-003 touchdown.",
    timestamp: "10:24 AM",
    droneId: "SKY-003",
    acknowledged: true
  },
  {
    id: "alt-103",
    severity: "CRITICAL",
    title: "Battery Warning Threshold",
    message: "SKY-003 battery reached 41% during headwind return leg. Monitoring reserves.",
    timestamp: "10:19 AM",
    droneId: "SKY-003",
    acknowledged: true
  }
];

export const DEMO_AUDIT_LOGS: DemoAuditLog[] = [
  {
    id: "aud-301",
    actor: "operator@skynav.test",
    action: "MISSION_AUTHORIZED",
    resource: "MIS-401",
    timestamp: "2026-08-29 10:14:02 UTC",
    organizationId: "00000000-0000-0000-0000-000000000001",
    details: '{"riskScore": 12, "weatherCleared": true, "corridor": "Alpha-4"}'
  },
  {
    id: "aud-302",
    actor: "admin@skynav.test",
    action: "DRONE_ASSIGNED",
    resource: "SKY-001 -> ORD-9021",
    timestamp: "2026-08-29 10:12:45 UTC",
    organizationId: "00000000-0000-0000-0000-000000000001",
    details: '{"droneId": "00000000-0000-0000-0000-000000000011", "payloadWeight": 1.8}'
  },
  {
    id: "aud-303",
    actor: "customer@skynav.test",
    action: "ORDER_CREATED",
    resource: "ORD-9021",
    timestamp: "2026-08-29 10:10:19 UTC",
    organizationId: "00000000-0000-0000-0000-000000000001",
    details: '{"deliveryAddress": "742 Montgomery St", "priority": "EXPEDITED"}'
  },
  {
    id: "aud-304",
    actor: "system_simulator",
    action: "DELIVERY_COMPLETED",
    resource: "MIS-403 -> ORD-9023",
    timestamp: "2026-08-29 10:08:33 UTC",
    organizationId: "00000000-0000-0000-0000-000000000001",
    details: '{"otpVerified": true, "touchdownAccuracyMeters": 0.4}'
  }
];

export const DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "notif-1",
    title: "Flight Dispatched",
    message: "Drone SKY-001 has taken off with your order #ORD-9021. Live tracking is active.",
    category: "DELIVERY",
    timestamp: "10 mins ago",
    read: false,
    link: "/customer/tracking"
  },
  {
    id: "notif-2",
    title: "Package Delivered",
    message: "Order #ORD-9023 was successfully delivered and verified at 555 Mission St.",
    category: "DELIVERY",
    timestamp: "32 mins ago",
    read: true,
    link: "/customer/orders"
  },
  {
    id: "notif-3",
    title: "Security Notice",
    message: "New login detected from Flight Operations Console (Chrome on macOS).",
    category: "SYSTEM",
    timestamp: "2 hours ago",
    read: true
  }
];

export const DEMO_GEOFENCES = [
  {
    id: "gf-1",
    name: "Embarcadero Restricted Airspace",
    type: "NO_FLY" as const,
    coordinates: [
      { latitude: 37.798, longitude: -122.395 },
      { latitude: 37.802, longitude: -122.398 },
      { latitude: 37.805, longitude: -122.404 },
      { latitude: 37.799, longitude: -122.402 }
    ]
  },
  {
    id: "gf-2",
    name: "Bay Bridge High-Wind Corridor",
    type: "ALTITUDE_RESTRICTION" as const,
    coordinates: [
      { latitude: 37.788, longitude: -122.385 },
      { latitude: 37.792, longitude: -122.388 },
      { latitude: 37.795, longitude: -122.378 },
      { latitude: 37.791, longitude: -122.375 }
    ]
  }
];
