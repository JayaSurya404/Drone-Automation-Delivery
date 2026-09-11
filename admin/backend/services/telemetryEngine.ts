import { WebSocket } from 'ws';
import { db, queryOne, queryAll, runCommand } from '../db/database.js';
import { customerIntegrationClient } from './customerIntegrationClient.js';
import { CustomerOrderStatus } from '../../../shared/contracts/types.js';

interface ActiveMissionState {
  missionId: string;
  orderId: string;
  customerOrderId: string;
  droneId: string;
  droneName: string;
  route: [number, number][];
  currentIndex: number;
  totalPoints: number;
  handoverOtp: string;
  lastMilestoneTime: number;
}

interface ActiveReturnFlight {
  droneId: string;
  droneName: string;
  missionId: string;
  orderId: string;
  customerOrderId: string;
  returnRoute: [number, number][];
  currentIndex: number;
  totalPoints: number;
  hubCoords: [number, number];
  hubName: string;
}

interface ChargingDroneState {
  droneId: string;
  targetBattery: number;
  ticksCharging: number;
}

class TelemetryEngine {
  private activeMissions: Map<string, ActiveMissionState> = new Map();
  private activeReturnFlights: Map<string, ActiveReturnFlight> = new Map();
  private chargingDrones: Map<string, ChargingDroneState> = new Map();
  private adminWsClients: Set<WebSocket> = new Set();
  private tickerInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTicker();
  }

  public registerAdminWs(ws: WebSocket) {
    this.adminWsClients.add(ws);
    // Send immediate snapshot of fleet
    const drones = queryAll('SELECT * FROM drones');
    const missions = queryAll("SELECT * FROM missions WHERE current_status IN ('in_flight', 'approaching')");
    ws.send(JSON.stringify({ type: 'FLEET_SNAPSHOT', data: { drones, missions } }));

    ws.on('close', () => {
      this.adminWsClients.delete(ws);
    });
  }

  private broadcastToAdmin(event: string, data: any) {
    const message = JSON.stringify({ type: event, data });
    for (const client of this.adminWsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  // Calculate distance between two lat/lng coordinates in km
  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  // Calculate bearing in degrees
  public calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
    return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
  }

  // Generate smooth waypoints
  public generateFlightRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    numSteps: number = 24
  ): [number, number][] {
    const route: [number, number][] = [];
    for (let i = 0; i <= numSteps; i++) {
      const fraction = i / numSteps;
      const baseLat = startLat + (endLat - startLat) * fraction;
      const baseLng = startLng + (endLng - startLng) * fraction;
      // Slight atmospheric arc deviation
      const curve = Math.sin(fraction * Math.PI) * 0.002;
      route.push([
        parseFloat((baseLat + curve).toFixed(6)),
        parseFloat((baseLng + curve * 0.5).toFixed(6)),
      ]);
    }
    return route;
  }

  // Start authoritative mission flight loop
  public launchMission(missionId: string) {
    const mission = queryOne<any>(`
      SELECT m.*, o.customer_order_id, o.handover_otp, d.name as drone_name
      FROM missions m
      JOIN operational_orders o ON o.id = m.operational_order_id
      JOIN drones d ON d.id = m.drone_id
      WHERE m.id = ?
    `, [missionId]);

    if (!mission) return;

    let route: [number, number][] = [];
    try {
      route = JSON.parse(mission.planned_route_json);
    } catch {
      route = [];
    }

    if (route.length === 0) {
      console.warn(`[TelemetryEngine] Mission ${missionId} has empty route`);
      return;
    }

    runCommand(`
      UPDATE missions SET
        current_status = 'in_flight',
        start_time = datetime('now')
      WHERE id = ?
    `, [missionId]);

    runCommand(`
      UPDATE operational_orders SET
        status = 'in_flight',
        updated_at = datetime('now')
      WHERE id = ?
    `, [mission.operational_order_id]);

    runCommand(`
      UPDATE drones SET
        status = 'in_flight',
        current_mission_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [missionId, mission.drone_id]);

    const state: ActiveMissionState = {
      missionId,
      orderId: mission.operational_order_id,
      customerOrderId: mission.customer_order_id,
      droneId: mission.drone_id,
      droneName: mission.drone_name || 'SkyNav X1',
      route,
      currentIndex: 0,
      totalPoints: route.length,
      handoverOtp: mission.handover_otp || '0000',
      lastMilestoneTime: 0,
    };

    this.activeMissions.set(missionId, state);

    // Notify Customer Backend that mission is launched
    customerIntegrationClient.notifyMissionLaunched({
      customerOrderId: mission.customer_order_id,
      operationalOrderId: mission.operational_order_id,
      missionId,
      droneId: mission.drone_id,
      droneName: mission.drone_name,
      plannedRoute: route,
      distanceKm: mission.distance_km,
      estimatedDurationMins: mission.estimated_duration_minutes,
      launchedAt: new Date().toISOString(),
    });

    console.log(`🚀 [TelemetryEngine] Mission ${missionId} launched. Authoritative flight loop started.`);
  }

  private startTicker() {
    this.tickerInterval = setInterval(() => {
      this.tick();
    }, 1000); // 1-second physics tick
  }

  private tick() {
    const now = Date.now();

    // ── 1. Outbound Mission Flight Loop ──
    for (const [missionId, state] of this.activeMissions.entries()) {
      state.currentIndex++;

      // Check if reached destination
      if (state.currentIndex >= state.totalPoints - 1) {
        state.currentIndex = state.totalPoints - 1;
        const finalCoord = state.route[state.currentIndex];

        // Update DB
        runCommand(`
          UPDATE missions SET
            current_status = 'delivered',
            current_latitude = ?,
            current_longitude = ?,
            current_altitude = 0,
            current_speed = 0,
            remaining_distance_km = 0,
            eta_seconds = 0
          WHERE id = ?
        `, [finalCoord[0], finalCoord[1], missionId]);

        runCommand(`
          UPDATE operational_orders SET
            status = 'arriving',
            updated_at = datetime('now')
          WHERE id = ?
        `, [state.orderId]);

        runCommand(`
          UPDATE drones SET
            latitude = ?,
            longitude = ?,
            altitude = 0,
            speed = 0,
            status = 'in_flight',
            updated_at = datetime('now')
          WHERE id = ?
        `, [finalCoord[0], finalCoord[1], state.droneId]);

        // Broadcast to Admin
        this.broadcastToAdmin('MISSION_TOUCHDOWN', {
          missionId,
          orderId: state.orderId,
          droneId: state.droneId,
          coords: finalCoord,
          status: 'TOUCHDOWN',
        });

        // Notify Customer Backend of touchdown
        customerIntegrationClient.notifyDeliveryTouchdown({
          customerOrderId: state.customerOrderId,
          missionId,
          droneId: state.droneId,
          arrivedAt: new Date().toISOString(),
          requiresOtp: true,
          message: 'Drone has arrived at your designated landing zone. Enter OTP to receive package.',
        });

        // Remove from active outbound tracking (now in DELIVERY_WAIT state awaiting OTP)
        this.activeMissions.delete(missionId);
        continue;
      }

      // In-flight waypoint calculation
      const currentCoord = state.route[state.currentIndex];
      const prevCoord = state.route[state.currentIndex - 1] || currentCoord;
      const destCoord = state.route[state.totalPoints - 1];

      const bearing = this.calculateBearing(prevCoord[0], prevCoord[1], currentCoord[0], currentCoord[1]);
      const remainingKm = this.calculateDistanceKm(currentCoord[0], currentCoord[1], destCoord[0], destCoord[1]);
      const progress = (state.currentIndex / state.totalPoints) * 100;
      const speed = state.currentIndex < 3 || state.currentIndex > state.totalPoints - 3 ? 30 : 55;
      const altitude = state.currentIndex < 3 ? 20 : state.currentIndex > state.totalPoints - 3 ? 12 : 75;
      const etaMins = Math.max(1, Math.round(remainingKm * 1.5));
      const etaSeconds = etaMins * 60;

      let customerStatus: CustomerOrderStatus = 'Out for Delivery';
      if (progress >= 80 && progress < 95) {
        customerStatus = 'Near Destination';
      } else if (progress >= 95) {
        customerStatus = 'Arriving';
      }

      // Update Database
      runCommand(`
        UPDATE missions SET
          current_latitude = ?,
          current_longitude = ?,
          current_altitude = ?,
          current_speed = ?,
          current_bearing = ?,
          remaining_distance_km = ?,
          eta_seconds = ?,
          current_status = ?
        WHERE id = ?
      `, [currentCoord[0], currentCoord[1], altitude, speed, bearing, remainingKm, etaSeconds, progress >= 95 ? 'approaching' : 'in_flight', missionId]);

      runCommand(`
        UPDATE drones SET
          latitude = ?,
          longitude = ?,
          altitude = ?,
          heading = ?,
          speed = ?,
          battery = MAX(15, battery - 1),
          updated_at = datetime('now')
        WHERE id = ?
      `, [currentCoord[0], currentCoord[1], altitude, bearing, speed, state.droneId]);

      // Broadcast 1Hz telemetry to Admin WebSocket
      this.broadcastToAdmin('TELEMETRY_UPDATE', {
        missionId,
        orderId: state.orderId,
        droneId: state.droneId,
        currentLocation: {
          latitude: currentCoord[0],
          longitude: currentCoord[1],
          altitudeMeters: altitude,
          speedKmh: speed,
          bearing,
        },
        battery: queryOne<any>('SELECT battery FROM drones WHERE id = ?', [state.droneId])?.battery ?? 85,
        latitude: currentCoord[0],
        longitude: currentCoord[1],
        altitude,
        speed,
        heading: bearing,
        remainingDistanceKm: remainingKm,
        remainingKm,
        estimatedArrivalMins: etaMins,
        progressPercent: parseFloat(progress.toFixed(1)),
        status: customerStatus,
      });

      // Push milestone telemetry to Customer Backend every 2.5s
      if (now - state.lastMilestoneTime >= 2500 || state.lastMilestoneTime === 0) {
        state.lastMilestoneTime = now;
        customerIntegrationClient.notifyTelemetryMilestone({
          customerOrderId: state.customerOrderId,
          missionId,
          droneId: state.droneId,
          droneName: state.droneName,
          status: customerStatus,
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
          handoverOtp: state.handoverOtp,
        });
      }
    }

    // ── 2. Return-To-Hub Flight Loop ──
    for (const [droneId, ret] of this.activeReturnFlights.entries()) {
      ret.currentIndex++;

      if (ret.currentIndex >= ret.totalPoints - 1) {
        ret.currentIndex = ret.totalPoints - 1;
        const hubCoord = ret.hubCoords;

        // Reached SkyHub Kurumbapalayam!
        runCommand(`
          UPDATE drones SET
            latitude = ?,
            longitude = ?,
            altitude = 0,
            speed = 0,
            status = 'charging',
            current_mission_id = NULL,
            updated_at = datetime('now')
          WHERE id = ?
        `, [hubCoord[0], hubCoord[1], droneId]);

        console.log(`🔌 [TelemetryEngine] Drone ${droneId} arrived at ${ret.hubName} (${hubCoord[0]}, ${hubCoord[1]}). HUB_ARRIVAL -> CHARGING.`);

        this.broadcastToAdmin('DRONE_STATUS_CHANGED', {
          droneId,
          status: 'charging',
          latitude: hubCoord[0],
          longitude: hubCoord[1],
          altitude: 0,
          speed: 0,
          message: `Drone ${droneId} arrived at ${ret.hubName}. Commencing charging cycle.`,
        });

        // Start simulated charging cycle
        this.chargingDrones.set(droneId, {
          droneId,
          targetBattery: 100,
          ticksCharging: 0,
        });

        this.activeReturnFlights.delete(droneId);
        continue;
      }

      // Return flight waypoint calculation
      const currentCoord = ret.returnRoute[ret.currentIndex];
      const prevCoord = ret.returnRoute[ret.currentIndex - 1] || currentCoord;
      const bearing = this.calculateBearing(prevCoord[0], prevCoord[1], currentCoord[0], currentCoord[1]);
      const remainingKm = this.calculateDistanceKm(currentCoord[0], currentCoord[1], ret.hubCoords[0], ret.hubCoords[1]);
      const progress = (ret.currentIndex / ret.totalPoints) * 100;
      const speed = ret.currentIndex < 3 || ret.currentIndex > ret.totalPoints - 3 ? 35 : 52;
      const altitude = ret.currentIndex < 3 ? 30 : ret.currentIndex > ret.totalPoints - 3 ? 15 : 65;

      // Update Database - battery continues decreasing on return flight
      runCommand(`
        UPDATE drones SET
          latitude = ?,
          longitude = ?,
          altitude = ?,
          heading = ?,
          speed = ?,
          battery = MAX(15, battery - 1),
          status = 'returning',
          updated_at = datetime('now')
        WHERE id = ?
      `, [currentCoord[0], currentCoord[1], altitude, bearing, speed, droneId]);

      const currentDrone = queryOne<any>('SELECT battery FROM drones WHERE id = ?', [droneId]);

      // Broadcast return flight telemetry to Admin WebSocket
      this.broadcastToAdmin('TELEMETRY_UPDATE', {
        missionId: ret.missionId,
        orderId: ret.orderId,
        droneId: ret.droneId,
        currentLocation: {
          latitude: currentCoord[0],
          longitude: currentCoord[1],
          altitudeMeters: altitude,
          speedKmh: speed,
          bearing,
        },
        battery: currentDrone?.battery ?? 70,
        latitude: currentCoord[0],
        longitude: currentCoord[1],
        altitude,
        speed,
        heading: bearing,
        remainingDistanceKm: remainingKm,
        remainingKm,
        progressPercent: parseFloat(progress.toFixed(1)),
        status: 'RETURNING',
        isReturning: true,
      });
    }

    // ── 3. Hub Charging Cycle Loop ──
    for (const [droneId, charge] of this.chargingDrones.entries()) {
      charge.ticksCharging++;

      const drone = queryOne<any>('SELECT battery FROM drones WHERE id = ?', [droneId]);
      const currentBattery = drone ? drone.battery : 70;
      const newBattery = Math.min(100, currentBattery + 5);

      const nextStatus = newBattery >= 100 ? 'available' : 'charging';

      runCommand(`
        UPDATE drones SET
          battery = ?,
          status = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `, [newBattery, nextStatus, droneId]);

      this.broadcastToAdmin('DRONE_BATTERY_UPDATE', {
        droneId,
        battery: newBattery,
        status: nextStatus,
      });

      if (newBattery >= 100) {
        console.log(`⚡ [TelemetryEngine] Drone ${droneId} fully charged (100%). Transitioned to AVAILABLE.`);
        this.broadcastToAdmin('DRONE_STATUS_CHANGED', {
          droneId,
          status: 'available',
          message: `Drone ${droneId} fully recharged and ready for next autonomous mission.`,
        });
        this.chargingDrones.delete(droneId);
      }
    }
  }

  // Handle OTP Verified & Delivery Completed from Customer Backend
  public completeDelivery(customerOrderId: string, verifiedOtp: string) {
    const order = queryOne<any>(`
      SELECT * FROM operational_orders WHERE customer_order_id = ?
    `, [customerOrderId]);

    if (!order) return;

    runCommand(`
      UPDATE operational_orders SET
        status = 'delivered',
        updated_at = datetime('now')
      WHERE id = ?
    `, [order.id]);

    if (order.mission_id) {
      runCommand(`
        UPDATE missions SET
          current_status = 'completed',
          completion_time = datetime('now')
        WHERE id = ?
      `, [order.mission_id]);
    }

    if (order.drone_id) {
      const drone = queryOne<any>('SELECT * FROM drones WHERE id = ?', [order.drone_id]);
      const hubLat = order.pickup_lat || 11.1132;
      const hubLng = order.pickup_lng || 77.0277;
      const startLat = order.destination_lat || 11.1132;
      const startLng = order.destination_lng || 77.0277;

      // Generate return flight route from destination back to SkyHub Kurumbapalayam
      const returnRoute = this.generateFlightRoute(startLat, startLng, hubLat, hubLng, 18);

      runCommand(`
        UPDATE drones SET
          status = 'returning',
          altitude = 60,
          speed = 45,
          current_mission_id = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `, [order.mission_id, order.drone_id]);

      // Register active return flight in engine
      this.activeReturnFlights.set(order.drone_id, {
        droneId: order.drone_id,
        droneName: drone?.name || 'SkyNav X1',
        missionId: order.mission_id || `MS-RET-${order.drone_id}`,
        orderId: order.id,
        customerOrderId,
        returnRoute,
        currentIndex: 0,
        totalPoints: returnRoute.length,
        hubCoords: [hubLat, hubLng],
        hubName: 'SkyHub Kurumbapalayam',
      });

      this.broadcastToAdmin('DRONE_STATUS_CHANGED', {
        droneId: order.drone_id,
        status: 'returning',
        message: `Delivery completed via OTP. Drone ${order.drone_id} ascending and returning to SkyHub Kurumbapalayam.`,
      });
    }

    runCommand(`
      INSERT INTO audit_logs (id, admin_name, admin_role, action, entity, entity_id, severity, timestamp, details)
      VALUES (?, 'System', 'Autonomous Dispatch', 'DELIVERY_COMPLETED', 'Order', ?, 'Info', datetime('now'), ?)
    `, [`log_${Date.now()}`, order.id, `Delivery completed and verified via OTP ${verifiedOtp}. Drone initiated return flight.`]);

    this.broadcastToAdmin('ORDER_DELIVERED', {
      orderId: order.id,
      customerOrderId,
      droneId: order.drone_id,
      missionId: order.mission_id,
    });

    console.log(`✅ [TelemetryEngine] Order ${order.id} COMPLETED via OTP. Drone ${order.drone_id} returning to base.`);
  }
}

export const telemetryEngine = new TelemetryEngine();
