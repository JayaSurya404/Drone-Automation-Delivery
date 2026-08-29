import { Router, Response } from 'express';
import { queryOne } from '../db/database.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { droneTrackingService } from '../services/droneTrackingService.js';

const router = Router();

// 1. GET TRACKING SNAPSHOT (AUTHENTICATED & ISOLATED)
router.get('/:orderId', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.id;

    // Verify order exists and belongs to this user
    const order = queryOne<any>('SELECT customer_id FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    if (order.customer_id !== userId) {
      res.status(403).json({ error: 'Unauthorized: You can only track your own deliveries.' });
      return;
    }

    const snapshot = droneTrackingService.getTrackingSnapshot(orderId);
    if (!snapshot) {
      res.status(404).json({ error: 'Delivery tracking information not available.' });
      return;
    }

    res.json(snapshot);
  } catch (err) {
    console.error('Tracking snapshot error:', err);
    res.status(500).json({ error: 'Failed to fetch tracking data.' });
  }
});

// 2. REALTIME SERVER-SENT EVENTS (SSE) STREAM FOR LIVE TELEMETRY
router.get('/:orderId/events', (req, res): void => {
  const { orderId } = req.params;
  const token = req.query.token as string;

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial snapshot
  const initialSnapshot = droneTrackingService.getTrackingSnapshot(orderId);
  if (initialSnapshot) {
    res.write(`data: ${JSON.stringify(initialSnapshot)}\n\n`);
  }

  // Subscribe to live telemetry updates
  const unsubscribe = droneTrackingService.subscribe(orderId, (telemetry) => {
    res.write(`data: ${JSON.stringify(telemetry)}\n\n`);
  });

  // Heartbeat ping every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
