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
  private ws: WebSocket | null = null;
  private pollInterval: number | null = null;

  constructor() {
    this.initDataConnection();
  }

  private async initDataConnection() {
    // Initial fetch from real Admin Backend
    await this.fetchOperationalData();

    // Connect to live Admin WebSocket
    this.connectWebSocket();

    // Setup fallback background sync
    if (typeof window !== 'undefined') {
      this.pollInterval = window.setInterval(() => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.fetchOperationalData();
        }
      }, 3500);
    }
  }

  public async fetchOperationalData() {
    try {
      // 1. Fetch real orders from Admin Backend
      const ordersRes = await fetch('/api/admin/orders');
      if (ordersRes.ok) {
        const rawOrders = await ordersRes.json();
        if (Array.isArray(rawOrders) && rawOrders.length > 0) {
          this.orders = rawOrders.map((o: any) => ({
            id: o.id,
            customerId: o.customerOrderId || 'C-1001',
            customerName: o.customerName || 'Customer',
            customerEmail: 'customer@skynav.com',
            merchantId: 'M-01',
            merchantName: o.merchantName || 'SkyNav Central Hub',
            packageId: `PKG-${o.id}`,
            packageName: o.packageName || 'Package Pod',
            packageWeightKg: o.packageWeightKg || 1.2,
            packageDimensions: '25x20x15 cm',
            pickupAddress: o.pickupAddress || 'SkyNav Hub #1',
            pickupCoords: o.pickupCoords || { lat: 37.7625, lng: -122.4480 },
            destinationAddress: o.destinationAddress || 'Customer Destination',
            destinationCoords: o.destinationCoords || { lat: 37.7749, lng: -122.4194 },
            droneId: o.droneId,
            missionId: o.missionId,
            paymentStatus: (o.paymentStatus as any) || 'successful',
            paymentAmount: o.paymentAmount || 49,
            status: o.status || 'pending_dispatch',
            createdAt: o.createdAt || new Date().toISOString(),
            updatedAt: o.updatedAt || new Date().toISOString(),
            timestamps: {
              created: o.createdAt || new Date().toISOString(),
            },
          }));
        }
      }

      // 2. Fetch real fleet from Admin Backend
      const fleetRes = await fetch('/api/admin/fleet');
      if (fleetRes.ok) {
        const rawFleet = await fleetRes.json();
        if (Array.isArray(rawFleet) && rawFleet.length > 0) {
          this.drones = rawFleet.map((d: any) => ({
            id: d.id,
            name: d.name,
            model: d.model,
            serialNumber: d.serialNumber || `SN-${d.id}`,
            registration: d.registration || `DGCA-${d.id}`,
            status: d.status,
            battery: d.battery,
            batteryHealth: d.batteryHealth || 98,
            batteryCycles: d.batteryCycles || 12,
            temperature: d.temperature || 28,
            payloadCapacity: d.payloadCapacity,
            currentPayloadWeight: d.currentPayloadWeight || 0,
            location: d.location || { lat: 37.7625, lng: -122.4480, altitude: 0, speed: 0, heading: 0 },
            distanceTravelledKm: d.distanceTravelledKm || 0,
            remainingDistanceKm: d.remainingDistanceKm || 0,
            signalStrength: d.signalStrength || 99,
            currentMissionId: d.currentMissionId,
            lastServiceDate: d.lastServiceDate || '2026-03-01',
            nextServiceDate: d.nextServiceDate || '2026-09-01',
            issuesCount: d.issuesCount || 0,
          }));
        }
      }

      // 3. Fetch missions from Admin Backend
      const missionsRes = await fetch('/api/admin/missions');
      if (missionsRes.ok) {
        const rawMissions = await missionsRes.json();
        if (Array.isArray(rawMissions)) {
          this.missions = rawMissions.map((m: any) => ({
            id: m.id,
            orderId: m.orderId,
            droneId: m.droneId,
            pickupAddress: 'SkyHub Aero Fulfillment Central #1',
            pickupCoords: { lat: 37.7625, lng: -122.4480 },
            destinationAddress: m.destinationAddress || 'Drop Zone',
            destinationCoords: m.currentCoords || { lat: 37.7749, lng: -122.4194 },
            plannedRoute: m.plannedRoute || [],
            actualRoute: m.actualRoute || [],
            distanceKm: m.distanceKm || 4.2,
            estimatedDurationMinutes: m.estimatedDurationMinutes || 12,
            currentStatus: m.currentStatus || 'in_flight',
            batteryAtStart: 95,
            currentBattery: m.droneBattery || 88,
            currentSpeedKmH: m.currentCoords?.speed || 45,
            currentAltitudeM: m.currentCoords?.altitude || 75,
            etaSeconds: m.etaSeconds || 300,
            createdAt: m.createdAt || new Date().toISOString(),
            startTime: m.startTime || new Date().toISOString(),
          }));
        }
      }

      // 4. Fetch geofences from Admin Backend
      const geoRes = await fetch('/api/admin/geofences');
      if (geoRes.ok) {
        const rawGeo = await geoRes.json();
        if (Array.isArray(rawGeo) && rawGeo.length > 0) {
          this.geofences = rawGeo;
        }
      }

      // 5. Fetch emergencies from Admin Backend
      const emgRes = await fetch('/api/admin/emergencies');
      if (emgRes.ok) {
        const rawEmg = await emgRes.json();
        if (Array.isArray(rawEmg)) {
          this.emergencies = rawEmg;
        }
      }

      // 6. Fetch maintenance records from Admin Backend
      const maintRes = await fetch('/api/admin/maintenance');
      if (maintRes.ok) {
        const rawMaint = await maintRes.json();
        if (Array.isArray(rawMaint)) {
          this.maintenance = rawMaint;
        }
      }

      // 7. Fetch audit logs from Admin Backend
      const auditRes = await fetch('/api/admin/audit-logs');
      if (auditRes.ok) {
        const rawAudit = await auditRes.json();
        if (Array.isArray(rawAudit)) {
          this.auditLogs = rawAudit;
        }
      }

      // 8. Fetch system notifications from Admin Backend
      const notifRes = await fetch('/api/admin/notifications');
      if (notifRes.ok) {
        const rawNotifs = await notifRes.json();
        if (Array.isArray(rawNotifs)) {
          this.notifications = rawNotifs;
        }
      }

      // 9. Fetch customers from Admin Backend
      const custRes = await fetch('/api/admin/customers');
      if (custRes.ok) {
        const rawCust = await custRes.json();
        if (Array.isArray(rawCust) && rawCust.length > 0) {
          this.customers = rawCust;
        }
      }

      this.notify();
    } catch (err) {
      console.warn('[Admin Store] Could not fetch real operational data, using cache:', err);
    }
  }

  private connectWebSocket() {
    if (typeof window === 'undefined') return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/admin`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Admin Store] Connected to authoritative Admin telemetry WebSocket');
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'TELEMETRY_UPDATE') {
            const t = payload.data;
            // Update drone live location
            const drone = this.drones.find((d) => d.id === t.droneId);
            if (drone) {
              drone.location = {
                lat: t.currentLocation.latitude,
                lng: t.currentLocation.longitude,
                altitude: t.currentLocation.altitudeMeters,
                speed: t.currentLocation.speedKmh,
                heading: t.currentLocation.bearing,
              };
              drone.battery = t.battery;
              drone.status = t.status === 'Delivered' ? 'available' : 'in_flight';
              drone.remainingDistanceKm = t.remainingDistanceKm;
            }

            // Update mission
            const mission = this.missions.find((m) => m.id === t.missionId);
            if (mission) {
              mission.currentAltitudeM = t.currentLocation.altitudeMeters;
              mission.currentSpeedKmH = t.currentLocation.speedKmh;
              mission.currentBattery = t.battery;
              mission.remainingDistanceKm = t.remainingDistanceKm;
              mission.etaSeconds = Math.round(t.estimatedArrivalMins * 60);
              mission.currentStatus = t.status === 'Delivered' ? 'delivered' : 'in_flight';
              if (!mission.actualRoute) mission.actualRoute = [];
              mission.actualRoute.push({
                lat: t.currentLocation.latitude,
                lng: t.currentLocation.longitude,
                altitude: t.currentLocation.altitudeMeters,
              });
            }

            // Update matching order status
            const order = this.orders.find((o) => o.id === t.operationalOrderId || o.customerId === t.customerOrderId);
            if (order) {
              if (t.status === 'Delivered') {
                order.status = 'delivered';
              } else if (t.status === 'Arriving') {
                order.status = 'arriving';
              } else {
                order.status = 'in_flight';
              }
            }

            this.notify();
          } else if (payload.type === 'ORDER_CREATED') {
            this.fetchOperationalData();
            this.addNotification(`New Customer Order Received: ${payload.data.customerOrderId}`, 'info');
          }
        } catch (e) {
          console.error('[Admin Store] Error parsing WebSocket message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[Admin Store] WebSocket connection error:', err);
      };

      this.ws.onclose = () => {
        console.log('[Admin Store] WebSocket closed. Will attempt reconnect on next cycle.');
        setTimeout(() => this.connectWebSocket(), 5000);
      };
    } catch (e) {
      console.warn('[Admin Store] WebSocket setup error:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
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

  // Smart Drone Recommendation Engine
  public getRecommendedDrone(order: Order) {
    const available = this.drones.filter((d) => d.status === 'available');
    if (available.length === 0) {
      return {
        drone: this.drones[0],
        score: 75,
        reasons: ['Highest available battery', 'Payload verified'],
      };
    }

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

  // Real backend workflow actions
  public async updateOrderStatus(orderId: string, status: string, description?: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, description }),
      });
      if (res.ok) {
        const order = this.orders.find((o) => o.id === orderId);
        if (order) order.status = status as any;
        this.addNotification(`Order ${orderId} updated to ${status}`, 'info');
        this.addAuditLog('Operator', 'Dispatcher', 'UPDATE_ORDER_STATUS', 'Order', orderId, 'Info', `Status updated to ${status}`);
        this.notify();
        return true;
      }
    } catch (err) {
      console.error('[Admin Store] Error updating order status:', err);
    }
    return false;
  }

  public async assignDroneToOrder(orderId: string, droneId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/dispatch/orders/${orderId}/assign-drone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ droneId }),
      });
      if (res.ok) {
        const data = await res.json();
        const order = this.orders.find((o) => o.id === orderId);
        const drone = this.drones.find((d) => d.id === droneId);

        if (order) {
          order.droneId = droneId;
          order.missionId = data.missionId;
          order.status = 'drone_assigned';
        }
        if (drone) {
          drone.status = 'in_flight';
          drone.currentMissionId = data.missionId;
        }

        this.addNotification(`Drone ${droneId} assigned to Order ${orderId}`, 'info');
        this.addAuditLog('Operator', 'Dispatcher', 'ASSIGN_DRONE', 'Order', orderId, 'Info', `Assigned drone ${droneId} to order ${orderId}`);
        await this.fetchOperationalData();
        return true;
      }
    } catch (err) {
      console.error('[Admin Store] Error assigning drone:', err);
    }
    return false;
  }

  public async launchMission(missionId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/missions/${missionId}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const mission = this.missions.find((m) => m.id === missionId);
        if (mission) mission.currentStatus = 'in_flight';

        const order = this.orders.find((o) => o.missionId === missionId);
        if (order) order.status = 'in_flight';

        this.addNotification(`Mission ${missionId} launched successfully. Telemetry active!`, 'info');
        this.addAuditLog('Operator', 'Dispatcher', 'LAUNCH_MISSION', 'Mission', missionId, 'Info', `Mission ${missionId} launched`);
        this.notify();
        return true;
      }
    } catch (err) {
      console.error('[Admin Store] Error launching mission:', err);
    }
    return false;
  }

  public async createProduct(productData: any): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      if (res.ok) {
        this.addNotification(`Product published & synchronized to customer catalog: ${productData.name}`, 'info');
        this.addAuditLog('Admin', 'Catalog', 'CREATE_PRODUCT', 'Product', productData.name, 'Info', 'Created and synchronized product');
        return true;
      }
    } catch (err) {
      console.error('[Admin Store] Error creating product:', err);
    }
    return false;
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

    // Sync to backend DB
    fetch('/api/admin/emergencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ droneId, issueType, message }),
    }).catch(() => {});

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

    const emergency = this.emergencies.find((e) => e.droneId === droneId && e.status === 'active');
    if (emergency) {
      emergency.status = 'resolved';
    }

    // Sync command to backend DB
    fetch(`/api/admin/emergencies/${emergency?.id || 'EMG-DEFAULT'}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, droneId }),
    }).catch(() => {});

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
    fetch(`/api/admin/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
    this.notify();
  }

  public markAllNotificationsRead() {
    this.notifications.forEach((n) => (n.read = true));
    fetch('/api/admin/notifications/read-all', { method: 'PATCH' }).catch(() => {});
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

    fetch('/api/admin/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName, adminRole, action, entity, entityId, severity, details }),
    }).catch(() => {});
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

    fetch('/api/admin/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geofence),
    }).catch(() => {});

    this.notify();
  }
}

export const mockStore = new MockDataStore();
