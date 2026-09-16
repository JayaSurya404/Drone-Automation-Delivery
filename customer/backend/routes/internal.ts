import { Router, Request, Response } from 'express';
import { db, queryOne, runCommand } from '../db/database.js';
import { verifyHmacSignature } from '../../../shared/contracts/security.js';
import {
  BaseEvent,
  OrderStatusUpdatedPayload,
  DroneAssignedPayload,
  MissionLaunchedPayload,
  TelemetryUpdatePayload,
  DeliveryTouchdownPayload,
  ProductSyncPayload,
} from '../../../shared/contracts/events.js';
import { droneTrackingService } from '../services/droneTrackingService.js';

const router = Router();
const SHARED_SECRET = process.env.SKYNAV_INTERNAL_SERVICE_KEY || 'skynav_secure_internal_service_key_2026';

// HMAC Verification Middleware
const verifyServiceAuth = (req: Request, res: Response, next: () => void): void => {
  const timestamp = req.headers['x-skynav-timestamp'] as string;
  const signature = req.headers['x-skynav-signature'] as string;

  if (!timestamp || !signature) {
    res.status(401).json({ error: 'Missing security signature headers.' });
    return;
  }

  const isValid = verifyHmacSignature(req.body, signature, SHARED_SECRET, timestamp);
  if (!isValid) {
    res.status(403).json({ error: 'Invalid HMAC signature.' });
    return;
  }

  next();
};

router.use(verifyServiceAuth);

