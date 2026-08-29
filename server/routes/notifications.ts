import { Router, Response } from 'express';
import { queryAll, queryOne, runCommand } from '../db/database.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const formatNotification = (n: any) => ({
  id: n.id,
  title: n.title,
  message: n.message,
  type: n.type,
  timestamp: n.created_at,
  read: Boolean(n.is_read),
  orderId: n.order_id,
});

// 1. GET ALL NOTIFICATIONS (AUTHENTICATED)
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const rows = queryAll<any>(
      'SELECT * FROM notifications WHERE customer_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows.map(formatNotification));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// 2. MARK NOTIFICATION AS READ (AUTHENTICATED)
router.patch('/:id/read', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    runCommand(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND customer_id = ?',
      [id, userId]
    );

    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

// 3. MARK ALL AS READ (AUTHENTICATED)
router.patch('/read-all', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    runCommand('UPDATE notifications SET is_read = 1 WHERE customer_id = ?', [userId]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications as read.' });
  }
});

// 4. CLEAR NOTIFICATION (AUTHENTICATED)
router.delete('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    runCommand('DELETE FROM notifications WHERE id = ? AND customer_id = ?', [id, userId]);
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification.' });
  }
});

export default router;
