import {
  Drone,
  Order,
  Mission,
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

import {
  INITIAL_DRONES,
  INITIAL_ORDERS,
  INITIAL_MISSIONS,
  INITIAL_GEOFENCES,
  INITIAL_EMERGENCIES,
  INITIAL_NOTIFICATIONS,
  INITIAL_MAINTENANCE,
  INITIAL_TICKETS,
  INITIAL_AUDIT_LOGS,
  INITIAL_ADMINS,
  MOCK_MERCHANTS,
  MOCK_CUSTOMERS,
  MOCK_PAYMENTS,
  BASE_CENTER,
} from '../data/mockData';

class MockDataStore {
  private drones: Drone[] = [...INITIAL_DRONES];
  private orders: Order[] = [...INITIAL_ORDERS];
  private missions: Mission[] = [...INITIAL_MISSIONS];
  private geofences: GeofenceZone[] = [...INITIAL_GEOFENCES];
  private emergencies: EmergencyAlert[] = [...INITIAL_EMERGENCIES];
  private notifications: SystemNotification[] = [...INITIAL_NOTIFICATIONS];
  private maintenance: MaintenanceRecord[] = [...INITIAL_MAINTENANCE];
  private tickets: SupportTicket[] = [...INITIAL_TICKETS];
  private auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
  private admins: AdminUser[] = [...INITIAL_ADMINS];
  private merchants: Merchant[] = [...MOCK_MERCHANTS];
  private customers: Customer[] = [...MOCK_CUSTOMERS];
  private payments: PaymentTransaction[] = [...MOCK_PAYMENTS];
  
  private listeners: Set<() => void> = new Set();
  private simulationInterval: number | null = null;

  constructor() {
    this.startSimulation();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  // Simulation engine - ticks every 3 seconds to move active drones along realistic flight paths
  private startSimulation() {
    if (typeof window === 'undefined') return;
    this.simulationInterval = window.setInterval(() => {
      this.tickSimulation();
    }, 3000);
  }

  private tickSimulation() {
    let stateChanged = false;

    this.drones = this.drones.map((drone) => {
      if (drone.status === 'in_flight' || drone.status === 'returning' || drone.status === 'emergency') {
        stateChanged = true;
        // Battery decrement
        const batteryDec = drone.status === 'emergency' ? 0.2 : 0.3;
        const newBattery = Math.max(1, +(drone.battery - batteryDec).toFixed(1));

        // Smooth coordinate movement
        const headingRad = ((drone.location.heading || 0) * Math.PI) / 180;
        const speedFactor = 0.00015;
        const latDelta = Math.cos(headingRad) * speedFactor + (Math.random() - 0.5) * 0.0001;
        const lngDelta = Math.sin(headingRad) * speedFactor + (Math.random() - 0.5) * 0.0001;

        const newLat = +(drone.location.lat + latDelta).toFixed(6);
        const newLng = +(drone.location.lng + lngDelta).toFixed(6);
        const newAlt = drone.status === 'emergency' ? Math.max(10, (drone.location.altitude || 50) - 2) : 65 + Math.floor(Math.random() * 8);

        // Check if critical battery emergency needs to be raised
        if (newBattery <= 10 && drone.status !== 'emergency') {
          this.triggerEmergency(drone.id, 'Critical Battery', `Drone ${drone.id} battery fell below 10% safety threshold!`);
        }

        return {
          ...drone,
          battery: newBattery,
          location: {
            ...drone.location,
            lat: newLat,
            lng: newLng,
            altitude: newAlt,
            speed: drone.status === 'emergency' ? 18 : 34 + Math.floor(Math.random() * 6),
          },
          distanceTravelledKm: +(drone.distanceTravelledKm + 0.05).toFixed(2),
          remainingDistanceKm: Math.max(0, +(drone.remainingDistanceKm - 0.05).toFixed(2)),
        };
      } else if (drone.status === 'charging') {
        if (drone.battery < 100) {
          stateChanged = true;
          return {
            ...drone,
            battery: Math.min(100, +(drone.battery + 2.0).toFixed(1)),
          };
        }
      }
      return drone;
    });

    if (stateChanged) {
      this.notify();
    }
  }

  // Getters
  public getDrones() { return this.drones; }
  public getOrders() { return this.orders; }
  public getMissions() { return this.missions; }
  public getGeofences() { return this.geofences; }
  public getEmergencies() { return this.emergencies; }
  public getNotifications() { return this.notifications; }
  public getMaintenance() { return this.maintenance; }
  public getTickets() { return this.tickets; }
  public getAuditLogs() { return this.auditLogs; }
  public getAdmins() { return this.admins; }
  public getMerchants() { return this.merchants; }
  public getCustomers() { return this.customers; }
  public getPayments() { return this.payments; }

  // Smart Drone Recommendation Engine (Section 37)
  public getRecommendedDrone(order: Order) {
    const available = this.drones.filter((d) => d.status === 'available');
    if (available.length === 0) {
      return {
        drone: this.drones[0],
        score: 75,
        reasons: ['Highest available battery', 'Payload verified'],
      };
    }

    // Rank by: Battery (40%), Capacity >= Weight (30%), Battery Health (20%), Issues Count (10%)
    const scored = available.map((d) => {
      let score = (d.battery / 100) * 40;
      score += (d.payloadCapacity >= (order.packageWeightKg || 1) ? 30 : 0);
      score += (d.batteryHealth / 100) * 20;
      score += (d.issuesCount === 0 ? 10 : 0);
      return { drone: d, score: Math.round(score) };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];

    const reasons = [
      `Highest battery level (${top.drone.battery}%)`,
      `Optimal payload capacity (${top.drone.payloadCapacity} kg vs ${order.packageWeightKg} kg)`,
      `Excellent health rating (${top.drone.batteryHealth}%)`,
      'Ready for immediate autonomous dispatch',
    ];

    return {
      drone: top.drone,
      score: top.score,
      reasons,
    };
  }

  // Actions
  public assignDroneToOrder(orderId: string, droneId: string) {
    const order = this.orders.find((o) => o.id === orderId);
    const drone = this.drones.find((d) => d.id === droneId);

    if (!order || !drone) return;

    const missionId = `MS-${Math.floor(10000 + Math.random() * 9000)}`;
    const newMission: Mission = {
      id: missionId,
      orderId: order.id,
      droneId: drone.id,
      pickupAddress: order.pickupAddress,
      pickupCoords: order.pickupCoords,
      destinationAddress: order.destinationAddress,
      destinationCoords: order.destinationCoords,
      plannedRoute: [
        order.pickupCoords,
        { lat: +(order.pickupCoords.lat + (order.destinationCoords.lat - order.pickupCoords.lat) * 0.5).toFixed(6), lng: +(order.pickupCoords.lng + (order.destinationCoords.lng - order.pickupCoords.lng) * 0.5).toFixed(6), altitude: 75 },
        order.destinationCoords,
      ],
      actualRoute: [order.pickupCoords],
      distanceKm: 5.4,
      estimatedDurationMinutes: 12,
      currentStatus: 'in_flight',
      batteryAtStart: drone.battery,
      currentBattery: drone.battery,
      currentSpeedKmH: 42,
      currentAltitudeM: 75,
      etaSeconds: 520,
      createdAt: new Date().toISOString(),
      startTime: new Date().toISOString(),
    };

    // Update order
    order.droneId = drone.id;
    order.missionId = missionId;
    order.status = 'in_transit';

    // Update drone
    drone.status = 'in_flight';
    drone.currentMissionId = missionId;

    this.missions.unshift(newMission);
    this.addAuditLog('Rajesh Sharma', 'Super Admin', 'ASSIGN_DRONE', 'Order', order.id, 'Info', `Assigned Drone ${drone.id} to Order ${order.id}`);
    this.addNotification(`Drone ${drone.id} assigned to Order ${order.id}`, 'info');
    this.notify();
  }

  public triggerEmergency(droneId: string, issueType: EmergencyAlert['issueType'], message: string) {
    const drone = this.drones.find((d) => d.id === droneId);
    if (drone) {
      drone.status = 'emergency';
    }

    const alertId = `EMG-${Math.floor(800 + Math.random() * 100)}`;
    const newAlert: EmergencyAlert = {
      id: alertId,
      droneId,
      issueType,
      priority: 'Critical',
      batteryLevel: drone ? drone.battery : 7,
      gpsStatus: 'Available',
      signalStatus: 'Weak',
      timestamp: 'Just now',
      status: 'active',
      recommendedAction: 'Immediate Return To Home (RTH) or Safe Descent Landing.',
    };

    this.emergencies.unshift(newAlert);
    this.addNotification(`CRITICAL EMERGENCY: Drone ${droneId} - ${issueType}`, 'critical');
    this.addAuditLog('System', 'Autopilot AI', 'EMERGENCY_TRIGGERED', 'Drone', droneId, 'Critical', message);
    this.notify();
  }

  public executeEmergencyCommand(droneId: string, command: 'RTH' | 'LAND' | 'PAUSE' | 'CANCEL') {
    const drone = this.drones.find((d) => d.id === droneId);
    if (!drone) return;

    if (command === 'RTH') {
      drone.status = 'returning';
      this.addNotification(`Return-To-Home initiated for Drone ${drone.id}`, 'warning');
      this.addAuditLog('Rajesh Sharma', 'Super Admin', 'EMERGENCY_RTH', 'Drone', drone.id, 'Warning', `Commanded RTH for ${drone.id}`);
    } else if (command === 'LAND') {
      drone.status = 'offline';
      if (drone.location) drone.location.altitude = 0;
      this.addNotification(`Emergency Forced Landing executed for Drone ${drone.id}`, 'critical');
      this.addAuditLog('Rajesh Sharma', 'Super Admin', 'FORCED_LANDING', 'Drone', drone.id, 'Critical', `Executed forced landing for ${drone.id}`);
    } else if (command === 'PAUSE') {
      if (drone.location) drone.location.speed = 0;
      this.addNotification(`Mission flight paused for Drone ${drone.id}`, 'info');
    } else if (command === 'CANCEL') {
      drone.status = 'available';
      drone.currentMissionId = undefined;
      this.addNotification(`Mission cancelled for Drone ${drone.id}. Returning to base.`, 'info');
    }

    // Resolve associated active emergency if any
    const emergency = this.emergencies.find((e) => e.droneId === droneId && e.status === 'active');
    if (emergency) {
      emergency.status = 'resolved';
    }

    this.notify();
  }

  public addNotification(title: string, category: SystemNotification['category']) {
    this.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      title,
      message: title,
      category,
      timestamp: 'Just now',
      read: false,
    });
  }

  public markNotificationRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) notif.read = true;
    this.notify();
  }

  public markAllNotificationsRead() {
    this.notifications.forEach((n) => (n.read = true));
    this.notify();
  }

  public addAuditLog(adminName: string, adminRole: string, action: string, entity: string, entityId: string, severity: 'Info' | 'Warning' | 'Critical', details: string) {
    this.auditLogs.unshift({
      id: `LOG-${Math.floor(750 + Math.random() * 500)}`,
      timestamp: new Date().toLocaleTimeString(),
      adminName,
      adminRole,
      action,
      entity,
      entityId,
      severity,
      details,
    });
  }

  public updateMerchantStatus(merchantId: string, status: Merchant['status']) {
    const m = this.merchants.find((mer) => mer.id === merchantId);
    if (m) {
      m.status = status;
      this.addAuditLog('Rajesh Sharma', 'Super Admin', 'UPDATE_STATUS', 'Merchants', merchantId, 'Info', `Set merchant status to ${status}`);
      this.notify();
    }
  }

  public addDrone(newDrone: Partial<Drone>) {
    const id = `D-${(this.drones.length + 1).toString().padStart(3, '0')}`;
    const drone: Drone = {
      id,
      name: newDrone.name || `SkyNav Fleet Unit ${this.drones.length + 1}`,
      model: newDrone.model || 'SKYNAV X1',
      serialNumber: `SN-IND-${90000 + this.drones.length}`,
      registration: `DGCA-REG-${11000 + this.drones.length}`,
      status: 'available',
      battery: 100,
      batteryHealth: 100,
      batteryCycles: 0,
      temperature: 29,
      payloadCapacity: newDrone.payloadCapacity || 5.0,
      currentPayloadWeight: 0,
      location: { lat: BASE_CENTER.lat, lng: BASE_CENTER.lng, altitude: 0, heading: 0, speed: 0 },
      distanceTravelledKm: 0,
      remainingDistanceKm: 0,
      signalStrength: 100,
      lastServiceDate: new Date().toISOString().split('T')[0],
      nextServiceDate: '2026-10-01',
      issuesCount: 0,
    };
    this.drones.push(drone);
    this.addAuditLog('Rajesh Sharma', 'Super Admin', 'ADD_DRONE', 'Fleet', id, 'Info', `Added new drone ${id}`);
    this.notify();
  }

  public addGeofence(geofence: Omit<GeofenceZone, 'id'>) {
    const id = `GEO-${(this.geofences.length + 1).toString().padStart(2, '0')}`;
    this.geofences.push({ id, ...geofence });
    this.addAuditLog('Rajesh Sharma', 'Super Admin', 'CREATE_GEOFENCE', 'Geofencing', id, 'Warning', `Created geofence zone ${geofence.name}`);
    this.notify();
  }
}

export const mockStore = new MockDataStore();
