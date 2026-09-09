import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../db/database.js';
import { telemetryEngine } from '../services/telemetryEngine.js';

const router = Router();

// GET all missions
router.get('/', (req: Request, res: Response) => {
  try {
    const missions = queryAll<any>(`
      SELECT m.*, d.name as drone_name, d.model as drone_model, d.battery as drone_battery,
             o.customer_name, o.package_name, o.destination_address
      FROM missions m
      JOIN drones d ON d.id = m.drone_id
      JOIN operational_orders o ON o.id = m.operational_order_id
      ORDER BY m.created_at DESC
    `);

    const formatted = missions.map((m) => {
      let plannedRoute = [];
      let actualRoute = [];
      try {
        plannedRoute = JSON.parse(m.planned_route_json);
        actualRoute = JSON.parse(m.actual_route_json);
      } catch {}

      return {
        id: m.id,
        orderId: m.operational_order_id,
        customerOrderId: m.customer_order_id,
        customerName: m.customer_name,
        packageName: m.package_name,
        destinationAddress: m.destination_address,
        droneId: m.drone_id,
        droneName: m.drone_name,
        droneModel: m.drone_model,
        droneBattery: m.drone_battery,
        distanceKm: m.distance_km,
        estimatedDurationMinutes: m.estimated_duration_minutes,
        currentStatus: m.current_status,
        currentCoords: {
          lat: m.current_latitude,
          lng: m.current_longitude,
          altitude: m.current_altitude,
          speed: m.current_speed,
        },
        remainingDistanceKm: m.remaining_distance_km,
        etaSeconds: m.eta_seconds,
        plannedRoute,
        actualRoute,
        createdAt: m.created_at,
        startTime: m.start_time,
        completionTime: m.completion_time,
      };
    });

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single mission
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const mission = queryOne<any>('SELECT * FROM missions WHERE id = ?', [id]);
    if (!mission) {
      res.status(404).json({ error: 'Mission not found.' });
      return;
    }
    res.json(mission);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// LAUNCH MISSION
router.post('/:id/launch', (req: Request, res: Response): void => {
  try {
    const id = req.params.id as string;
    const mission = queryOne<any>('SELECT * FROM missions WHERE id = ?', [id]);
    if (!mission) {
      res.status(404).json({ error: 'Mission not found.' });
      return;
    }

    // Launch authoritative flight loop in telemetryEngine
    telemetryEngine.launchMission(id);

    res.json({
      success: true,
      missionId: id,
      status: 'in_flight',
      message: 'Mission launched successfully. Authoritative flight loop active.',
    });
  } catch (err: any) {
    console.error('Error launching mission:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
