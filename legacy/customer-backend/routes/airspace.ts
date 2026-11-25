import { Router, Request, Response } from 'express';
import { airspaceService } from '../services/airspaceService.js';
import { queryAll } from '../db/database.js';

const router = Router();

// GET /api/airspace/zones - Returns active No-Fly Zones and Fulfillment Hubs
router.get('/zones', (req: Request, res: Response) => {
  try {
    const noFlyZones = airspaceService.getNoFlyZones();
    const hubs = queryAll<any>("SELECT id, name, hub_name, hub_latitude, hub_longitude, radius_km, status FROM delivery_zones WHERE status = 'ACTIVE'");

    res.json({
      zones: noFlyZones,
      hubs: hubs || [],
      metadata: {
        totalNoFlyZones: noFlyZones.length,
        authority: 'FAA Part 107 Airspace Operations & SkyNav Safety Directive',
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Error fetching airspace zones:', err);
    res.status(500).json({ error: 'Failed to retrieve airspace zones.' });
  }
});

// POST /api/airspace/validate - Authoritatively evaluates a drop zone
router.post('/validate', (req: Request, res: Response): void => {
  try {
    const { latitude, longitude, clearanceRadiusMeters } = req.body;

    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: 'Latitude and Longitude coordinates are required.' });
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const clearance = Number(clearanceRadiusMeters) || 3.5;

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'Invalid coordinate format.' });
      return;
    }

    const evaluation = airspaceService.evaluateDropZone(lat, lng, clearance);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Airspace dropzone validation error:', err);
    res.status(500).json({ error: 'Failed to evaluate airspace safety.' });
  }
});

export default router;
