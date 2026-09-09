import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../db/database.js';

const router = Router();

// GET all fleet drones
router.get('/', (req: Request, res: Response) => {
  try {
    const drones = queryAll<any>('SELECT * FROM drones ORDER BY id ASC');
    const formatted = drones.map((d) => ({
      id: d.id,
      name: d.name,
      model: d.model,
      serialNumber: d.serial_number,
      registration: d.registration,
      status: d.status,
      battery: d.battery,
      batteryHealth: d.battery_health,
      batteryCycles: d.battery_cycles,
      payloadCapacity: d.payload_capacity,
      location: {
        lat: d.latitude,
        lng: d.longitude,
        altitude: d.altitude,
        heading: d.heading,
        speed: d.speed,
      },
      currentMissionId: d.current_mission_id,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single drone
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const drone = queryOne<any>('SELECT * FROM drones WHERE id = ?', [id]);
    if (!drone) {
      res.status(404).json({ error: 'Drone not found.' });
      return;
    }
    res.json(drone);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
