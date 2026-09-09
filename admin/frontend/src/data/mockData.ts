import {
  Drone,
  DroneStatus,
  Order,
  OrderStatus,
  Mission,
  PackageItem,
  FlightRoute,
  GeofenceZone,
  EmergencyAlert,
  Customer,
  Merchant,
  PaymentTransaction,
  MaintenanceRecord,
  SupportTicket,
  AuditLog,
  AdminUser,
  SystemNotification,
} from '../types/skynav';

// Center coordinates: Coimbatore Operations Command Hub (11.0168° N, 76.9558° E)
export const BASE_CENTER = { lat: 11.0168, lng: 76.9558 };

export const DRONE_MODELS = [
  'SKYNAV X1',
  'SKYNAV X2',
  'SKYNAV Cargo',
  'SKYNAV VTOL',
  'SKYNAV Heavy Cargo',
];

// 40 Realistic Drones across Coimbatore Airspace
export const INITIAL_DRONES: Drone[] = Array.from({ length: 40 }).map((_, index) => {
  const num = index + 1;
  const id = `D-${num.toString().padStart(3, '0')}`;
  const model = DRONE_MODELS[index % DRONE_MODELS.length];
  
  // Distribute statuses realistically
  let status: DroneStatus = 'available';
  if (index === 0) status = 'emergency'; // D-001
  else if (index < 14) status = 'in_flight'; // 13 In Flight
  else if (index < 17) status = 'returning'; // 3 Returning
  else if (index < 29) status = 'available'; // 12 Available
  else if (index < 35) status = 'charging'; // 6 Charging
  else if (index < 38) status = 'maintenance'; // 3 Maintenance
  else status = 'offline'; // 2 Offline

  // Offset coords within 8-12km radius around Coimbatore Hub
  const latOffset = (Math.sin(index * 1.7) * 0.045) + (Math.cos(index * 0.9) * 0.025);
  const lngOffset = (Math.cos(index * 1.5) * 0.055) + (Math.sin(index * 0.8) * 0.02);

  const battery = status === 'emergency' ? 7 : status === 'charging' ? 28 + (index * 6) % 55 : 62 + (index * 3) % 36;
  const batteryHealth = 91 + ((index * 7) % 9);

  const payloadCapacity = model === 'SKYNAV Heavy Cargo' ? 15.0 : model === 'SKYNAV Cargo' ? 8.5 : model === 'SKYNAV VTOL' ? 5.0 : model === 'SKYNAV X2' ? 4.5 : 2.5;

  return {
    id,
    name: `SkyNav Fleet Unit ${num}`,
    model,
    serialNumber: `SN-IND-${89000 + index}`,
    registration: `DGCA-REG-${10200 + index}`,
    status,
    battery,
    batteryHealth,
    batteryCycles: 110 + (index * 14) % 240,
    temperature: 31 + (index % 8),
    payloadCapacity,
    currentPayloadWeight: status === 'in_flight' ? +(1.1 + (index % 4) * 0.9).toFixed(1) : 0,
    location: {
      lat: +(BASE_CENTER.lat + latOffset).toFixed(6),
      lng: +(BASE_CENTER.lng + lngOffset).toFixed(6),
      altitude: status === 'in_flight' || status === 'returning' ? 68 + (index * 4) % 45 : 0,
      heading: (index * 45) % 360,
      speed: status === 'in_flight' ? 34 + (index % 18) : status === 'returning' ? 42 : 0,
    },
    distanceTravelledKm: +(140 + index * 23.5).toFixed(1),
    remainingDistanceKm: status === 'in_flight' ? +(1.4 + (index % 5) * 0.7).toFixed(1) : 0,
    signalStrength: status === 'emergency' ? 28 : 92 + (index % 8),
    currentMissionId: (status === 'in_flight' || status === 'returning' || status === 'emergency') ? `MS-${1000 + index}` : undefined,
    lastServiceDate: '2026-08-15',
    nextServiceDate: '2026-09-15',
    issuesCount: status === 'maintenance' ? 2 : status === 'emergency' ? 1 : 0,
  };
});

// Set specific known drones for showcase
const d24 = INITIAL_DRONES.find((d) => d.id === 'D-024');
if (d24) {
  d24.status = 'in_flight';
  d24.battery = 78;
  d24.batteryHealth = 96;
  d24.model = 'SKYNAV X1';
  d24.currentMissionId = 'MS-10284';
  d24.location = { lat: 11.0280, lng: 76.9680, altitude: 82, heading: 42, speed: 34 };
}

