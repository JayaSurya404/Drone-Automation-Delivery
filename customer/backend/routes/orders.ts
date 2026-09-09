import { Router, Response } from 'express';
import { queryAll, queryOne, runCommand } from '../db/database.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { adminIntegrationClient } from '../services/adminIntegrationClient.js';

const router = Router();

const formatOrder = (order: any, items: any[] = [], timeline: any[] = []) => ({
  id: order.id,
  customerId: order.customer_id,
  subtotal: order.subtotal,
  deliveryFee: order.delivery_fee,
  tax: order.tax,
  discount: order.discount,
  total: order.total,
  paymentMethod: order.payment_method,
  paymentStatus: order.payment_status,
  status: order.status,
  deliverySpeed: order.delivery_speed,
  scheduledTime: order.scheduled_time,
  deliveryAddress: typeof order.delivery_address_json === 'string' ? JSON.parse(order.delivery_address_json) : order.delivery_address_json,
  deliveryInstructions: order.delivery_instructions,
  dropZoneType: order.drop_zone_type,
  deliveryOtp: order.delivery_otp,
  isCancellable: Boolean(order.is_cancellable && ['Order Placed', 'Order Confirmed', 'Preparing'].includes(order.status)),
  estimatedDeliveryTime: order.estimated_delivery_time,
  estimatedArrivalTimestamp: order.estimated_arrival_timestamp,
  createdAt: order.created_at,
  updatedAt: order.updated_at,
  completedAt: order.completed_at,
  cancellationReason: order.cancellation_reason,
  items: items.map((i) => ({
    product: {
      id: i.product_id,
      name: i.product_name,
      price: i.unit_price,
      image: i.product_image,
      weightGrams: i.weight_grams,
    },
    quantity: i.quantity,
  })),
  timeline: timeline.map((t) => ({
    status: t.new_status,
    timestamp: t.timestamp,
    description: t.description,
    completed: Boolean(t.completed),
  })),
});

// 1. GET ALL ORDERS FOR LOGGED-IN CUSTOMER (DATA ISOLATION)
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const orders = queryAll<any>(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC',
      [userId]
    );

    const formatted = orders.map((o) => {
      const items = queryAll<any>('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
      const timeline = queryAll<any>('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY timestamp ASC', [o.id]);
      return formatOrder(o, items, timeline);
    });

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch customer orders.' });
  }
});

// 2. GET SINGLE ORDER DETAILS (STRICT OWNERSHIP CHECK)
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const order = queryOne<any>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    // STRICT CUSTOMER DATA ISOLATION
    if (order.customer_id !== userId) {
      res.status(403).json({ error: 'Unauthorized: You do not have permission to view this order.' });
      return;
    }

    const items = queryAll<any>('SELECT * FROM order_items WHERE order_id = ?', [id]);
    const timeline = queryAll<any>('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY timestamp ASC', [id]);

    res.json(formatOrder(order, items, timeline));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order details.' });
  }
});

// 3. CANCEL ORDER (AUTHENTICATED & OWNERSHIP VERIFIED)
router.post('/:id/cancel', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;

    const order = queryOne<any>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    if (order.customer_id !== userId) {
      res.status(403).json({ error: 'Unauthorized: You cannot cancel an order that is not yours.' });
      return;
    }

    if (!['Order Placed', 'Order Confirmed', 'Preparing'].includes(order.status)) {
      res.status(400).json({ error: 'This order cannot be cancelled as the drone has already launched or is near destination.' });
      return;
    }

    runCommand(`
      UPDATE orders SET
        status = 'Cancelled',
        cancellation_reason = ?,
        is_cancellable = 0,
        updated_at = datetime('now')
      WHERE id = ?
    `, [reason || 'Cancelled by customer', id]);

    runCommand(`
      INSERT INTO order_status_history (id, order_id, previous_status, new_status, description, completed)
      VALUES (?, ?, ?, 'Cancelled', ?, 1)
    `, [`hist_${Date.now()}_cancel`, id, order.status, `Order cancelled by customer. Reason: ${reason || 'Customer request'}`]);

    // Restore stock in products table
    const items = queryAll<any>('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]);
    for (const item of items) {
      runCommand('UPDATE products SET stock_count = stock_count + ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    const updated = queryOne<any>('SELECT * FROM orders WHERE id = ?', [id]);
    const timeline = queryAll<any>('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY timestamp ASC', [id]);

    res.json(formatOrder(updated, items, timeline));
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order.' });
  }
});

// 4. RATE ORDER (AUTHENTICATED & OWNERSHIP VERIFIED)
router.post('/:id/rate', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const { stars, feedback } = req.body;
    const userId = req.user!.id;

    const order = queryOne<any>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order || order.customer_id !== userId) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    // Insert reviews for ordered items
    const items = queryAll<any>('SELECT * FROM order_items WHERE order_id = ?', [id]);
    const user = queryOne<any>('SELECT name, avatar FROM users WHERE id = ?', [userId]);

    for (const item of items) {
      runCommand(`
        INSERT INTO reviews (id, product_id, customer_id, order_id, author_name, author_avatar, rating, title, comment, verified_purchase)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        `rev_${Date.now()}_${item.product_id}`,
        item.product_id,
        userId,
        id,
        user?.name || 'Verified Customer',
        user?.avatar || null,
        Number(stars) || 5,
        'Customer Delivery Review',
        feedback || 'Fast and pristine aerial delivery.',
      ]);
    }

    res.json({ success: true, message: 'Rating submitted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit order rating.' });
  }
});

// 5. VERIFY HANDOVER OTP & COMPLETE DELIVERY
router.post('/:id/verify-otp', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { otp } = req.body;
    const userId = req.user!.id;

    const order = queryOne<any>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    if (order.customer_id !== userId) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }

    if (order.delivery_otp !== otp?.toString().trim()) {
      res.status(400).json({ error: 'Invalid 4-digit OTP code. Please check your delivery code.' });
      return;
    }

    // Mark order and delivery as Delivered
    runCommand(`
      UPDATE orders SET
        status = 'Delivered',
        completed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `, [id]);

    runCommand(`
      UPDATE deliveries SET
        status = 'DELIVERED',
        completed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE order_id = ?
    `, [id]);

    runCommand(`
      INSERT INTO order_status_history (id, order_id, previous_status, new_status, description, completed)
      VALUES (?, ?, ?, 'Delivered', 'Package safely handed over onto designated landing zone. Verified via OTP.', 1)
    `, [`hist_${Date.now()}_del`, id, order.status]);

    // Notify Admin Backend of delivery completion
    const delivery = queryOne<any>('SELECT drone_id FROM deliveries WHERE order_id = ?', [id]);
    await adminIntegrationClient.notifyDeliveryCompleted({
      customerOrderId: id,
      missionId: 'MS-COMPLETED',
      droneId: delivery?.drone_id,
      verifiedOtp: otp,
      completedAt: new Date().toISOString(),
      notes: 'Customer successfully verified 4-digit OTP at touchdown.',
    });

    res.json({
      success: true,
      message: 'Delivery verified and completed successfully!',
      status: 'Delivered',
    });
  } catch (err: any) {
    console.error('Error verifying delivery OTP:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
