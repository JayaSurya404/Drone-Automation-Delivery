import { db, queryOne, queryAll, runCommand } from '../db/database.js';

export interface TelemetryUpdate {
  orderId: string;
  droneId: string;
  droneName: string;
  status: string;
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
  isCompleted: boolean;
  handoverOtp: string;
}

type TelemetryListener = (data: TelemetryUpdate) => void;

class DroneTrackingService {
  private listeners: Map<string, Set<TelemetryListener>> = new Map(); // orderId -> listeners
  private activeSimulations: Map<string, NodeJS.Timeout> = new Map();

  // Calculate distance between two coordinates in km (Haversine)
  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
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
    return parseFloat(((brng + 360) % 360).toFixed(1));
  }

  // Generate smooth flight waypoints with safe air corridor deviation
  public generateFlightRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    numPoints: number = 50
  ): [number, number][] {
    const points: [number, number][] = [];
    const midLat = (startLat + endLat) / 2 + 0.0025;
    const midLng = (startLng + endLng) / 2 - 0.0035;

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * midLat + t * t * endLat;
      const lng = (1 - t) * (1 - t) * startLng + 2 * (1 - t) * t * midLng + t * t * endLng;
      points.push([parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
    }
    return points;
  }

  // Subscribe to live telemetry for a specific order
  public subscribe(orderId: string, listener: TelemetryListener): () => void {
    if (!this.listeners.has(orderId)) {
      this.listeners.set(orderId, new Set());
    }
    this.listeners.get(orderId)!.add(listener);

    return () => {
      const orderListeners = this.listeners.get(orderId);
      if (orderListeners) {
        orderListeners.delete(listener);
        if (orderListeners.size === 0) {
          this.listeners.delete(orderId);
        }
      }
    };
  }

  // Broadcast update to subscribed clients
  private broadcast(orderId: string, update: TelemetryUpdate) {
    const orderListeners = this.listeners.get(orderId);
    if (orderListeners) {
      orderListeners.forEach((listener) => {
        try {
          listener(update);
        } catch (e) {
          console.error('Error delivering telemetry update:', e);
        }
      });
    }
  }

  // Record an order status transition and create a deduplicated notification
  public transitionOrderStatus(orderId: string, newStatus: string, description: string) {
    const order = queryOne<any>('SELECT customer_id, status FROM orders WHERE id = ?', [orderId]);
    if (!order) return;

    if (order.status === newStatus) return; // Prevent duplicate transition

    db.transaction(() => {
      // 1. Update order status
      runCommand(
        "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
        [newStatus, orderId]
      );

      // 2. Record timeline entry
      runCommand(`
        INSERT INTO order_status_history (id, order_id, previous_status, new_status, description, completed, timestamp)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
      `, [
        `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId,
        order.status,
        newStatus,
        description
      ]);

      // 3. Create Deduplicated Notification with unique event_id
      const eventId = `evt_${orderId}_${newStatus.replace(/\s+/g, '_').toLowerCase()}`;
      const notifTitles: Record<string, string> = {
        'Order Confirmed': 'Order Confirmed by SkyHub',
        'Preparing': 'Packaging Aerodynamic Cargo Pod',
        'Drone Assigned': 'Autonomous Drone Assigned',
        'Drone Launched': 'Drone Airborne & In Flight',
        'Out for Delivery': 'Drone Out for Delivery',
        'Near Destination': 'Drone Approaching Landing Zone',
        'Arriving': 'Precision Sonar Landing Initiated',
        'Delivered': 'Order Delivered to Landing Zone! 🚀',
      };

      const title = notifTitles[newStatus] || `Order Update: ${newStatus}`;

      runCommand(`
        INSERT OR IGNORE INTO notifications (id, customer_id, title, message, type, is_read, order_id, event_id, created_at)
        VALUES (?, ?, ?, ?, 'delivery', 0, ?, ?, datetime('now'))
      `, [
        `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        order.customer_id,
        title,
        description,
        orderId,
        eventId
      ]);
    })();
  }

  // Start autonomous drone flight progression
  public startFlightSimulation(orderId: string) {
    if (this.activeSimulations.has(orderId)) return;

    const delivery = queryOne<any>(`
      SELECT d.*, o.customer_id, dr.identifier as drone_name
      FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      LEFT JOIN drones dr ON dr.id = d.drone_id
      WHERE d.order_id = ?
    `, [orderId]);

    if (!delivery) return;

    let route: [number, number][] = [];
    try {
      route = JSON.parse(delivery.flight_route_json);
    } catch {
      route = this.generateFlightRoute(
        delivery.pickup_latitude,
        delivery.pickup_longitude,
        delivery.destination_latitude,
        delivery.destination_longitude
      );
    }

    let currentIndex = 0;
    const totalPoints = route.length;
    const droneName = delivery.drone_name || 'SkyLink Swift-04';

    const interval = setInterval(() => {
      currentIndex++;

      if (currentIndex >= totalPoints) {
        // Delivery Completed
        clearInterval(interval);
        this.activeSimulations.delete(orderId);

        const dest = route[totalPoints - 1];
        runCommand(`
          UPDATE deliveries SET
            current_latitude = ?,
            current_longitude = ?,
            current_altitude = 0,
            current_speed = 0,
            remaining_distance_km = 0,
            estimated_arrival_mins = 0,
            status = 'DELIVERED',
            completed_at = datetime('now'),
            updated_at = datetime('now')
          WHERE order_id = ?
        `, [dest[0], dest[1], orderId]);

        runCommand(`
          UPDATE orders SET
            status = 'Delivered',
            completed_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?
        `, [orderId]);

        this.transitionOrderStatus(
          orderId,
          'Delivered',
          `Package safely deposited at your designated drop zone with OTP verification.`
        );

        this.broadcast(orderId, {
          orderId,
          droneId: delivery.drone_id,
          droneName,
          status: 'Delivered',
          currentLocation: {
            latitude: dest[0],
            longitude: dest[1],
            altitudeMeters: 0,
            speedKmh: 0,
            bearing: 0,
          },
          remainingDistanceKm: 0,
          estimatedArrivalMins: 0,
          progressPercent: 100,
          timestamp: new Date().toISOString(),
          isCompleted: true,
          handoverOtp: delivery.handover_otp,
        });

        return;
      }

      const currentCoord = route[currentIndex];
      const prevCoord = route[currentIndex - 1];
      const bearing = this.calculateBearing(prevCoord[0], prevCoord[1], currentCoord[0], currentCoord[1]);

      const destCoord = route[totalPoints - 1];
      const remainingKm = this.calculateDistanceKm(currentCoord[0], currentCoord[1], destCoord[0], destCoord[1]);
      const progress = (currentIndex / totalPoints) * 100;
      const speed = currentIndex < 5 || currentIndex > totalPoints - 5 ? 32 : 62;
      const altitude = currentIndex < 5 ? 25 : currentIndex > totalPoints - 5 ? 15 : 120;
      const etaMins = Math.max(1, Math.round(remainingKm * 1.5));

      let currentStatus = 'Out for Delivery';
      if (progress < 15) {
        currentStatus = 'Drone Launched';
      } else if (progress >= 80 && progress < 95) {
        currentStatus = 'Near Destination';
      } else if (progress >= 95) {
        currentStatus = 'Arriving';
      }

      // Update database delivery position
      runCommand(`
        UPDATE deliveries SET
          current_latitude = ?,
          current_longitude = ?,
          current_altitude = ?,
          current_speed = ?,
          current_bearing = ?,
          remaining_distance_km = ?,
          estimated_arrival_mins = ?,
          status = ?,
          updated_at = datetime('now')
        WHERE order_id = ?
      `, [
        currentCoord[0],
        currentCoord[1],
        altitude,
        speed,
        bearing,
        remainingKm,
        etaMins,
        currentStatus,
        orderId
      ]);

      // Progress milestones
      if (progress === 16) {
        this.transitionOrderStatus(orderId, 'Out for Delivery', `Drone cruising at ${altitude}m along Skyway corridor.`);
      } else if (progress === 80) {
        this.transitionOrderStatus(orderId, 'Near Destination', `Drone entered neighborhood airspace. Preparing landing descent.`);
      } else if (progress === 96) {
        this.transitionOrderStatus(orderId, 'Arriving', `Precision sonar tether deployed. Stand clear of landing zone.`);
      }

      this.broadcast(orderId, {
        orderId,
        droneId: delivery.drone_id,
        droneName,
        status: currentStatus,
        currentLocation: {
          latitude: currentCoord[0],
          longitude: currentCoord[1],
          altitudeMeters: altitude,
          speedKmh: speed,
          bearing,
        },
        remainingDistanceKm: remainingKm,
        estimatedArrivalMins: etaMins,
        progressPercent: parseFloat(progress.toFixed(1)),
        timestamp: new Date().toISOString(),
        isCompleted: false,
        handoverOtp: delivery.handover_otp,
      });
    }, 2500); // Step every 2.5s

    this.activeSimulations.set(orderId, interval);
  }

  // Get current snapshot of tracking state
  public getTrackingSnapshot(orderId: string): any {
    const delivery = queryOne<any>(`
      SELECT d.*, o.status as order_status, o.customer_id, o.delivery_address_json, dr.identifier as drone_name
      FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      LEFT JOIN drones dr ON dr.id = d.drone_id
      WHERE d.order_id = ?
    `, [orderId]);

    if (!delivery) return null;

    let route: [number, number][] = [];
    try {
      route = JSON.parse(delivery.flight_route_json);
    } catch {
      route = [];
    }

    let addressData: any = {};
    try {
      addressData = JSON.parse(delivery.delivery_address_json);
    } catch {}

    const hub = queryOne<any>('SELECT hub_name, hub_latitude, hub_longitude FROM delivery_zones LIMIT 1') || {
      hub_name: 'SkyHub Aero Fulfillment Central #1',
      hub_latitude: 37.7625,
      hub_longitude: -122.4480,
    };

    return {
      orderId: delivery.order_id,
      orderStatus: delivery.order_status,
      hubLocation: {
        name: hub.hub_name,
        latitude: hub.hub_latitude,
        longitude: hub.hub_longitude,
      },
      destinationLocation: {
        latitude: delivery.destination_latitude,
        longitude: delivery.destination_longitude,
        address: addressData.street ? `${addressData.building || ''}, ${addressData.street}, ${addressData.city || ''}` : 'Customer Landing Zone',
      },
      currentDroneLocation: {
        latitude: delivery.current_latitude,
        longitude: delivery.current_longitude,
        altitudeMeters: delivery.current_altitude,
        speedKmh: delivery.current_speed,
        bearing: delivery.current_bearing,
      },
      flightRoute: route,
      remainingDistanceKm: delivery.remaining_distance_km,
      estimatedArrivalMins: delivery.estimated_arrival_mins,
      estimatedArrivalFormatted: `${delivery.estimated_arrival_mins} mins`,
      droneAssignedName: delivery.drone_name || 'SkyLink Aero-X4 Cargo',
      connectionStatus: 'connected',
      lastUpdated: delivery.updated_at,
      isCompleted: delivery.order_status === 'Delivered',
      handoverOtp: delivery.handover_otp,
    };
  }
}

export const droneTrackingService = new DroneTrackingService();