const d18 = INITIAL_DRONES.find((d) => d.id === 'D-018');
if (d18) {
  d18.status = 'in_flight';
  d18.battery = 18;
  d18.batteryHealth = 92;
  d18.model = 'SKYNAV X2';
  d18.currentMissionId = 'MS-10281';
  d18.location = { lat: 11.0450, lng: 76.9420, altitude: 64, heading: 180, speed: 28 };
}

const d31 = INITIAL_DRONES.find((d) => d.id === 'D-031');
if (d31) {
  d31.status = 'maintenance';
  d31.battery = 91;
  d31.issuesCount = 2;
  d31.model = 'SKYNAV Cargo';
}

// 15 Indian Merchants in Coimbatore & Tamil Nadu Hub
export const MOCK_MERCHANTS: Merchant[] = [
  { id: 'MCH-101', businessName: 'Apollo Pharma Hub', ownerName: 'Dr. S. K. Narayanan', email: 'dispatch@apollopharmacbe.com', phone: '+91 98422 10921', category: 'Medical & Pharma', status: 'Approved', successRate: 99.6, totalOrders: 420, revenue: 845000, address: 'Trichy Road, Ramanathapuram, Coimbatore', coords: { lat: 11.0025, lng: 76.9890 } },
  { id: 'MCH-102', businessName: 'Sri Krishna Sweets Express', ownerName: 'Murali Krishnan', email: 'orders@srikrishnasweets.com', phone: '+91 98422 34812', category: 'Food & Beverage', status: 'Approved', successRate: 98.8, totalOrders: 680, revenue: 340000, address: 'Cross Cut Road, Gandhipuram, Coimbatore', coords: { lat: 11.0180, lng: 76.9640 } },
  { id: 'MCH-103', businessName: 'TechPro Electronics & Hardware', ownerName: 'Karthik Subramanian', email: 'sales@techproindia.com', phone: '+91 98422 89011', category: 'Electronics & Hardware', status: 'Approved', successRate: 98.2, totalOrders: 310, revenue: 1120000, address: '100 Feet Road, Tatabad, Coimbatore', coords: { lat: 11.0240, lng: 76.9610 } },
  { id: 'MCH-104', businessName: 'PSG Tech Bio-Research Lab', ownerName: 'Dr. Radhakrishnan', email: 'lab@psgtech.edu', phone: '+91 98422 77610', category: 'Medical & Pharma', status: 'Approved', successRate: 100.0, totalOrders: 195, revenue: 1450000, address: 'Avinashi Road, Peelamedu, Coimbatore', coords: { lat: 11.0260, lng: 77.0020 } },
  { id: 'MCH-105', businessName: 'Kongu Organic Agro Farm', ownerName: 'Palanisamy Gounder', email: 'info@konguorganics.in', phone: '+91 98422 55432', category: 'Groceries', status: 'Approved', successRate: 97.4, totalOrders: 540, revenue: 410000, address: 'Siruvani Main Road, Perur, Coimbatore', coords: { lat: 10.9750, lng: 76.9180 } },
  { id: 'MCH-106', businessName: 'Annapoorna Gourmet Kitchen', ownerName: 'Venkatesh Prasad', email: 'contact@annapoornagourmet.com', phone: '+91 98422 66789', category: 'Food & Beverage', status: 'Approved', successRate: 99.1, totalOrders: 820, revenue: 580000, address: 'East Arokiasamy Road, RS Puram, Coimbatore', coords: { lat: 11.0080, lng: 76.9450 } },
  { id: 'MCH-107', businessName: 'Kovai Industrial Components', ownerName: 'Ramesh Sundaram', email: 'supplies@kovaiind.com', phone: '+91 98422 44321', category: 'Industrial Supplies', status: 'Approved', successRate: 96.5, totalOrders: 115, revenue: 890000, address: 'SIDCO Industrial Estate, Kurichi, Coimbatore', coords: { lat: 10.9420, lng: 76.9740 } },
  { id: 'MCH-108', businessName: 'Ganga Hospital Emergency Blood Bank', ownerName: 'Dr. S. Raja Sabapathy', email: 'emergency@gangahospital.org', phone: '+91 98422 99001', category: 'Medical & Pharma', status: 'Approved', successRate: 100.0, totalOrders: 210, revenue: 1850000, address: '313 Mettupalayam Road, Coimbatore', coords: { lat: 11.0320, lng: 76.9510 } },
  { id: 'MCH-109', businessName: 'Fastrack Rapid Courier Hub', ownerName: 'Anand Kumar', email: 'dispatch@fastrackcbe.in', phone: '+91 98422 12345', category: 'Logistics', status: 'Approved', successRate: 98.7, totalOrders: 940, revenue: 980000, address: 'Hope College, Avinashi Road, Coimbatore', coords: { lat: 11.0340, lng: 77.0180 } },
  { id: 'MCH-110', businessName: 'Kovai Fresh Floral Boutique', ownerName: 'Revathi Sridhar', email: 'orders@kovaiflora.com', phone: '+91 98422 87654', category: 'Retail Gifts', status: 'Approved', successRate: 99.3, totalOrders: 320, revenue: 260000, address: 'DB Road, RS Puram, Coimbatore', coords: { lat: 11.0110, lng: 76.9480 } },
  { id: 'MCH-111', businessName: 'Titan Micro-Precision Tools', ownerName: 'Ganesh Moorthy', email: 'orders@titanmicro.in', phone: '+91 98422 34567', category: 'Industrial Supplies', status: 'Approved', successRate: 98.4, totalOrders: 88, revenue: 760000, address: 'Thudiyalur Road, Saravanampatti, Coimbatore', coords: { lat: 11.0780, lng: 76.9940 } },
  { id: 'MCH-112', businessName: 'MedPlus Specialty Diagnostics', ownerName: 'Dr. K. Swaminathan', email: 'diagnostics@medpluscbe.com', phone: '+91 98422 98765', category: 'Medical & Pharma', status: 'Approved', successRate: 99.0, totalOrders: 275, revenue: 920000, address: 'Sathy Road, Ganapathy, Coimbatore', coords: { lat: 11.0410, lng: 76.9820 } },
  { id: 'MCH-113', businessName: 'Cafe Coffee Day Express Hub', ownerName: 'Pradeep Shenoy', email: 'ccd@expresshub.com', phone: '+91 98422 65432', category: 'Food & Beverage', status: 'Approved', successRate: 98.0, totalOrders: 610, revenue: 290000, address: 'Race Course Road, Coimbatore', coords: { lat: 11.0010, lng: 76.9710 } },
  { id: 'MCH-114', businessName: 'Skyline Robotics Research Depot', ownerName: 'Hariharan Natarajan', email: 'research@skylinerobotics.in', phone: '+91 98422 78901', category: 'Industrial Supplies', status: 'Approved', successRate: 97.5, totalOrders: 65, revenue: 640000, address: 'Tidel Park, Avinashi Road, Coimbatore', coords: { lat: 11.0280, lng: 77.0310 } },
  { id: 'MCH-115', businessName: 'Nilgiri Fresh Tea & Spices', ownerName: 'Mathew Thomas', email: 'sales@nilgiriteaspice.in', phone: '+91 98422 23456', category: 'Groceries', status: 'Approved', successRate: 98.9, totalOrders: 430, revenue: 380000, address: 'Oppanakara Street, Town Hall, Coimbatore', coords: { lat: 10.9960, lng: 76.9600 } },
];

