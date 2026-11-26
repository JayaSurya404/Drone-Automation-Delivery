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

import { BASE_CENTER } from '../data/mockData';
import { getAdminAuthHeaders, getAdminAuthToken } from '../utils/adminAuthHeaders';

export function extractData<T>(raw: any, preferredKey?: string): T {
  if (raw && typeof raw === 'object') {
    const target = raw.success === true && raw.data !== undefined ? raw.data : raw;
    if (Array.isArray(target)) {
      return target as T;
    }
    if (target && typeof target === 'object') {
      if (preferredKey && Array.isArray(target[preferredKey])) {
        return target[preferredKey] as T;
      }
      const candidates = [
        'items',
        'orders',
        'drones',
        'missions',
        'users',
        'deliveries',
        'products',
        'categories',
        'geofences',
        'emergencies',
        'maintenance',
        'auditLogs',
        'notifications',
        'customers',
        'payments',
        'merchants',
        'tickets',
        'admins',
      ];
      for (const key of candidates) {
        if (Array.isArray(target[key])) {
          return target[key] as T;
        }
      }
      return target as T;
    }
  }
  return raw as T;
}

class MockDataStore {
  private drones: Drone[] = [];
  private orders: Order[] = [];
  private missions: Mission[] = [];
  private geofences: GeofenceZone[] = [];
  private emergencies: EmergencyAlert[] = [];
  private notifications: SystemNotification[] = [];
  private maintenance: MaintenanceRecord[] = [];
  private tickets: SupportTicket[] = [];
  private auditLogs: AuditLog[] = [];
  private admins: AdminUser[] = [];
  private merchants: Merchant[] = [];
  private customers: Customer[] = [];
  private payments: PaymentTransaction[] = [];

