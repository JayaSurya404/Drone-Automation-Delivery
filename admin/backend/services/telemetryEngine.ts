import { WebSocket } from 'ws';
import { db, queryOne, queryAll, runCommand } from '../db/database.js';
import { customerIntegrationClient } from './customerIntegrationClient.js';
import { CustomerOrderStatus } from '../../../shared/contracts/types.js';
import { corridorRoutePlanner } from './corridorRoutePlanner.js';

// Physical Simulation Kinematic Constants
const CRUISE_SPEED_MS = 50 / 3.6;     // 50 km/h = ~13.8889 m/s
const MAX_ACCEL_MS2 = 2.0;            // 2.0 m/s^2 horizontal acceleration
const MAX_DECEL_MS2 = 1.8;            // 1.8 m/s^2 approach deceleration
const CLIMB_RATE_MS = 3.5;            // 3.5 m/s climb rate
const DESCENT_RATE_MS = 2.5;          // 2.5 m/s descent rate
const CRUISE_ALTITUDE_M = 45;         // 45 meters cruising altitude
const RETURN_ALTITUDE_M = 40;         // 40 meters return airway altitude
const TOUCHDOWN_SPEED_MS = 1.2;       // 1.2 m/s touchdown approach speed

interface ActiveMissionState {
  missionId: string;
  orderId: string;
  customerOrderId: string;
  droneId: string;
  droneName: string;
  route: [number, number][];
  totalDistanceMeters: number;
  distanceTraveledMeters: number;
  currentVelocityMs: number;
  currentAltitudeM: number;
  destCoords: [number, number];
  hubCoords: [number, number];
  isTouchdown: boolean;
  flightPhase: 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'TOUCHDOWN';
}

interface ActiveReturnFlight {
  droneId: string;
  droneName: string;
  missionId: string;
  orderId: string;
  customerOrderId: string;
  returnRoute: [number, number][];
  totalDistanceMeters: number;
  distanceTraveledMeters: number;
  currentVelocityMs: number;
  currentAltitudeM: number;
  hubCoords: [number, number];
  hubName: string;
  flightPhase: 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'DOCKING';
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
  private latestGazeboTelemetry: any = null;

  constructor() {
    this.startTicker();
  }

  public registerAdminWs(ws: WebSocket) {
    this.adminWsClients.add(ws);
    // Send immediate snapshot of fleet
    const drones = queryAll('SELECT * FROM drones');
    const missions = queryAll("SELECT * FROM missions WHERE current_status IN ('in_flight', 'approaching', 'touchdown')");
    ws.send(JSON.stringify({ type: 'FLEET_SNAPSHOT', data: { drones, missions } }));

    ws.on('close', () => {
      this.adminWsClients.delete(ws);
    });
  }

  public broadcastToAdmin(event: string, data: any) {
    const message = JSON.stringify({ type: event, data });
    for (const client of this.adminWsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  // Calculate distance between two lat/lng coordinates in km (Haversine)
  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(4));
  }

  // Calculate total polyline distance in meters
  public calculateRouteDistanceMeters(route: [number, number][]): number {
    let meters = 0;
    for (let i = 0; i < route.length - 1; i++) {
      meters += this.calculateDistanceKm(route[i][0], route[i][1], route[i + 1][0], route[i + 1][1]) * 1000;
    }
    return Math.max(10, meters);
  }