// 50 Indian Customers
export const MOCK_CUSTOMERS: Customer[] = Array.from({ length: 50 }).map((_, index) => {
  const id = `CUST-${(1001 + index)}`;
  const firstNames = ['Rahul', 'Priya', 'Arvind', 'Ananya', 'Vikram', 'Deepa', 'Karthik', 'Meera', 'Suresh', 'Sneha', 'Manoj', 'Divya', 'Rajesh', 'Pooja', 'Sanjay', 'Kavitha', 'Ashwin', 'Nithya', 'Gautam', 'Lakshmi'];
  const lastNames = ['Kumar', 'Sharma', 'Sundaram', 'Iyer', 'Nair', 'Krishnan', 'Rajan', 'Balaji', 'Swamy', 'Menon', 'Patel', 'Reddy', 'Gounder', 'Natarajan', 'Subramanian', 'Chettiar', 'Venkatesh'];
  
  const name = `${firstNames[index % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`;
  const localities = ['Peelamedu', 'RS Puram', 'Gandhipuram', 'Saravanampatti', 'Saibaba Colony', 'Singanallur', 'Race Course', 'Vadavalli', 'Ramanathapuram', 'Ganapathy', 'Kovaipudur'];
  const locality = localities[index % localities.length];
  
  return {
    id,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}${index + 10}@gmail.com`,
    phone: `+91 9${(840000000 + index * 31471).toString().slice(0, 9)}`,
    avatar: `https://images.unsplash.com/photo-${1534528741775 + index}?auto=format&fit=crop&w=150&q=80`,
    status: index === 3 ? 'Suspended' : 'Active',
    totalOrders: 6 + (index * 7) % 38,
    successfulDeliveries: 5 + (index * 7) % 36,
    joinedDate: '2026-03-12',
    defaultAddress: `Flat ${101 + (index % 40)}, Tower ${(index % 4) + 1}, Green Meadows, ${locality}, Coimbatore`,
    defaultCoords: {
      lat: +(BASE_CENTER.lat + (Math.sin(index * 1.3) * 0.04)).toFixed(6),
      lng: +(BASE_CENTER.lng + (Math.cos(index * 1.1) * 0.04)).toFixed(6),
    },
  };
});

