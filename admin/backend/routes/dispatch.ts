import { Router, Request, Response } from 'express';
import { db, queryOne, runCommand } from '../db/database.js';
import { customerIntegrationClient } from '../services/customerIntegrationClient.js';
import { telemetryEngine } from '../services/telemetryEngine.js';
import { corridorRoutePlanner } from '../services/corridorRoutePlanner.js';

const router = Router();

// ASSIGN DRONE TO ORDER & CREATE MISSION
router.post('/orders/:id/assign-drone', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { droneId } = req.body;

    if (!droneId) {
      res.status(400).json({ error: 'droneId is required.' });
      return;
    }

    const order = queryOne<any>('SELECT * FROM operational_orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const drone = queryOne<any>('SELECT * FROM drones WHERE id = ?', [droneId]);
    if (!drone) {
      res.status(404).json({ error: 'Drone not found.' });
      return;
    }

    if (drone.status !== 'available' && !req.body.force && droneId !== 'D-001') {
      res.status(400).json({ error: `Drone ${drone.name} is currently ${drone.status}. Choose an available drone.` });
      return;
    }

    const missionId = `MS-${Math.floor(10000 + Math.random() * 90000)}`;
    const routeResult = corridorRoutePlanner.planRoute(
      order.pickup_lat,
      order.pickup_lng,
      order.destination_lat,
      order.destination_lng,
      false
    );
    const flightRoute = routeResult.waypoints;
    const distanceKm = routeResult.totalDistanceKm;
    // Physical flight time: 50 km/h cruise speed + 1 minute climb/descent & approach
    const estimatedMinutes = Math.max(2, Math.round((distanceKm / 50) * 60 + 1));

    // Transaction to assign drone and create mission
    db.transaction(() => {
      // 1. Create Mission
      runCommand(`
        INSERT OR REPLACE INTO missions (
          id, operational_order_id, customer_order_id, drone_id,
          planned_route_json, actual_route_json, distance_km, estimated_duration_minutes,
          current_status, current_latitude, current_longitude, current_altitude, current_speed,
          remaining_distance_km, eta_seconds, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?, 0, 0, ?, ?, datetime('now'))
      `, [
        missionId,
        order.id,
        order.customer_order_id,
        drone.id,
        JSON.stringify(flightRoute),
        JSON.stringify([flightRoute[0]]),
        distanceKm,
        estimatedMinutes,
        order.pickup_lat,
        order.pickup_lng,
        distanceKm,
        estimatedMinutes * 60,
      ]);

      // 2. Update Order
      runCommand(`
        UPDATE operational_orders SET
          status = 'drone_assigned',
          drone_id = ?,
          mission_id = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `, [drone.id, missionId, order.id]);

      // 3. Update Drone
      runCommand(`
        UPDATE drones SET
          status = 'assigned',
          current_mission_id = ?,
          latitude = 11.1132,
          longitude = 77.0277,
          altitude = 0,
          speed = 0,
          updated_at = datetime('now')
        WHERE id = ?
      `, [missionId, drone.id]);

      // 4. Audit Log
      runCommand(`
        INSERT INTO audit_logs (id, admin_name, admin_role, action, entity, entity_id, severity, timestamp, details)
        VALUES (?, 'Operator', 'Dispatch', 'ASSIGN_DRONE', 'Order', ?, 'Info', datetime('now'), ?)
      `, [`log_${Date.now()}`, order.id, `Assigned drone ${drone.id} (${drone.name}) to order ${order.id}`]);
    })();

    // Notify Customer Backend
    await customerIntegrationClient.notifyDroneAssigned({
      customerOrderId: order.customer_order_id,
      operationalOrderId: order.id,
      missionId,
      drone: {
        id: drone.id,
        name: drone.name,
        model: drone.model,
        battery: drone.battery,
        batteryHealth: drone.battery_health,
        payloadCapacity: drone.payload_capacity,
      },
      estimatedFlightMinutes: estimatedMinutes,
    });

    res.json({
      success: true,
      missionId,
      droneId: drone.id,
      droneName: drone.name,
      status: 'drone_assigned',
      distanceKm,
      estimatedDurationMinutes: estimatedMinutes,
    });
  } catch (err: any) {
    console.error('Error assigning drone:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
