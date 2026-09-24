import { Router, Request, Response } from 'express';
import { db, queryOne, runCommand } from '../db/database.js';
import { verifyHmacSignature } from '../../../shared/contracts/security.js';
import { BaseEvent, OrderCreatedPayload, DeliveryCompletedPayload } from '../../../shared/contracts/events.js';
import { telemetryEngine } from '../services/telemetryEngine.js';

const router = Router();
const SHARED_SECRET = process.env.SKYNAV_INTERNAL_SERVICE_KEY || 'skynav_secure_internal_service_key_2026';

// Middleware to verify HMAC signature
const verifyServiceAuth = (req: Request, res: Response, next: () => void): void => {
  const timestamp = req.headers['x-skynav-timestamp'] as string;
  const signature = req.headers['x-skynav-signature'] as string;

  if (!timestamp || !signature) {
    res.status(401).json({ error: 'Missing security signature headers.' });
    return;
  }

  const isValid = verifyHmacSignature(req.body, signature, SHARED_SECRET, timestamp);
  if (!isValid) {
    res.status(403).json({ error: 'Invalid HMAC signature. Unauthorized internal request.' });
    return;
  }

  next();
};

router.use(verifyServiceAuth);

// 1. RECEIVE ORDER FROM CUSTOMER BACKEND
router.post('/orders', (req: Request, res: Response): void => {
  try {
    const event = req.body as BaseEvent<OrderCreatedPayload>;
    const payload = event.data;

    // Check if order already exists (idempotency)
    const existing = queryOne<any>('SELECT id FROM operational_orders WHERE customer_order_id = ?', [payload.customerOrderId]);
    if (existing) {
      res.json({ success: true, operationalOrderId: existing.id, message: 'Order already exists.' });
      return;
    }

    const operationalOrderId = `A-ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    const packageName = payload.items && payload.items.length > 0
      ? payload.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')
      : 'General Goods Parcel';

    runCommand(`
      INSERT INTO operational_orders (
        id, customer_order_id, customer_name, customer_phone, package_name,
        package_weight_kg, items_json, pickup_address, pickup_lat, pickup_lng,
        destination_address, destination_lat, destination_lng, delivery_speed,
        status, handover_otp, total_amount, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_dispatch', ?, ?, datetime('now'), datetime('now'))
    `, [
      operationalOrderId,
      payload.customerOrderId,
      payload.customerName,
      payload.customerPhone,
      packageName,
      payload.totalWeightKg,
      JSON.stringify(payload.items),
      payload.pickup.hubName,
      payload.pickup.latitude,
      payload.pickup.longitude,
      payload.destination.addressText,
      payload.destination.latitude,
      payload.destination.longitude,
      payload.deliverySpeed,
      payload.deliveryOtp,
      payload.total,
    ]);

    runCommand(`
      INSERT INTO audit_logs (id, admin_name, admin_role, action, entity, entity_id, severity, timestamp, details)
      VALUES (?, 'Customer Backend', 'Integration API', 'ORDER_RECEIVED', 'Order', ?, 'Info', datetime('now'), ?)
    `, [`log_${Date.now()}`, operationalOrderId, `Received customer order #${payload.customerOrderId}`]);

    console.log(`📥 [AdminInternal] Received order #${payload.customerOrderId} -> Created operational order #${operationalOrderId}`);

    // Query inserted order and broadcast ORDER_CREATED event to connected admin clients
    const orderRow = queryOne<any>('SELECT * FROM operational_orders WHERE id = ?', [operationalOrderId]);
    if (orderRow) {
      const orderPayload = {
        id: orderRow.id,
        customerOrderId: orderRow.customer_order_id,
        customerName: orderRow.customer_name,
        customerPhone: orderRow.customer_phone,
        merchantName: 'SkyHub Kurumbapalayam',
        packageName: orderRow.package_name,
        packageWeightKg: orderRow.package_weight_kg,
        pickupAddress: orderRow.pickup_address,
        pickupCoords: { lat: orderRow.pickup_lat, lng: orderRow.pickup_lng },
        destinationAddress: orderRow.destination_address,
        destinationCoords: { lat: orderRow.destination_lat, lng: orderRow.destination_lng },
        status: orderRow.status,
        deliverySpeed: orderRow.delivery_speed,
        handoverOtp: orderRow.handover_otp,
        totalAmount: orderRow.total_amount,
        createdAt: orderRow.created_at,
        updatedAt: orderRow.updated_at,
      };

      telemetryEngine.broadcastToAdmin('ORDER_CREATED', {
        operationalOrderId,
        customerOrderId: payload.customerOrderId,
        order: orderPayload,
      });
    }

    res.status(201).json({
      success: true,
      operationalOrderId,
      customerOrderId: payload.customerOrderId,
      status: 'pending_dispatch',
    });
  } catch (err: any) {
    console.error('Error ingesting internal order:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. RECEIVE DELIVERY COMPLETED (OTP Verified by Customer Backend)
router.post('/delivery-completed', (req: Request, res: Response): void => {
  try {
    const event = req.body as BaseEvent<DeliveryCompletedPayload>;
    const payload = event.data;

    console.log(`📥 [AdminInternal] Delivery completed notification for order #${payload.customerOrderId} (verified OTP: ${payload.verifiedOtp})`);

    telemetryEngine.completeDelivery(payload.customerOrderId, payload.verifiedOtp);

    res.json({ success: true, message: 'Delivery completed processed successfully.' });
  } catch (err: any) {
    console.error('Error processing delivery completion:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