// 100 Realistic Logistics Orders
export const INITIAL_ORDERS: Order[] = Array.from({ length: 100 }).map((_, index) => {
  const num = 10200 + index;
  const id = `ORD-${num}`;
  const merchant = MOCK_MERCHANTS[index % MOCK_MERCHANTS.length];
  const customer = MOCK_CUSTOMERS[index % MOCK_CUSTOMERS.length];
  
  let status: OrderStatus = 'delivered';
  if (index === 0) status = 'in_transit'; // ORD-10284 active mission
  else if (index < 8) status = 'in_transit';
  else if (index < 12) status = 'drone_assigned';
  else if (index < 18) status = 'pending';
  else if (index < 92) status = 'delivered';
  else if (index < 96) status = 'cancelled';
  else status = 'failed';

  const isD24Order = id === 'ORD-10284' || index === 0;
  const droneId = isD24Order ? 'D-024' : (status === 'in_transit' || status === 'drone_assigned' || status === 'delivered') ? INITIAL_DRONES[index % 30].id : undefined;
  const missionId = droneId ? `MS-${1000 + index}` : undefined;

  const packageWeights = [0.8, 1.4, 2.2, 3.5, 4.8, 0.5, 1.9, 5.5];
  const weight = packageWeights[index % packageWeights.length];
  
  const packageItems = [
    'Critical Emergency Insulin Vials (Cold Chain)',
    'Organic Mysore Pak Gift Assortment',
    'Robotics Microcontroller & LiDAR Sensor Kit',
    'Blood Platelet Units for Urgent Transfusion',
    'Specialty Filter Coffee Roasts & Spices',
    'Emergency Surgical Sutures & Gauze',
    'Precision Titanium Fasteners Pack',
    'Artisanal Sourdough Bakes & Confections',
  ];

  return {
    id,
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    merchantId: merchant.id,
    merchantName: merchant.businessName,
    packageId: `PKG-${num}`,
    packageName: packageItems[index % packageItems.length],
    packageWeightKg: weight,
    packageDimensions: '24 x 18 x 12 cm',
    pickupAddress: merchant.address,
    pickupCoords: merchant.coords,
    destinationAddress: customer.defaultAddress,
    destinationCoords: customer.defaultCoords,
    droneId,
    missionId,
    paymentStatus: status === 'failed' ? 'refunded' : 'successful',
    paymentAmount: +(250 + (index * 45) % 1200),
    status,
    createdAt: '2026-08-31T09:15:00Z',
    updatedAt: '2026-08-31T09:20:00Z',
    timestamps: {
      created: '09:15',
      confirmed: '09:18',
      droneAssigned: '09:22',
      inTransit: '09:25',
      delivered: status === 'delivered' ? '09:38' : undefined,
    },
  };
});

