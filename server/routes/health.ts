import { Router } from 'express';
import { queryOne } from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const dbTest = queryOne("SELECT datetime('now') as server_time, 1 as active");
    res.json({
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbTest?.active === 1 ? 'connected' : 'disconnected',
      serverTime: dbTest?.server_time,
      version: '1.0.0',
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'error',
      error: String(err),
    });
  }
});

export default router;