  // Calculate bearing in degrees
  public calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
    return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
  }

  // Sample exact coordinate and bearing along polyline at distance s meters
  public sampleRouteAtDistance(
    route: [number, number][],
    targetDistanceMeters: number
  ): { coord: [number, number]; bearing: number } {
    if (route.length === 0) return { coord: [11.1132, 77.0277], bearing: 0 };
    if (route.length === 1 || targetDistanceMeters <= 0) {
      const bearing = route.length > 1 ? this.calculateBearing(route[0][0], route[0][1], route[1][0], route[1][1]) : 0;
      return { coord: route[0], bearing };
    }

    let accumulated = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const p1 = route[i];
      const p2 = route[i + 1];
      const segDist = this.calculateDistanceKm(p1[0], p1[1], p2[0], p2[1]) * 1000;
      if (accumulated + segDist >= targetDistanceMeters || i === route.length - 2) {
        const segFraction = segDist > 0 ? Math.min(1, Math.max(0, (targetDistanceMeters - accumulated) / segDist)) : 0;
        const lat = p1[0] + (p2[0] - p1[0]) * segFraction;
        const lng = p1[1] + (p2[1] - p1[1]) * segFraction;
        const bearing = this.calculateBearing(p1[0], p1[1], p2[0], p2[1]);
        return { coord: [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))], bearing };
      }
      accumulated += segDist;
    }

    const last = route[route.length - 1];
    const secondLast = route[route.length - 2] || last;
    return { coord: last, bearing: this.calculateBearing(secondLast[0], secondLast[1], last[0], last[1]) };
  }

  // Generate non-straight obstacle-clearing airway route using real geographic geometry
  public generateFlightRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    isReturn: boolean = false
  ): [number, number][] {
    const plan = corridorRoutePlanner.planRoute(startLat, startLng, endLat, endLng, isReturn);
    return plan.waypoints;
  }

  // Start authoritative mission flight loop
  public launchMission(missionId: string) {
    const mission = queryOne<any>(`
      SELECT m.*, o.customer_order_id, o.pickup_lat, o.pickup_lng, o.destination_lat, o.destination_lng, d.name as drone_name
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

    const startLat = this.latestGazeboTelemetry?.latitude || mission.pickup_lat || 11.1132;
    const startLng = this.latestGazeboTelemetry?.longitude || mission.pickup_lng || 77.0277;
    const destLat = mission.destination_lat || 11.0725;
    const destLng = mission.destination_lng || 77.0345;

    if (route.length === 0) {
      route = this.generateFlightRoute(startLat, startLng, destLat, destLng, false);
    } else {
      route[0] = [startLat, startLng];
    }

    const hubCoords: [number, number] = [startLat, startLng];
    const destCoords: [number, number] = [destLat, destLng];
    const totalDistanceMeters = this.calculateRouteDistanceMeters(route);

    runCommand(`
      UPDATE missions SET
        current_status = 'in_flight',
        start_time = datetime('now'),
        current_latitude = ?,
        current_longitude = ?,
        current_altitude = 2,
        current_speed = 0
      WHERE id = ?
    `, [hubCoords[0], hubCoords[1], missionId]);

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
        latitude = ?,
        longitude = ?,
        altitude = 2,
        speed = 0,
        updated_at = datetime('now')
      WHERE id = ?
    `, [missionId, hubCoords[0], hubCoords[1], mission.drone_id]);

    const state: ActiveMissionState = {
      missionId,
      orderId: mission.operational_order_id,
      customerOrderId: mission.customer_order_id,
      droneId: mission.drone_id,
      droneName: mission.drone_name || 'SkyNav X1',
      route,
      totalDistanceMeters,
      distanceTraveledMeters: 0,
      currentVelocityMs: 0,
      currentAltitudeM: 2,
      destCoords,
      hubCoords,
      isTouchdown: false,
      flightPhase: 'TAKEOFF',
    };

    this.activeMissions.set(missionId, state);

    // Initial broadcast to Admin WS
    this.broadcastToAdmin('DRONE_STATUS_CHANGED', {
      droneId: mission.drone_id,
      status: 'in_flight',
      latitude: hubCoords[0],
      longitude: hubCoords[1],
      altitude: 2,
      speed: 0,
      message: `Drone ${mission.drone_id} takeoff authorized. Initiating physical climb along Kurumbapalayam corridor.`,
    });

    // Notify Customer Backend that mission is launched
    customerIntegrationClient.notifyMissionLaunched({
      customerOrderId: mission.customer_order_id,
      operationalOrderId: mission.operational_order_id,
      missionId,
      droneId: mission.drone_id,
      droneName: mission.drone_name,
      plannedRoute: route,
      distanceKm: parseFloat((totalDistanceMeters / 1000).toFixed(3)),
      estimatedDurationMins: Math.max(2, Math.round((totalDistanceMeters / 1000 / 50) * 60 + 1)),
      launchedAt: new Date().toISOString(),
    });

    // Command Gazebo Bridge to initiate physical flight
    try {
      const bridgeUrl = process.env.GAZEBO_BRIDGE_URL || 'http://127.0.0.1:8085';
      fetch(`${bridgeUrl}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_mission', missionId }),
        signal: AbortSignal.timeout(1000),
      }).catch(() => {});
    } catch {}

    console.log(`🚀 [TelemetryEngine] Mission ${missionId} launched. Physical kinematic simulation active over ${parseFloat((totalDistanceMeters / 1000).toFixed(2))} km.`);
  }

  private nativeGazeboConfirmed: boolean = false;

  private isTicking: boolean = false;

  private async fetchGazeboTelemetry(): Promise<any | null> {
    try {
      const bridgeUrl = process.env.GAZEBO_BRIDGE_URL || 'http://127.0.0.1:8085';
      const res = await fetch(`${bridgeUrl}/telemetry`, { signal: AbortSignal.timeout(800) });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private startTicker() {
    this.tickerInterval = setInterval(async () => {
      if (this.isTicking) return;
      this.isTicking = true;
      try {
        await this.tick();
      } catch (err) {
        console.error('Error in telemetryEngine tick:', err);
      } finally {
        this.isTicking = false;
      }
    }, 100); // 10 Hz authoritative physical simulation tick (100ms)
  }

  private async tick() {
    const nowIso = new Date().toISOString();

    // ── Check if Native Gazebo Simulation is Active (SOLE PHYSICAL AUTHORITY) ──
    const gazeboTelemetry = await this.fetchGazeboTelemetry();
    if (gazeboTelemetry && gazeboTelemetry.isNativeGazeboRunning && gazeboTelemetry.simulationMode === 'REAL_GAZEBO_MODE') {
      this.nativeGazeboConfirmed = true;
      this.latestGazeboTelemetry = gazeboTelemetry;
      const gzLat = gazeboTelemetry.latitude;
      const gzLng = gazeboTelemetry.longitude;
      const gzAlt = gazeboTelemetry.altitudeAgl;
      const gzSpeed = gazeboTelemetry.speedKmh;
      const gzBearing = gazeboTelemetry.attitude?.yawDeg ?? 185;
      const gzBattery = gazeboTelemetry.sensors?.battery ?? 100;
      const gzPhase = gazeboTelemetry.flightPhase;
      const gzObstacle = gazeboTelemetry.obstacleAvoidance;
      const gzSimTime = gazeboTelemetry.simTime;

      // ── Unconditionally update physical Gazebo drone D-001 in SQLite database ──
      let statusStr = 'available';
      if (gzPhase === 'CHARGING') statusStr = 'charging';
      else if (gzPhase === 'AVAILABLE') statusStr = 'available';
      else if (gzPhase === 'TOUCHDOWN') statusStr = 'assigned';
      else if (gzPhase === 'RETURNING') statusStr = 'returning';
      else if (['TAKEOFF', 'CLIMB', 'CRUISE', 'AVOIDANCE', 'DESCENT'].includes(gzPhase)) statusStr = 'in_flight';

      runCommand(`
        UPDATE drones SET
          latitude = ?,
          longitude = ?,
          altitude = ?,
          heading = ?,
          speed = ?,
          battery = ?,
          status = ?,
          updated_at = datetime('now')
        WHERE id = 'D-001'
      `, [gzLat, gzLng, gzAlt, gzBearing, gzSpeed, gzBattery, statusStr]);

      // Stream Gazebo telemetry to Customer backend for active or recent delivery
      const activeOps = queryAll<any>(`
        SELECT o.customer_order_id, o.id as operational_order_id, m.id as mission_id, o.destination_lat, o.destination_lng
        FROM operational_orders o
        LEFT JOIN missions m ON m.operational_order_id = o.id
        WHERE (o.drone_id = 'D-001' OR o.drone_id IS NULL)
        ORDER BY o.created_at DESC LIMIT 1
      `);
      for (const op of activeOps) {
        const destLat = op.destination_lat || 11.1042;
        const destLng = op.destination_lng || 77.028112;
        const remKm = this.calculateDistanceKm(gzLat, gzLng, destLat, destLng);
        customerIntegrationClient.sendTelemetryUpdate({
          customerOrderId: op.customer_order_id,
          missionId: op.mission_id || 'MS-GAZEBO',
          droneId: 'D-001',
          droneName: 'SkyNav X1',
          status: gzPhase === 'TOUCHDOWN' ? 'Arriving' : (['RETURNING', 'CHARGING', 'AVAILABLE'].includes(gzPhase) ? 'Delivered' : 'Out for Delivery'),
          currentLocation: {
            latitude: gzLat,
            longitude: gzLng,
            altitudeMeters: gzAlt,
            speedKmh: gzSpeed,
            bearing: gzBearing,
          },
          remainingDistanceKm: remKm,
          estimatedArrivalMins: Math.max(1, Math.ceil((remKm * 1000) / Math.max(2.0, gzSpeed / 3.6) / 60)),
          progressPercent: Math.min(100, Math.max(0, Math.round((1.0 - Math.min(1.0, remKm)) * 100))),
          timestamp: nowIso,
        });
      }

      // 1. Authoritative Gazebo Outbound Mission Processing
      for (const [missionId, state] of this.activeMissions.entries()) {
        const remainingKm = this.calculateDistanceKm(gzLat, gzLng, state.destCoords[0], state.destCoords[1]);
        const remainingMeters = remainingKm * 1000;
        const progress = Math.min(100, Math.max(0, parseFloat((((state.totalDistanceMeters - remainingMeters) / state.totalDistanceMeters) * 100).toFixed(1))));
        const effectiveSpeedMs = Math.max(2.0, gzSpeed / 3.6);
        const etaSeconds = Math.round(remainingMeters / effectiveSpeedMs);
        const etaMins = Math.max(1, Math.ceil(etaSeconds / 60));

        if (gzPhase === 'TOUCHDOWN' || remainingMeters <= 15) {
          if (!state.isTouchdown) {
            state.isTouchdown = true;
            state.flightPhase = 'TOUCHDOWN';

            runCommand(`
              UPDATE missions SET
                current_status = 'approaching',
                current_latitude = ?,
                current_longitude = ?,
                current_altitude = 0,
                current_speed = 0,
                remaining_distance_km = 0,
                eta_seconds = 0
              WHERE id = ?
            `, [gzLat, gzLng, missionId]);

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
                battery = ?,
                status = 'assigned',
                updated_at = datetime('now')
              WHERE id = ?
            `, [gzLat, gzLng, gzBattery, state.droneId]);

            this.broadcastToAdmin('MISSION_TOUCHDOWN', {
              missionId,
              orderId: state.orderId,
              droneId: state.droneId,
              coords: [gzLat, gzLng],
              status: 'TOUCHDOWN',
            });

            customerIntegrationClient.notifyDeliveryTouchdown({
              customerOrderId: state.customerOrderId,
              missionId,
              droneId: state.droneId,
              arrivedAt: nowIso,
              requiresOtp: false,
              message: 'Drone has touched down at your designated landing zone. Enter your Customer Delivery PIN to authorize package release.',
              latitude: gzLat,
              longitude: gzLng,
            });
          }
        } else {
          state.currentAltitudeM = gzAlt;
          state.currentVelocityMs = gzSpeed / 3.6;

          let customerStatus: CustomerOrderStatus = 'Out for Delivery';
          if (progress < 12) {
            customerStatus = 'Drone Launched';
          } else if (progress >= 80 && progress < 94) {
            customerStatus = 'Near Destination';
          } else if (progress >= 94) {
            customerStatus = 'Arriving';
          }

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
          `, [gzLat, gzLng, gzAlt, gzSpeed, gzBearing, remainingKm, etaSeconds, progress >= 94 ? 'approaching' : 'in_flight', missionId]);

          runCommand(`
            UPDATE drones SET
              latitude = ?,
              longitude = ?,
              altitude = ?,
              heading = ?,
              speed = ?,
              battery = ?,
              status = 'in_flight',
              updated_at = datetime('now')
            WHERE id = ?
          `, [gzLat, gzLng, gzAlt, gzBearing, gzSpeed, gzBattery, state.droneId]);

          customerIntegrationClient.sendTelemetryUpdate({
            customerOrderId: state.customerOrderId,
            missionId,
            droneId: state.droneId,
            droneName: state.droneName,
            status: customerStatus,
            currentLocation: {
              latitude: gzLat,
              longitude: gzLng,
              altitudeMeters: gzAlt,
              speedKmh: gzSpeed,
              bearing: gzBearing,
            },
            remainingDistanceKm: remainingKm,
            estimatedArrivalMins: etaMins,
            progressPercent: progress,
            timestamp: nowIso,
          });
        }

        this.broadcastToAdmin('TELEMETRY_UPDATE', {
          missionId,
          orderId: state.orderId,
          droneId: state.droneId,
          currentLocation: {
            latitude: gzLat,
            longitude: gzLng,
            altitudeMeters: gzAlt,
            speedKmh: gzSpeed,
            bearing: gzBearing,
          },
          battery: gzBattery,
          latitude: gzLat,
          longitude: gzLng,
          altitude: gzAlt,
          speed: gzSpeed,
          heading: gzBearing,
          remainingDistanceKm: remainingKm,
          remainingKm,
          estimatedArrivalMins: etaMins,
          progressPercent: progress,
          status: state.flightPhase,
          flightPhase: gzPhase,
          obstacleAvoidance: gzObstacle,
          simTime: gzSimTime,
        });
      }

      // 2. Authoritative Gazebo Return Flight Processing
      for (const [droneId, ret] of this.activeReturnFlights.entries()) {
        const remainingKm = this.calculateDistanceKm(gzLat, gzLng, ret.hubCoords[0], ret.hubCoords[1]);
        const remainingMeters = remainingKm * 1000;
        const progress = Math.min(100, Math.max(0, parseFloat((((ret.totalDistanceMeters - remainingMeters) / ret.totalDistanceMeters) * 100).toFixed(1))));

        if (gzPhase === 'AVAILABLE' || gzPhase === 'CHARGING' || (gzPhase === 'RETURNING' && remainingMeters <= 15 && gzAlt <= 1.0)) {
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
          `, [ret.hubCoords[0], ret.hubCoords[1], droneId]);

          this.broadcastToAdmin('DRONE_STATUS_CHANGED', {
            droneId,
            status: 'charging',
            latitude: ret.hubCoords[0],
            longitude: ret.hubCoords[1],
            altitude: 0,
            speed: 0,
            message: `Drone ${droneId} safely docked at ${ret.hubName} charging bay. Return flight concluded.`,
          });

          if (ret.customerOrderId) {
            customerIntegrationClient.sendTelemetryUpdate({
              customerOrderId: ret.customerOrderId,
              missionId: ret.missionId,
              droneId: ret.droneId,
              droneName: ret.droneName,
              status: 'Delivered',
              currentLocation: {
                latitude: ret.hubCoords[0],
                longitude: ret.hubCoords[1],
                altitudeMeters: 0,
                speedKmh: 0,
                bearing: 0,
              },
              remainingDistanceKm: 0,
              estimatedArrivalMins: 0,
              progressPercent: 100,
              timestamp: nowIso,
            });
          }

          this.chargingDrones.set(droneId, {
            droneId,
            targetBattery: 100,
            ticksCharging: 0,
          });

          this.activeReturnFlights.delete(droneId);
        } else {
          runCommand(`
            UPDATE drones SET
              latitude = ?,
              longitude = ?,
              altitude = ?,
              heading = ?,
              speed = ?,
              battery = ?,
              status = 'returning',
              updated_at = datetime('now')
            WHERE id = ?
          `, [gzLat, gzLng, gzAlt, gzBearing, gzSpeed, gzBattery, droneId]);

          this.broadcastToAdmin('TELEMETRY_UPDATE', {
            missionId: ret.missionId,
            orderId: ret.orderId,
            droneId: ret.droneId,
            currentLocation: {
              latitude: gzLat,
              longitude: gzLng,
              altitudeMeters: gzAlt,
              speedKmh: gzSpeed,
              bearing: gzBearing,
            },
            battery: gzBattery,
            latitude: gzLat,
            longitude: gzLng,
            altitude: gzAlt,
            speed: gzSpeed,
            heading: gzBearing,
            remainingDistanceKm: remainingKm,
            remainingKm,
            progressPercent: progress,
            status: 'RETURNING',
            flightPhase: gzPhase,
            isReturning: true,
            simTime: gzSimTime,
          });

          if (ret.customerOrderId) {
            customerIntegrationClient.sendTelemetryUpdate({
              customerOrderId: ret.customerOrderId,
              missionId: ret.missionId,
              droneId: ret.droneId,
              droneName: ret.droneName,
              status: 'Delivered',
              currentLocation: {
                latitude: gzLat,
                longitude: gzLng,
                altitudeMeters: gzAlt,
                speedKmh: gzSpeed,
                bearing: gzBearing,
              },
              remainingDistanceKm: remainingKm,
              estimatedArrivalMins: Math.round((remainingKm / 50) * 60),
              progressPercent: progress,
              timestamp: nowIso,
            });
          }
        }
      }

      // 3. Hub Charging Cycle Loop
      for (const [droneId, charge] of this.chargingDrones.entries()) {
        charge.ticksCharging++;
        const drone = queryOne<any>('SELECT battery FROM drones WHERE id = ?', [droneId]);
        const currentBattery = drone ? drone.battery : 70;
        const newBattery = Math.min(100, currentBattery + 5);
        const nextStatus = newBattery >= 100 ? 'available' : 'charging';

        runCommand(`
          UPDATE drones SET battery = ?, status = ?, updated_at = datetime('now') WHERE id = ?
        `, [newBattery, nextStatus, droneId]);

        this.broadcastToAdmin('DRONE_BATTERY_UPDATE', { droneId, battery: newBattery, status: nextStatus });

        if (newBattery >= 100) {
          this.broadcastToAdmin('DRONE_STATUS_CHANGED', {
            droneId,
            status: 'available',
            message: `Drone ${droneId} fully recharged and ready for next autonomous mission.`,
          });
          this.chargingDrones.delete(droneId);
        }
      }

      return; // Handled authoritatively via Native Gazebo!
    }

    // If native Gazebo is confirmed active, never run duplicate fallback trajectory
    if (this.nativeGazeboConfirmed || process.env.SKYNAV_SIM_MODE === 'REAL_GAZEBO_MODE') {
      return;
    }

    // ── FALLBACK KINEMATIC SIMULATION (Used only if native Gazebo is offline) ──
    const timeCompressionEnv = parseFloat(process.env.SIM_TIME_COMPRESSION || '1.0');
    const dt = 1.0 * (isNaN(timeCompressionEnv) || timeCompressionEnv <= 0 ? 1.0 : timeCompressionEnv);

    // ── 1. Outbound Mission Flight Loop (Physical Kinematics) ──
    for (const [missionId, state] of this.activeMissions.entries()) {

      // If already touched down at destination, keep holding position at drop zone awaiting Delivery PIN
      if (state.isTouchdown) {
        continue;
      }

      const remainingMeters = Math.max(0, state.totalDistanceMeters - state.distanceTraveledMeters);
      const remainingKm = parseFloat((remainingMeters / 1000).toFixed(3));
      const approachDecelDistance = 140; // meters before destination to initiate descent & deceleration

      // Check arrival condition: remaining distance <= 12 meters OR traveled full length
      if (state.distanceTraveledMeters >= state.totalDistanceMeters || remainingMeters <= 12) {
        state.distanceTraveledMeters = state.totalDistanceMeters;
        state.isTouchdown = true;
        state.flightPhase = 'TOUCHDOWN';
        state.currentVelocityMs = 0;
        state.currentAltitudeM = 0;

        const destCoord = state.destCoords;
        const secondLast = state.route[state.route.length - 2] || destCoord;
        const bearing = this.calculateBearing(secondLast[0], secondLast[1], destCoord[0], destCoord[1]);

        // 1. Update Database
        runCommand(`
          UPDATE missions SET
            current_status = 'approaching',
            current_latitude = ?,
            current_longitude = ?,
            current_altitude = 0,
            current_speed = 0,
            remaining_distance_km = 0,
            eta_seconds = 0
          WHERE id = ?
        `, [destCoord[0], destCoord[1], missionId]);

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
        `, [destCoord[0], destCoord[1], state.droneId]);

        const currentDrone = queryOne<any>('SELECT battery FROM drones WHERE id = ?', [state.droneId]);
        const battery = currentDrone?.battery ?? 70;

        // 2. Broadcast Final Touchdown Telemetry to Admin WS
        this.broadcastToAdmin('TELEMETRY_UPDATE', {
          missionId,
          orderId: state.orderId,
          droneId: state.droneId,
          currentLocation: {
            latitude: destCoord[0],
            longitude: destCoord[1],
            altitudeMeters: 0,
            speedKmh: 0,
            bearing,
          },
          battery,
          latitude: destCoord[0],
          longitude: destCoord[1],
          altitude: 0,
          speed: 0,
          heading: bearing,
          remainingDistanceKm: 0,
          remainingKm: 0,
          estimatedArrivalMins: 0,
          progressPercent: 100,
          status: 'TOUCHDOWN',
          flightPhase: 'TOUCHDOWN',
          isCompleted: false,
        });

        this.broadcastToAdmin('MISSION_TOUCHDOWN', {
          missionId,
          orderId: state.orderId,
          droneId: state.droneId,
          coords: destCoord,
          status: 'TOUCHDOWN',
        });

        // 3. Notify Customer Backend: Touchdown + Awaiting Permanent Delivery PIN
        customerIntegrationClient.notifyDeliveryTouchdown({
          customerOrderId: state.customerOrderId,
          missionId,
          droneId: state.droneId,
          arrivedAt: nowIso,
          requiresOtp: false,
          message: 'Drone has touched down at your designated landing zone. Enter your Customer Delivery PIN to authorize package release.',
        });

        customerIntegrationClient.notifyTelemetryMilestone({
          customerOrderId: state.customerOrderId,
          missionId,
          droneId: state.droneId,
          droneName: state.droneName,
          status: 'Arriving',
          currentLocation: {
            latitude: destCoord[0],
            longitude: destCoord[1],
            altitudeMeters: 0,
            speedKmh: 0,
            bearing,
          },
          remainingDistanceKm: 0,
          estimatedArrivalMins: 0,
          progressPercent: 100,
          timestamp: nowIso,
        });

        console.log(`🎯 [TelemetryEngine] Mission ${missionId} TOUCHDOWN at destination [${destCoord[0]}, ${destCoord[1]}]. Holding position for Customer Delivery PIN.`);
        continue;
      }

      // ── Physical Kinematic Integration ──
      if (remainingMeters <= approachDecelDistance) {
        // Approach & Landing Phase: decelerate to touchdown speed and descend
        state.flightPhase = 'DESCENT';
        const targetApproachSpeed = Math.max(TOUCHDOWN_SPEED_MS, Math.sqrt(2 * MAX_DECEL_MS2 * Math.max(1, remainingMeters)));
        state.currentVelocityMs = Math.max(targetApproachSpeed, state.currentVelocityMs - MAX_DECEL_MS2 * dt);
        state.currentAltitudeM = Math.max(0.5, state.currentAltitudeM - DESCENT_RATE_MS * dt);
      } else {
        // Takeoff / Climb / Cruise Phase
        state.currentVelocityMs = Math.min(CRUISE_SPEED_MS, state.currentVelocityMs + MAX_ACCEL_MS2 * dt);
        if (state.currentAltitudeM < CRUISE_ALTITUDE_M) {
          state.flightPhase = 'CLIMB';
          state.currentAltitudeM = Math.min(CRUISE_ALTITUDE_M, state.currentAltitudeM + CLIMB_RATE_MS * dt);
        } else {
          state.flightPhase = 'CRUISE';
        }
      }

      // Advance distance traveled by velocity * dt
      const stepDistance = state.currentVelocityMs * dt;
      state.distanceTraveledMeters += stepDistance;

      // Sample exact geographic position and bearing along non-straight airway
      const { coord: currentCoord, bearing } = this.sampleRouteAtDistance(state.route, state.distanceTraveledMeters);
      const progress = Math.min(99.9, (state.distanceTraveledMeters / state.totalDistanceMeters) * 100);
      const currentSpeedKmh = Math.round(state.currentVelocityMs * 3.6);
      const currentAltitudeM = Math.round(state.currentAltitudeM);

      // True physical ETA based on remaining distance and current velocity
      const effectiveSpeedMs = Math.max(3.0, state.currentVelocityMs);
      const physicalEtaSeconds = Math.round(remainingMeters / effectiveSpeedMs);
      const etaMins = Math.max(1, Math.ceil(physicalEtaSeconds / 60));

      let customerStatus: CustomerOrderStatus = 'Out for Delivery';
      if (progress < 12) {
        customerStatus = 'Drone Launched';
      } else if (progress >= 80 && progress < 94) {
        customerStatus = 'Near Destination';
      } else if (progress >= 94) {
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
      `, [currentCoord[0], currentCoord[1], currentAltitudeM, currentSpeedKmh, bearing, remainingKm, physicalEtaSeconds, progress >= 94 ? 'approaching' : 'in_flight', missionId]);

      runCommand(`
        UPDATE drones SET
          latitude = ?,
          longitude = ?,
          altitude = ?,
          heading = ?,
          speed = ?,
          battery = MAX(15, battery - 0.05),
          status = 'in_flight',
          updated_at = datetime('now')
        WHERE id = ?
      `, [currentCoord[0], currentCoord[1], currentAltitudeM, bearing, currentSpeedKmh, state.droneId]);

      const currentDrone = queryOne<any>('SELECT battery FROM drones WHERE id = ?', [state.droneId]);
      const battery = Math.round(currentDrone?.battery ?? 85);

      // 1. Broadcast 1Hz physical telemetry to Admin WebSocket
      this.broadcastToAdmin('TELEMETRY_UPDATE', {
        missionId,
        orderId: state.orderId,
        droneId: state.droneId,
        currentLocation: {
          latitude: currentCoord[0],
          longitude: currentCoord[1],
          altitudeMeters: currentAltitudeM,
          speedKmh: currentSpeedKmh,
          bearing,
        },
        battery,
        latitude: currentCoord[0],
        longitude: currentCoord[1],
        altitude: currentAltitudeM,
        speed: currentSpeedKmh,
        heading: bearing,
        remainingDistanceKm: remainingKm,
        remainingKm,
        estimatedArrivalMins: etaMins,
        progressPercent: parseFloat(progress.toFixed(1)),
        status: customerStatus,
        flightPhase: state.flightPhase,
        isCompleted: false,
      });

      // 2. Synchronized 1Hz Telemetry to Customer Backend
      customerIntegrationClient.notifyTelemetryMilestone({
        customerOrderId: state.customerOrderId,
        missionId,
        droneId: state.droneId,
        droneName: state.droneName,
        status: customerStatus,
        currentLocation: {
          latitude: currentCoord[0],
          longitude: currentCoord[1],
          altitudeMeters: currentAltitudeM,
          speedKmh: currentSpeedKmh,
          bearing,
        },
        remainingDistanceKm: remainingKm,
        estimatedArrivalMins: etaMins,
        progressPercent: parseFloat(progress.toFixed(1)),
        timestamp: nowIso,
      });

      // 3. Synchronized 1Hz Telemetry to Gazebo SITL Bridge (Port 8085)
      this.syncWithGazeboBridge({
        latitude: currentCoord[0],
        longitude: currentCoord[1],
        altitude: currentAltitudeM,
        speed: currentSpeedKmh,
        heading: bearing,
      });
    }

    // ── 2. Return-To-Hub Flight Loop (Dedicated Eastbound Airway Kinematics) ──
    for (const [droneId, ret] of this.activeReturnFlights.entries()) {
      const remainingMeters = Math.max(0, ret.totalDistanceMeters - ret.distanceTraveledMeters);
      const remainingKm = parseFloat((remainingMeters / 1000).toFixed(3));
      const hubCoord = ret.hubCoords;

      if (ret.distanceTraveledMeters >= ret.totalDistanceMeters || remainingMeters <= 12) {
        ret.distanceTraveledMeters = ret.totalDistanceMeters;
        ret.currentVelocityMs = 0;
        ret.currentAltitudeM = 0;
        ret.flightPhase = 'DOCKING';

        // Reached SkyHub Kurumbapalayam docking pad!
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

        console.log(`🔌 [TelemetryEngine] Drone ${droneId} docked at ${ret.hubName} (${hubCoord[0]}, ${hubCoord[1]}). HUB_DOCKING -> CHARGING.`);

        this.broadcastToAdmin('DRONE_STATUS_CHANGED', {
          droneId,
          status: 'charging',
          latitude: hubCoord[0],
          longitude: hubCoord[1],
          altitude: 0,
          speed: 0,
          message: `Drone ${droneId} safely docked at ${ret.hubName} charging bay. Return flight concluded.`,
        });

        this.broadcastToAdmin('TELEMETRY_UPDATE', {
          missionId: ret.missionId,
          orderId: ret.orderId,
          droneId: ret.droneId,
          currentLocation: {
            latitude: hubCoord[0],
            longitude: hubCoord[1],
            altitudeMeters: 0,
            speedKmh: 0,
            bearing: 0,
          },
          battery: queryOne<any>('SELECT battery FROM drones WHERE id = ?', [droneId])?.battery ?? 60,
          latitude: hubCoord[0],
          longitude: hubCoord[1],
          altitude: 0,
          speed: 0,
          heading: 0,
          remainingDistanceKm: 0,
          remainingKm: 0,
          progressPercent: 100,
          status: 'CHARGING',
          flightPhase: 'DOCKING',
          isReturning: false,
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

      // Return flight kinematics
      const approachDecelDistance = 140;
      if (remainingMeters <= approachDecelDistance) {
        ret.flightPhase = 'DESCENT';
        const targetApproachSpeed = Math.max(TOUCHDOWN_SPEED_MS, Math.sqrt(2 * MAX_DECEL_MS2 * Math.max(1, remainingMeters)));
        ret.currentVelocityMs = Math.max(targetApproachSpeed, ret.currentVelocityMs - MAX_DECEL_MS2 * dt);
        ret.currentAltitudeM = Math.max(0.5, ret.currentAltitudeM - DESCENT_RATE_MS * dt);
      } else {
        ret.currentVelocityMs = Math.min(CRUISE_SPEED_MS, ret.currentVelocityMs + MAX_ACCEL_MS2 * dt);
        if (ret.currentAltitudeM < RETURN_ALTITUDE_M) {
          ret.flightPhase = 'CLIMB';
          ret.currentAltitudeM = Math.min(RETURN_ALTITUDE_M, ret.currentAltitudeM + CLIMB_RATE_MS * dt);
        } else {
          ret.flightPhase = 'CRUISE';
        }
      }

      ret.distanceTraveledMeters += ret.currentVelocityMs * dt;

      const { coord: currentCoord, bearing } = this.sampleRouteAtDistance(ret.returnRoute, ret.distanceTraveledMeters);
      const progress = Math.min(99.9, (ret.distanceTraveledMeters / ret.totalDistanceMeters) * 100);
      const speedKmh = Math.round(ret.currentVelocityMs * 3.6);
      const altitudeM = Math.round(ret.currentAltitudeM);

      // Update Database
      runCommand(`
        UPDATE drones SET
          latitude = ?,
          longitude = ?,
          altitude = ?,
          heading = ?,
          speed = ?,
          battery = MAX(15, battery - 0.05),
          status = 'returning',
          updated_at = datetime('now')
        WHERE id = ?
      `, [currentCoord[0], currentCoord[1], altitudeM, bearing, speedKmh, droneId]);

      const currentDrone = queryOne<any>('SELECT battery FROM drones WHERE id = ?', [droneId]);

      // Broadcast return flight telemetry to Admin WebSocket
      this.broadcastToAdmin('TELEMETRY_UPDATE', {
        missionId: ret.missionId,
        orderId: ret.orderId,
        droneId: ret.droneId,
        currentLocation: {
          latitude: currentCoord[0],
          longitude: currentCoord[1],
          altitudeMeters: altitudeM,
          speedKmh: speedKmh,
          bearing,
        },
        battery: Math.round(currentDrone?.battery ?? 65),
        latitude: currentCoord[0],
        longitude: currentCoord[1],
        altitude: altitudeM,
        speed: speedKmh,
        heading: bearing,
        remainingDistanceKm: remainingKm,
        remainingKm,
        progressPercent: parseFloat(progress.toFixed(1)),
        status: 'RETURNING',
        flightPhase: ret.flightPhase,
        isReturning: true,
      });

      // Synchronize return flight telemetry to Gazebo SITL Bridge (Port 8085)
      this.syncWithGazeboBridge({
        latitude: currentCoord[0],
        longitude: currentCoord[1],
        altitude: altitudeM,
        speed: speedKmh,
        heading: bearing,
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

  // Bidirectional Synchronization with Gazebo Telemetry Bridge (Port 8085)
  private async syncWithGazeboBridge(droneTelemetry: {
    latitude: number;
    longitude: number;
    altitude: number;
    speed: number;
    heading: number;
  }) {
    try {
      const bridgeUrl = process.env.GAZEBO_BRIDGE_URL || 'http://127.0.0.1:8085';
      await fetch(`${bridgeUrl}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_telemetry',
          latitude: droneTelemetry.latitude,
          longitude: droneTelemetry.longitude,
          altitude: droneTelemetry.altitude,
          speed: droneTelemetry.speed,
          heading: droneTelemetry.heading,
        }),
        signal: AbortSignal.timeout(400),
      });
    } catch {
      // Bridge unreachable or offline; fallback simulation continues without disruption
    }
  }

  // Handle Permanent Delivery PIN Verified & Handover Completed from Customer Backend
  public completeDelivery(customerOrderId: string, verifiedPin: string = 'PIN_VERIFIED') {
    const order = queryOne<any>(`
      SELECT * FROM operational_orders WHERE customer_order_id = ?
    `, [customerOrderId]);

    if (!order) return;

    // Remove from active outbound missions if still present
    if (order.mission_id && this.activeMissions.has(order.mission_id)) {
      this.activeMissions.delete(order.mission_id);
    }

    runCommand(`
      UPDATE operational_orders SET
        status = 'delivered',
        updated_at = datetime('now')
      WHERE id = ?
    `, [order.id]);

    // Command Gazebo Bridge to initiate physical return flight
    try {
      const bridgeUrl = process.env.GAZEBO_BRIDGE_URL || 'http://127.0.0.1:8085';
      fetch(`${bridgeUrl}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_return' }),
        signal: AbortSignal.timeout(1000),
      }).catch(() => {});
    } catch {}

    if (order.mission_id) {
      runCommand(`
        UPDATE missions SET
          current_status = 'completed',
          completion_time = datetime('now')
        WHERE id = ?
      `, [order.mission_id]);

    }

    const targetDroneId = order.drone_id || 'D-001';
    const drone = queryOne<any>('SELECT * FROM drones WHERE id = ?', [targetDroneId]);
    const hubLat = order.pickup_lat || 11.1132;
    const hubLng = order.pickup_lng || 77.0277;
    const startLat = this.latestGazeboTelemetry?.latitude || order.destination_lat || 11.0725;
    const startLng = this.latestGazeboTelemetry?.longitude || order.destination_lng || 77.0345;

    // Plan non-straight dedicated Eastbound Return Airway
    const returnRouteResult = corridorRoutePlanner.planRoute(startLat, startLng, hubLat, hubLng, true);
    const returnRoute = returnRouteResult.waypoints;
    const totalDistanceMeters = this.calculateRouteDistanceMeters(returnRoute);

    runCommand(`
      UPDATE drones SET
        status = 'returning',
        current_mission_id = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [order.mission_id, targetDroneId]);

    // Register active return flight in engine
    this.activeReturnFlights.set(targetDroneId, {
      droneId: targetDroneId,
      droneName: drone?.name || 'SkyNav X1',
      missionId: order.mission_id || `MS-RET-${targetDroneId}`,
      orderId: order.id,
      customerOrderId,
      returnRoute,
      totalDistanceMeters,
      distanceTraveledMeters: 0,
      currentVelocityMs: 0,
      currentAltitudeM: 2,
      hubCoords: [hubLat, hubLng],
      hubName: 'SkyHub Kurumbapalayam',
      flightPhase: 'TAKEOFF',
    });

    this.broadcastToAdmin('DRONE_STATUS_CHANGED', {
      droneId: targetDroneId,
      status: 'returning',
      latitude: startLat,
      longitude: startLng,
      altitude: 2,
      speed: 0,
      message: `Delivery confirmed via Customer Delivery PIN. Drone ${targetDroneId} ascending and initiating return flight to SkyHub Kurumbapalayam along East Airway.`,
    });

    runCommand(`
      INSERT INTO audit_logs (id, admin_name, admin_role, action, entity, entity_id, severity, timestamp, details)
      VALUES (?, 'System', 'Autonomous Dispatch', 'DELIVERY_COMPLETED', 'Order', ?, 'Info', datetime('now'), ?)
    `, [`log_${Date.now()}`, order.id, `Delivery completed and verified via Customer Delivery PIN (${verifiedPin}). Drone initiated return flight.`]);

    this.broadcastToAdmin('ORDER_DELIVERED', {
      orderId: order.id,
      customerOrderId,
      droneId: order.drone_id,
      missionId: order.mission_id,
    });

    console.log(`✅ [TelemetryEngine] Order ${order.id} COMPLETED via Delivery PIN. Drone ${order.drone_id} returning to SkyHub Kurumbapalayam along East Airway.`);
  }
}

export const telemetryEngine = new TelemetryEngine();