// Link ORD-10284 specifically for D-024 showcase
const ord24 = INITIAL_ORDERS.find((o) => o.id === 'ORD-10284') || INITIAL_ORDERS[0];
ord24.id = 'ORD-10284';
ord24.customerName = 'Rahul Kumar';
ord24.packageName = 'Emergency Cardiology Medical Kit';
ord24.pickupAddress = 'Coimbatore Operations Hub (Peelamedu Tech Park)';
ord24.pickupCoords = { lat: 11.0260, lng: 77.0020 };
ord24.destinationAddress = 'Customer Delivery Point, RS Puram, Coimbatore';
ord24.destinationCoords = { lat: 11.0080, lng: 76.9450 };
ord24.status = 'in_transit';
ord24.droneId = 'D-024';
ord24.missionId = 'MS-10284';

// Active & Historical Missions
export const INITIAL_MISSIONS: Mission[] = INITIAL_ORDERS
  .filter((o) => o.droneId && (o.status === 'in_transit' || o.status === 'drone_assigned' || o.status === 'delivered' || o.status === 'failed'))
  .slice(0, 50)
  .map((order, index) => {
    const missionId = order.missionId || `MS-${1000 + index}`;
    const drone = INITIAL_DRONES.find((d) => d.id === order.droneId) || INITIAL_DRONES[0];
    
    // Create planned route points between pickup and destination
    const pointsCount = 10;
    const plannedRoute = Array.from({ length: pointsCount }).map((_, i) => {
      const ratio = i / (pointsCount - 1);
      return {
        lat: +(order.pickupCoords.lat + (order.destinationCoords.lat - order.pickupCoords.lat) * ratio).toFixed(6),
        lng: +(order.pickupCoords.lng + (order.destinationCoords.lng - order.pickupCoords.lng) * ratio).toFixed(6),
        altitude: 65 + Math.sin(ratio * Math.PI) * 25,
      };
    });

    const isEmergency = drone.status === 'emergency';
    const isD24 = drone.id === 'D-024';

    // Simulated actual route points (with deliberate deviation on D-024)
    const actualRoute = plannedRoute.slice(0, 6).map((pt, i) => {
      if (isD24 && i >= 4) {
        return {
          ...pt,
          lat: +(pt.lat + 0.0032).toFixed(6),
          lng: +(pt.lng + 0.0028).toFixed(6),
        };
      }
      return pt;
    });

    return {
      id: missionId,
      orderId: order.id,
      droneId: drone.id,
      pickupAddress: order.pickupAddress,
      pickupCoords: order.pickupCoords,
      destinationAddress: order.destinationAddress,
      destinationCoords: order.destinationCoords,
      plannedRoute,
      actualRoute,
      distanceKm: 8.4,
      estimatedDurationMinutes: 14,
      currentStatus: isEmergency ? 'emergency' : order.status === 'delivered' ? 'completed' : 'in_flight',
      batteryAtStart: 98,
      currentBattery: drone.battery,
      currentSpeedKmH: drone.location.speed || 34,
      currentAltitudeM: drone.location.altitude || 82,
      etaSeconds: isEmergency ? 0 : 402, // 06:42
      createdAt: '2026-08-31T08:22:00Z',
      startTime: '2026-08-31T08:30:00Z',
      completionTime: order.status === 'delivered' ? '2026-08-31T08:48:00Z' : undefined,
    };
  });

// Geofence Zones in Coimbatore Airspace
export const INITIAL_GEOFENCES: GeofenceZone[] = [
  {
    id: 'GEO-01',
    name: 'Coimbatore Urban Air Corridor (Primary)',
    type: 'delivery',
    coordinates: [
      [11.045, 76.925],
      [11.045, 77.035],
      [10.985, 77.035],
      [10.985, 76.925],
    ],
    boundsRadiusMeters: 4500,
    active: true,
    maxAltitudeMeters: 120,
    description: 'Designated high-speed autonomous air corridor connecting Peelamedu, Gandhipuram, and RS Puram Hubs.',
  },
  {
    id: 'GEO-02',
    name: 'Coimbatore International Airport (CJB) Airspace',
    type: 'nofly',
    coordinates: [
      [11.040, 77.030],
      [11.040, 77.070],
      [11.010, 77.070],
      [11.010, 77.030],
    ],
    boundsRadiusMeters: 3000,
    active: true,
    maxAltitudeMeters: 0,
    description: 'STRICT DGCA NO-FLY AIRSPACE: Commercial aircraft runway approach vectors.',
  },
  {
    id: 'GEO-03',
    name: 'VOC Park & Stadium Event Airspace',
    type: 'caution',
    coordinates: [
      [11.020, 76.965],
      [11.020, 76.980],
      [11.008, 76.980],
      [11.008, 76.965],
    ],
    boundsRadiusMeters: 1500,
    active: true,
    maxAltitudeMeters: 70,
    description: 'Caution Zone: High civilian density. Maintain 25 km/h transit velocity.',
  },
  {
    id: 'GEO-04',
    name: 'Peelamedu Tech Park Express Zone',
    type: 'delivery',
    coordinates: [
      [11.035, 76.995],
      [11.035, 77.030],
      [11.015, 77.030],
      [11.015, 76.995],
    ],
    boundsRadiusMeters: 2500,
    active: true,
    maxAltitudeMeters: 120,
    description: 'Approved Autonomous Tech Corridor for rapid campus drop-offs.',
  },
];