// 1. RECEIVE DELIVERY / ORDER STATUS UPDATE FROM ADMIN BACKEND
router.post('/delivery-update', (req: Request, res: Response): void => {
  try {
    const event = req.body as BaseEvent<any>;
    const eventType = event.eventType;
    const data = event.data;

    console.log(`📥 [CustomerInternal] Received event ${eventType} for order #${data.customerOrderId}`);

    const orderId = data.customerOrderId;
    const order = queryOne<any>('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      res.status(404).json({ error: `Order #${orderId} not found.` });
      return;
    }

    if (eventType === 'DRONE_ASSIGNED') {
      const payload = data as DroneAssignedPayload;

      // Ensure drone exists in local customer drones table to satisfy foreign key constraint
      const existingDrone = queryOne<any>('SELECT id FROM drones WHERE id = ?', [payload.drone.id]);
      if (!existingDrone) {
        const identifier = `${payload.drone.name || 'SkyNav Drone'} [${payload.drone.id}]`;
        runCommand(`
          INSERT INTO drones (id, identifier, model, battery_level, status, max_payload_kg, latitude, longitude)
          VALUES (?, ?, ?, ?, 'ASSIGNED', ?, 11.1132, 77.0277)
        `, [
          payload.drone.id,
          identifier,
          payload.drone.model || 'SkyNav Carrier',
          payload.drone.battery ?? 95,
          payload.drone.payloadCapacity ?? 4.5,
        ]);
      }

      runCommand(`
        UPDATE deliveries SET
          drone_id = ?,
          status = 'ASSIGNED',
          updated_at = datetime('now')
        WHERE order_id = ?
      `, [payload.drone.id, orderId]);

      runCommand(`
        UPDATE orders SET
          status = 'Drone Assigned',
          updated_at = datetime('now')
        WHERE id = ?
      `, [orderId]);

      runCommand(`
        INSERT INTO order_status_history (id, order_id, previous_status, new_status, description, completed)
        VALUES (?, ?, ?, 'Drone Assigned', ?, 1)
      `, [
        `hist_${Date.now()}`,
        orderId,
        order.status,
        `Autonomous drone ${payload.drone.name} (${payload.drone.model}) assigned for aerial dispatch.`,
      ]);

      runCommand(`
        INSERT INTO notifications (id, customer_id, title, message, type, is_read, order_id, event_id)
        VALUES (?, ?, 'Drone Assigned!', ?, 'delivery', 0, ?, ?)
      `, [
        `notif_${Date.now()}`,
        order.customer_id,
        `Drone ${payload.drone.name} is on the launchpad preparing for flight.`,
        orderId,
        `evt_assigned_${orderId}`,
      ]);

      droneTrackingService.ingestTelemetryUpdate({
        customerOrderId: orderId,
        missionId: payload.missionId,
        droneId: payload.drone.id,
        droneName: payload.drone.name,
        status: 'Drone Assigned',
        currentLocation: {
          latitude: 11.1132,
          longitude: 77.0277,
          altitudeMeters: 0,
          speedKmh: 0,
          bearing: 0,
        },
        remainingDistanceKm: 4.5,
        estimatedArrivalMins: payload.estimatedFlightMinutes || 12,
        progressPercent: 5,
        timestamp: new Date().toISOString(),
        handoverOtp: order.delivery_otp,
      });
    } else if (eventType === 'ORDER_STATUS_UPDATED') {
      const payload = data as OrderStatusUpdatedPayload;
      runCommand(`
        UPDATE orders SET
          status = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `, [payload.customerStatus, orderId]);

      runCommand(`
        INSERT INTO order_status_history (id, order_id, previous_status, new_status, description, completed)
        VALUES (?, ?, ?, ?, ?, 1)
      `, [
        `hist_${Date.now()}`,
        orderId,
        order.status,
        payload.customerStatus,
        payload.description,
      ]);

      runCommand(`
        INSERT INTO notifications (id, customer_id, title, message, type, is_read, order_id, event_id)
        VALUES (?, ?, 'Order Update', ?, 'order', 0, ?, ?)
      `, [
        `notif_${Date.now()}`,
        order.customer_id,
        payload.description,
        orderId,
        `evt_status_${orderId}_${payload.adminStatus}`,
      ]);
    } else if (eventType === 'MISSION_LAUNCHED') {
      const payload = data as MissionLaunchedPayload;
      runCommand(`
        UPDATE deliveries SET
          flight_route_json = ?,
          status = 'IN_FLIGHT',
          started_at = datetime('now'),
          updated_at = datetime('now')
        WHERE order_id = ?
      `, [JSON.stringify(payload.plannedRoute), orderId]);

      runCommand(`
        UPDATE orders SET
          status = 'Out for Delivery',
          updated_at = datetime('now')
        WHERE id = ?
      `, [orderId]);

      runCommand(`
        INSERT INTO order_status_history (id, order_id, previous_status, new_status, description, completed)
        VALUES (?, ?, ?, 'Out for Delivery', 'Drone launched from launchpad. In-flight along designated airway corridor.', 1)
      `, [
        `hist_${Date.now()}`,
        orderId,
        order.status,
      ]);

      const startCoord = payload.plannedRoute?.[0] || [11.1132, 77.0277];
      droneTrackingService.ingestTelemetryUpdate({
        customerOrderId: orderId,
        missionId: payload.missionId,
        droneId: payload.droneId,
        droneName: payload.droneName,
        status: 'Out for Delivery',
        currentLocation: {
          latitude: startCoord[0],
          longitude: startCoord[1],
          altitudeMeters: 20,
          speedKmh: 30,
          bearing: 0,
        },
        remainingDistanceKm: payload.distanceKm || 4.2,
        estimatedArrivalMins: payload.estimatedDurationMins || 10,
        progressPercent: 5,
        timestamp: new Date().toISOString(),
        handoverOtp: order.delivery_otp,
      });
    } else if (eventType === 'DELIVERY_TOUCHDOWN') {
      const payload = data as DeliveryTouchdownPayload;
      const delivery = queryOne<any>('SELECT destination_latitude, destination_longitude FROM deliveries WHERE order_id = ?', [orderId]);
      const destLat = delivery?.destination_latitude || 11.0725;
      const destLng = delivery?.destination_longitude || 77.0345;

      runCommand(`
        UPDATE deliveries SET
          current_latitude = ?,
          current_longitude = ?,
          current_altitude = 0,
          current_speed = 0,
          remaining_distance_km = 0,
          estimated_arrival_mins = 0,
          status = 'ARRIVED',
          updated_at = datetime('now')
        WHERE order_id = ?
      `, [destLat, destLng, orderId]);

      runCommand(`
        UPDATE orders SET
          status = 'Arriving',
          updated_at = datetime('now')
        WHERE id = ?
      `, [orderId]);

      runCommand(`
        INSERT INTO order_status_history (id, order_id, previous_status, new_status, description, completed)
        VALUES (?, ?, ?, 'Arriving', ?, 1)
      `, [
        `hist_${Date.now()}`,
        orderId,
        order.status,
        payload.message,
      ]);

      runCommand(`
        INSERT INTO notifications (id, customer_id, title, message, type, is_read, order_id, event_id)
        VALUES (?, ?, 'Drone Arrived!', 'Your delivery drone has touched down. Please provide your 4-digit OTP to collect package.', 'delivery', 0, ?, ?)
      `, [
        `notif_${Date.now()}`,
        order.customer_id,
        orderId,
        `evt_touchdown_${orderId}`,
      ]);
    }

    res.json({ success: true, eventType, orderId });
  } catch (err: any) {
    console.error('Error handling internal delivery update:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. RECEIVE TELEMETRY STREAM FROM ADMIN BACKEND
router.post('/telemetry', (req: Request, res: Response): void => {
  try {
    const event = req.body as BaseEvent<TelemetryUpdatePayload>;
    const payload = event.data;

    droneTrackingService.ingestTelemetryUpdate({
      customerOrderId: payload.customerOrderId,
      missionId: payload.missionId,
      droneId: payload.droneId,
      droneName: payload.droneName,
      status: payload.status,
      currentLocation: payload.currentLocation,
      remainingDistanceKm: payload.remainingDistanceKm,
      estimatedArrivalMins: payload.estimatedArrivalMins,
      progressPercent: payload.progressPercent,
      timestamp: payload.timestamp,
      handoverOtp: payload.handoverOtp,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. RECEIVE PRODUCT SYNC FROM ADMIN BACKEND
router.post('/products/sync', (req: Request, res: Response): void => {
  try {
    const event = req.body as BaseEvent<ProductSyncPayload>;
    const { action, product } = event.data;

    console.log(`📥 [CustomerInternal] Product sync: ${action} #${product.id} (${product.name})`);

    if (action === 'create' || action === 'update') {
      // Ensure category exists
      const cat = queryOne('SELECT id FROM categories WHERE id = ?', [product.categoryId]);
      if (!cat) {
        runCommand(`
          INSERT OR IGNORE INTO categories (id, name, slug, description, image, icon, display_order)
          VALUES (?, ?, ?, 'Category description', ?, 'Sparkles', 1)
        `, [product.categoryId, product.categoryName || 'General', product.categoryName?.toLowerCase() || 'general', product.image]);
      }

      runCommand(`
        INSERT INTO products (
          id, name, slug, brand, category_id, sub_category, description,
          price, stock_count, weight_grams, is_drone_eligible, in_stock, image, badge, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          slug = excluded.slug,
          brand = excluded.brand,
          category_id = excluded.category_id,
          sub_category = excluded.sub_category,
          description = excluded.description,
          price = excluded.price,
          stock_count = excluded.stock_count,
          weight_grams = excluded.weight_grams,
          is_drone_eligible = excluded.is_drone_eligible,
          image = excluded.image,
          badge = excluded.badge,
          updated_at = datetime('now')
      `, [
        product.id,
        product.name,
        product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        product.brand || 'SkyNav Direct',
        product.categoryId,
        product.subCategory || 'General',
        product.description,
        product.price,
        product.stockCount,
        product.weightGrams,
        product.isDroneEligible ? 1 : 0,
        product.image,
        product.badge || null,
      ]);
    } else if (action === 'delete') {
      runCommand('UPDATE products SET in_stock = 0 WHERE id = ?', [product.id]);
    }

    res.json({ success: true, action, productId: product.id });
  } catch (err: any) {
    console.error('Error syncing product:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