  private listeners: Set<() => void> = new Set();
  private ws: WebSocket | null = null;
  private pollInterval: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      setTimeout(() => this.initDataConnection(), 0);
    }
  }

  public refreshSession() {
    this.disconnectWebSocket();
    if (getAdminAuthToken()) {
      this.fetchOperationalData();
      this.connectWebSocket();
    }
  }

  public clearSession() {
    this.disconnectWebSocket();
  }

  private disconnectWebSocket() {
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  private async initDataConnection() {
    if (getAdminAuthToken()) {
      // Initial fetch from real Admin Backend
      await this.fetchOperationalData();

      // Connect to live Admin WebSocket
      this.connectWebSocket();
    }

    // Setup fallback background sync
    if (typeof window !== 'undefined') {
      this.pollInterval = window.setInterval(() => {
        if (getAdminAuthToken() && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          this.fetchOperationalData();
        }
      }, 3500);
    }
  }

  public async fetchOperationalData() {
    const headers = getAdminAuthHeaders();
    if (!headers.Authorization) return;

    try {
      // 1. Fetch real orders from Admin Backend
      const ordersRes = await fetch('/api/v1/orders', { headers });
      if (ordersRes.ok) {
        const rawOrders = extractData<any[]>(await ordersRes.json(), 'orders');
        if (Array.isArray(rawOrders)) {
          this.orders = rawOrders.map((o: any) => ({
            id: o.id,
            customerId: o.customerOrderId || o.userId || 'C-1001',
            customerName: o.customerName || 'Customer',
            customerEmail: o.customerEmail || 'customer@skynav.local',
            merchantId: o.merchantId || 'M-01',
            merchantName: o.merchantName || 'SkyHub Kurumbapalayam',
            packageId: `PKG-${o.id}`,
            packageName: o.packageName || o.items?.[0]?.productName || 'Package Pod',
            packageWeightKg: o.packageWeightKg || 1.2,
            packageDimensions: '25x20x15 cm',
            pickupAddress: o.pickupAddress || 'SkyHub Kurumbapalayam',
            pickupCoords: o.pickupCoords || { lat: 11.1132, lng: 77.0277 },
            destinationAddress: o.destinationAddress || o.shippingAddress?.line1 || (typeof o.shippingAddress === 'string' ? JSON.parse(o.shippingAddress).line1 : null) || 'Customer Destination',
            destinationCoords: o.destinationCoords || { lat: 11.1132, lng: 77.0277 },
            droneId: o.droneId,
            missionId: o.missionId,
            paymentStatus: (o.paymentStatus as any) || 'successful',
            paymentAmount: o.paymentAmount || Number(o.totalAmount || 49),
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
      const fleetRes = await fetch('/api/v1/drones', { headers });
      if (fleetRes.ok) {
        const rawFleet = extractData<any[]>(await fleetRes.json(), 'drones');
        if (Array.isArray(rawFleet)) {
          this.drones = rawFleet.map((d: any) => ({
            id: d.id,
            name: d.name,
            model: d.model,
            serialNumber: d.serialNumber || `SN-${d.id}`,
            registration: d.registration || `DGCA-${d.id}`,
            status: d.status,
            battery: d.batteryPercent ?? d.battery ?? 100,
            batteryHealth: d.batteryHealth || 98,
            batteryCycles: d.batteryCycles || 12,
            temperature: d.temperature || 28,
            payloadCapacity: d.maxPayloadKg ?? d.payloadCapacity ?? 3.0,
            currentPayloadWeight: d.currentPayloadWeight || 0,
            location: {
              lat: d.currentLat ?? d.location?.lat ?? 11.1132,
              lng: d.currentLng ?? d.location?.lng ?? 77.0277,
              altitude: d.altitudeMeters ?? d.location?.altitude ?? 0,
              speed: d.speedMps ? Math.round(d.speedMps * 3.6) : (d.location?.speed ?? 0),
              heading: d.headingDeg ?? d.location?.heading ?? 0,
            },
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
      const missionsRes = await fetch('/api/v1/missions', { headers });
      if (missionsRes.ok) {
        const rawMissions = extractData<any[]>(await missionsRes.json(), 'missions');
        if (Array.isArray(rawMissions)) {
          this.missions = rawMissions.map((m: any) => ({
            id: m.id,
            orderId: m.orderId,
            droneId: m.droneId,
            pickupAddress: m.pickupHub?.name || 'SkyHub Kurumbapalayam',
            pickupCoords: { lat: m.pickupHub?.lat || 11.1132, lng: m.pickupHub?.lng || 77.0277 },
            destinationAddress: m.destinationAddress || 'Drop Zone',
            destinationCoords: m.dropLat && m.dropLng ? { lat: m.dropLat, lng: m.dropLng } : (m.currentCoords || { lat: 11.1132, lng: 77.0277 }),
            plannedRoute: m.plannedRoute || [],
            actualRoute: m.actualRoute || [],
            distanceKm: m.distanceKm || 4.2,
            estimatedDurationMinutes: m.estimatedDurationMinutes || 12,
            currentStatus: m.status || m.currentStatus || 'in_flight',
            batteryAtStart: 95,
            currentBattery: m.drone?.batteryPercent ?? m.droneBattery ?? 88,
            currentSpeedKmH: m.drone?.speedMps ? Math.round(m.drone.speedMps * 3.6) : (m.currentCoords?.speed || 45),
            currentAltitudeM: m.drone?.altitudeMeters ?? m.currentCoords?.altitude ?? 75,
            etaSeconds: m.etaSeconds || 300,
            createdAt: m.createdAt || new Date().toISOString(),
            startTime: m.startTime || new Date().toISOString(),
          }));
        }
      }

      // 4. Fetch geofences from Admin Backend
      const geoRes = await fetch('/api/v1/geofences', { headers });
      if (geoRes.ok) {
        const rawGeo = extractData<any[]>(await geoRes.json(), 'geofences');
        if (Array.isArray(rawGeo)) {
          this.geofences = rawGeo;
        }
      }

      // 5. Fetch users/admins from Admin Backend
      const admRes = await fetch('/api/v1/users', { headers });
      if (admRes.ok) {
        const rawAdm = extractData<any[]>(await admRes.json(), 'users');
        if (Array.isArray(rawAdm)) {
          this.admins = rawAdm;
        }
      }

      this.notify();
    } catch (err) {
      console.warn('[Admin Store] Could not fetch real operational data from backend API:', err);
    }
  }

  private connectWebSocket() {
    if (typeof window === 'undefined') return;
    // Realtime operations data is synchronized periodically via fetchOperationalData()
    // against the unified NestJS API. Raw WebSocket fallback only connects if explicitly enabled.
    if (!(window as any).ENABLE_LEGACY_RAW_WS) return;
    const token = getAdminAuthToken();
    if (!token) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/admin?token=${encodeURIComponent(token)}`;

      this.ws = new WebSocket(wsUrl);
      let hasConnected = false;

      this.ws.onopen = () => {
        hasConnected = true;
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
                sampleId: t.sampleId,
                simTime: t.simTime,
                timestamp: t.timestamp,
              };
              drone.sampleId = t.sampleId;
              drone.simTime = t.simTime;
              drone.lastTelemetryTimestamp = t.timestamp;
              drone.battery = t.battery;
              if (t.status === 'CHARGING') {
                drone.status = 'charging';
              } else if (t.status === 'RETURNING' || t.isReturning) {
                drone.status = 'returning';
              } else if (t.status === 'TOUCHDOWN') {
                drone.status = 'touchdown' as any;
              } else if (t.status === 'Delivered') {
                drone.status = 'available';
              } else {
                drone.status = 'in_flight';
              }
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
              mission.sampleId = t.sampleId;
              mission.simTime = t.simTime;
              if (t.status === 'TOUCHDOWN') {
                mission.currentStatus = 'touchdown' as any;
              } else if (t.status === 'RETURNING' || t.isReturning) {
                mission.currentStatus = 'returning';
              } else {
                mission.currentStatus = 'in_flight';
              }
              if (!mission.actualRoute) mission.actualRoute = [];
              mission.actualRoute.push({
                lat: t.currentLocation.latitude,
                lng: t.currentLocation.longitude,
                altitude: t.currentLocation.altitudeMeters,
                sampleId: t.sampleId,
                simTime: t.simTime,
                timestamp: t.timestamp,
              });
            }

            // Update matching order status
            const order = this.orders.find((o) => o.id === t.orderId || o.id === t.operationalOrderId || o.customerId === t.customerOrderId);
            if (order) {
              if (t.status === 'Delivered') {
                order.status = 'delivered';
              } else if (t.status === 'TOUCHDOWN' || t.status === 'Arriving') {
                order.status = 'arriving';
              } else {
                order.status = 'in_flight';
              }
            }

            this.notify();
          } else if (payload.type === 'MISSION_TOUCHDOWN') {
            const data = payload.data;
            const drone = this.drones.find((d) => d.id === data.droneId);
            if (drone) {
              drone.location.lat = data.coords[0];
              drone.location.lng = data.coords[1];
              drone.location.altitude = 0;
              drone.location.speed = 0;
              drone.status = 'touchdown' as any;
            }
            const mission = this.missions.find((m) => m.id === data.missionId);
            if (mission) {
              mission.currentStatus = 'touchdown' as any;
              mission.currentAltitudeM = 0;
              mission.currentSpeedKmH = 0;
              mission.remainingDistanceKm = 0;
            }
            const order = this.orders.find((o) => o.id === data.orderId);
            if (order) {
              order.status = 'arriving';
            }
            this.addNotification(`Mission ${data.missionId} touchdown at customer landing zone. Awaiting OTP verification.`, 'info');
            this.notify();
          } else if (payload.type === 'DRONE_STATUS_CHANGED') {
            const data = payload.data;
            const drone = this.drones.find((d) => d.id === data.droneId);
            if (drone) {
              drone.status = data.status;
              if (data.latitude !== undefined && data.longitude !== undefined) {
                drone.location.lat = data.latitude;
                drone.location.lng = data.longitude;
              }
              if (data.altitude !== undefined) drone.location.altitude = data.altitude;
              if (data.speed !== undefined) drone.location.speed = data.speed;
            }
            if (data.message) {
              this.addNotification(data.message, data.status === 'available' ? 'success' : 'info');
            }
            this.notify();
          } else if (payload.type === 'DRONE_BATTERY_UPDATE') {
            const data = payload.data;
            const drone = this.drones.find((d) => d.id === data.droneId);
            if (drone) {
              drone.battery = data.battery;
              if (data.status) drone.status = data.status;
            }
            this.notify();
          } else if (payload.type === 'ORDER_DELIVERED') {
            const data = payload.data;
            const order = this.orders.find((o) => o.id === data.orderId);
            if (order) {
              order.status = 'delivered';
            }
            const drone = this.drones.find((d) => d.id === data.droneId);
            if (drone) {
              drone.status = 'returning';
            }
            this.addNotification(`Order ${data.orderId} verified and delivered. Drone return flight active.`, 'success');
            this.notify();
          } else if (payload.type === 'ORDER_CREATED') {
            const data = payload.data;
            const newOrder = data?.order;
            if (newOrder) {
              const existingIdx = this.orders.findIndex(
                (o) => o.id === newOrder.id || (newOrder.customerOrderId && o.customerId === newOrder.customerOrderId)
              );
              const mappedOrder: Order = {
                id: newOrder.id,
                customerId: newOrder.customerOrderId || 'C-1001',
                customerName: newOrder.customerName || 'Customer',
                customerEmail: 'customer@skynav',
                merchantId: 'M-01',
                merchantName: newOrder.merchantName || 'SkyHub Kurumbapalayam',
                packageId: `PKG-${newOrder.id}`,
                packageName: newOrder.packageName || 'Package Pod',
                packageWeightKg: newOrder.packageWeightKg || 1.2,
                packageDimensions: '25x20x15 cm',
                pickupAddress: newOrder.pickupAddress || 'SkyHub Kurumbapalayam',
                pickupCoords: newOrder.pickupCoords || { lat: 11.1132, lng: 77.0277 },
                destinationAddress: newOrder.destinationAddress || 'Customer Destination',
                destinationCoords: newOrder.destinationCoords || { lat: 11.1132, lng: 77.0277 },
                droneId: newOrder.droneId,
                missionId: newOrder.missionId,
                paymentStatus: 'successful',
                paymentAmount: newOrder.totalAmount || 49,
                status: (newOrder.status as any) || 'pending_dispatch',
                createdAt: newOrder.createdAt || new Date().toISOString(),
                updatedAt: newOrder.updatedAt || new Date().toISOString(),
                timestamps: {
                  created: newOrder.createdAt || new Date().toISOString(),
                },
              };

              if (existingIdx >= 0) {
                this.orders[existingIdx] = { ...this.orders[existingIdx], ...mappedOrder };
              } else {
                this.orders.unshift(mappedOrder);
              }
              this.addNotification(`New Customer Order Received: ${newOrder.id} (${newOrder.customerName})`, 'info');
              this.notify();
            }
            this.fetchOperationalData();
          }
        } catch (e) {
          console.error('[Admin Store] Error parsing WebSocket message:', e);
        }
      };

      this.ws.onerror = (_err) => {
        // Handled gracefully: store relies on background polling if telemetry WS is unavailable
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (hasConnected) {
          console.log('[Admin Store] WebSocket closed. Reconnecting...');
          setTimeout(() => this.connectWebSocket(), 10000);
        }
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
  public getRecommendedDrone(order: Order | null) {
    if (!order || !this.drones || this.drones.length === 0) {
      return {
        drone: this.drones?.[0] || null,
        score: 0,
        reasons: ['No drones available in fleet'],
      };
    }

    const packageWeight = order.packageWeightKg ?? 1.0;
    const available = this.drones.filter((d) => d.status === 'available');
    if (available.length === 0) {
      const fallback = this.drones[0];
      return {
        drone: fallback,
        score: 50,
        reasons: [
          `Battery reserve: ${fallback.battery}%`,
          `Payload capacity: ${fallback.payloadCapacity} kg`,
          'Status: ' + fallback.status,
        ],
      };
    }

    const scored = available.map((d) => {
      let score = ((d.battery ?? 0) / 100) * 40;
      score += ((d.payloadCapacity ?? 5) >= packageWeight ? 30 : 0);
      score += ((d.batteryHealth ?? 100) / 100) * 20;
      score += ((d.issuesCount ?? 0) === 0 ? 10 : 0);
      return { drone: d, score: Math.round(score) };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];

    const reasons = [
      `Highest battery level (${top.drone.battery}%)`,
      `Optimal payload capacity (${top.drone.payloadCapacity} kg vs ${packageWeight} kg)`,
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
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
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
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
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
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
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
      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
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
    fetch(`/api/admin/notifications/${id}/read`, { method: 'PATCH', headers: getAdminAuthHeaders() }).catch(() => {});
    this.notify();
  }

  public markAllNotificationsRead() {
    this.notifications.forEach((n) => (n.read = true));
    fetch('/api/admin/notifications/read-all', { method: 'PATCH', headers: getAdminAuthHeaders() }).catch(() => {});
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
      headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ adminName, adminRole, action, entity, entityId, severity, details }),
    }).catch(() => {});
  }

  public updateMerchantStatus(merchantId: string, status: Merchant['status']) {
    const m = this.merchants.find((mer) => mer.id === merchantId);
    if (m) {
      m.status = status;
      this.addAuditLog('Rajesh Sharma', 'Super Admin', 'UPDATE_STATUS', 'Merchants', merchantId, 'Info', `Set merchant status to ${status}`);
      fetch(`/api/admin/merchants/${merchantId}/status`, {
        method: 'PATCH',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status }),
      }).catch(() => {});
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
      headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(geofence),
    }).catch(() => {});

    this.notify();
  }
}

export const mockStore = new MockDataStore();