// Active Emergency Alerts
export const INITIAL_EMERGENCIES: EmergencyAlert[] = [
  {
    id: 'EMG-101',
    droneId: 'D-001',
    missionId: 'MS-1001',
    issueType: 'Critical Battery',
    priority: 'Critical',
    timestamp: '2026-08-31 09:28:14 UTC',
    batteryLevel: 7,
    gpsStatus: 'Available',
    signalStatus: 'Weak',
    recommendedAction: 'Execute Immediate Return To Home (RTH) or Safe Descent',
    status: 'active',
  },
  {
    id: 'EMG-102',
    droneId: 'D-024',
    missionId: 'MS-10284',
    issueType: 'Route Deviation',
    priority: 'High',
    timestamp: '2026-08-31 09:30:22 UTC',
    batteryLevel: 78,
    gpsStatus: 'Available',
    signalStatus: 'Strong',
    recommendedAction: 'Re-align Autopilot Corridor or Trigger Emergency Hold',
    status: 'active',
  },
];

// System Notifications
export const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  { id: 'NOTIF-01', title: 'Route Deviation Detected', message: 'Drone D-024 deviated 320m from approved flight corridor MS-10284.', category: 'critical', timestamp: '2 mins ago', read: false },
  { id: 'NOTIF-02', title: 'Critical Battery Warning', message: 'Drone D-018 battery dropped to 18% during transit.', category: 'warning', timestamp: '5 mins ago', read: false },
  { id: 'NOTIF-03', title: 'Mission Completed Successfully', message: 'Order ORD-10280 delivered in 11.4 minutes via D-012.', category: 'info', timestamp: '12 mins ago', read: false },
  { id: 'NOTIF-04', title: 'Maintenance Due', message: 'Drone D-031 flight hours exceeded 250h threshold. Service required.', category: 'warning', timestamp: '1 hour ago', read: true },
  { id: 'NOTIF-05', title: 'Payment Batch Settled', message: 'Razorpay UPI payout of ₹1,48,200 settled to merchants.', category: 'info', timestamp: '3 hours ago', read: true },
];

// Maintenance Records
export const INITIAL_MAINTENANCE: MaintenanceRecord[] = [
  { id: 'MNT-101', droneId: 'D-031', issue: 'Firmware & ESC Calibration', priority: 'High', scheduledDate: '2026-09-02', reportedDate: '2026-08-30', technician: 'Suresh Kumar', status: 'Overdue', notes: 'Motor #3 vibration detected during high-altitude telemetry sweep.' },
  { id: 'MNT-102', droneId: 'D-032', issue: 'Battery Cycle Rejuvenation', priority: 'Medium', scheduledDate: '2026-09-04', reportedDate: '2026-08-31', technician: 'Anand Balaji', status: 'Scheduled', notes: 'Cycle count 248. Cell balance check required.' },
  { id: 'MNT-103', droneId: 'D-033', issue: 'LiDAR Optical Lens Replacement', priority: 'High', scheduledDate: '2026-09-01', reportedDate: '2026-08-29', technician: 'Suresh Kumar', status: 'Under Maintenance', notes: 'Minor scratch detected on obstacle avoidance housing.' },
];

// Support Tickets
export const INITIAL_TICKETS: SupportTicket[] = [
  { id: 'TCK-201', customerId: 'CUST-1001', customerName: 'Rahul Kumar', orderId: 'ORD-10284', issue: 'Customer delivery point pin mismatch', priority: 'High', status: 'Open', createdAt: '2026-08-31 09:20:00', assignedAdmin: 'Rajesh Sharma', messages: [] },
  { id: 'TCK-202', customerId: 'MCH-101', customerName: 'Apex Medical Supplies', orderId: 'ORD-10260', issue: 'Merchant payout query for UPI settlement', priority: 'Medium', status: 'In Progress', createdAt: '2026-08-31 08:45:00', assignedAdmin: 'Rajesh Sharma', messages: [] },
];

