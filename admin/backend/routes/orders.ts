import { Router, Request, Response } from 'express';
import { queryAll, queryOne, runCommand } from '../db/database.js';
import { customerIntegrationClient } from '../services/customerIntegrationClient.js';
import { mapAdminStatusToCustomer, AdminOrderStatus } from '../../../shared/contracts/types.js';

const router = Router();

// GET all operational orders
router.get('/', (req: Request, res: Response) => {
  try {
    const orders = queryAll<any>(`
      SELECT o.*, d.name as drone_name, d.model as drone_model, d.battery as drone_battery
      FROM operational_orders o
      LEFT JOIN drones d ON d.id = o.drone_id
      ORDER BY o.created_at DESC
    `);

    const formatted = orders.map((o) => {
      let items = [];
      try {
        items = JSON.parse(o.items_json);
      } catch {}

      return {
        id: o.id,
        customerOrderId: o.customer_order_id,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        merchantName: 'SkyNav Central Hub',
        packageName: o.package_name,
        packageWeightKg: o.package_weight_kg,
        items,
        pickupAddress: o.pickup_address,
        pickupCoords: { lat: o.pickup_lat, lng: o.pickup_lng },
        destinationAddress: o.destination_address,
        destinationCoords: { lat: o.destination_lat, lng: o.destination_lng },
        deliverySpeed: o.delivery_speed,
        status: o.status,
        droneId: o.drone_id,
        droneName: o.drone_name,
        missionId: o.mission_id,
        paymentStatus: 'successful',
        paymentAmount: o.total_amount,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
      };
    });

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single order
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const order = queryOne<any>('SELECT * FROM operational_orders WHERE id = ? OR customer_order_id = ?', [id, id]);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE order status (Accepted, Packing, Packed, Ready for Dispatch)
router.post('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, description } = req.body;

    const allowedStatuses: AdminOrderStatus[] = ['accepted', 'packing', 'packed', 'ready_for_dispatch'];
    if (!allowedStatuses.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${allowedStatuses.join(', ')}` });
      return;
    }

    const order = queryOne<any>('SELECT * FROM operational_orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    runCommand(`
      UPDATE operational_orders SET
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [status, id]);

    const customerStatus = mapAdminStatusToCustomer(status);
    const desc = description || `Order marked ${status} by SkyNav fulfillment operator.`;

    // Notify Customer Backend
    await customerIntegrationClient.notifyOrderStatus({
      customerOrderId: order.customer_order_id,
      operationalOrderId: order.id,
      adminStatus: status,
      customerStatus,
      description: desc,
      updatedAt: new Date().toISOString(),
    });

    // Log to audit trail
    runCommand(`
      INSERT INTO audit_logs (id, admin_name, admin_role, action, entity, entity_id, severity, timestamp, details)
      VALUES (?, 'Operator', 'Dispatch', 'ORDER_STATUS_UPDATE', 'Order', ?, 'Info', datetime('now'), ?)
    `, [`log_${Date.now()}`, id, `Order status updated to ${status}`]);

    res.json({ success: true, status, customerStatus });
  } catch (err: any) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