// Audit Logs
export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: 'LOG-501', timestamp: '2026-08-31 09:29:12', adminName: 'Rajesh Sharma', adminRole: 'Super Admin', action: 'Emergency RTH Override Executed', entity: 'Drone', entityId: 'D-001', severity: 'Critical', details: 'Triggered emergency RTH for low battery' },
  { id: 'LOG-502', timestamp: '2026-08-31 09:15:30', adminName: 'Rajesh Sharma', adminRole: 'Super Admin', action: 'Geofence Boundary Modified', entity: 'Geofence', entityId: 'GEO-04', severity: 'Warning', details: 'Updated Peelamedu tech zone boundaries' },
  { id: 'LOG-503', timestamp: '2026-08-31 08:30:00', adminName: 'Autopilot AI', adminRole: 'System', action: 'Automated Fleet Dispatch', entity: 'Mission', entityId: 'MS-10284', severity: 'Info', details: 'Dispatched automated route corridor' },
];

// Admin Users (Enterprise Multi-Role Team)
export const INITIAL_ADMINS: AdminUser[] = [
  {
    id: 'ADM-01',
    name: 'Rajesh Sharma',
    email: 'admin@skynav.com',
    phone: '+91 98401 22910',
    role: 'super_admin',
    status: 'Active',
    lastLogin: 'Today, 09:42 IST',
    permissions: ['*'],
  },
  {
    id: 'ADM-02',
    name: 'Arjun Kumar',
    email: 'operations@skynav.com',
    phone: '+91 98402 33811',
    role: 'ops_admin',
    status: 'Active',
    lastLogin: 'Today, 09:15 IST',
    permissions: ['dashboard', 'operations', 'orders', 'missions', 'packages', 'routes', 'customers', 'reports', 'support', 'notifications'],
  },
  {
    id: 'ADM-03',
    name: 'Ananya Menon',
    email: 'fleet@skynav.com',
    phone: '+91 98403 44712',
    role: 'fleet_manager',
    status: 'Active',
    lastLogin: 'Today, 08:30 IST',
    permissions: ['dashboard', 'fleet', 'battery-health', 'maintenance', 'operations', 'emergency', 'notifications'],
  },
  {
    id: 'ADM-04',
    name: 'Vikram Iyer',
    email: 'dispatch@skynav.com',
    phone: '+91 98404 55613',
    role: 'dispatch_manager',
    status: 'Active',
    lastLogin: 'Today, 07:55 IST',
    permissions: ['dashboard', 'orders', 'missions', 'packages', 'routes', 'operations', 'emergency', 'notifications'],
  },
  {
    id: 'ADM-05',
    name: 'Deepa Krishnan',
    email: 'support@skynav.com',
    phone: '+91 98405 66514',
    role: 'support_admin',
    status: 'Active',
    lastLogin: 'Yesterday, 18:20 IST',
    permissions: ['customers', 'orders', 'support', 'notifications'],
  },
  {
    id: 'ADM-06',
    name: 'Meera Patel',
    email: 'analytics@skynav.com',
    phone: '+91 98406 77415',
    role: 'analytics_admin',
    status: 'Active',
    lastLogin: 'Yesterday, 16:40 IST',
    permissions: ['dashboard', 'analytics', 'reports', 'payments', 'notifications'],
  },
];

// Payments
export const MOCK_PAYMENTS: PaymentTransaction[] = Array.from({ length: 40 }).map((_, index) => ({
  id: `TXN-${9000 + index}`,
  orderId: `ORD-${10200 + index}`,
  customerName: MOCK_CUSTOMERS[index % MOCK_CUSTOMERS.length].name,
  amount: +(350 + (index * 65) % 1800),
  paymentMethod: index % 3 === 0 ? 'Google Pay' : index % 3 === 1 ? 'Credit Card' : 'Corporate Account',
  status: index % 18 === 0 ? 'Failed' : index % 25 === 0 ? 'Refunded' : 'Successful',
  timestamp: '2026-08-31 09:12:00',
}));
