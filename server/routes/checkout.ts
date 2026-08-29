import { Router, Response } from 'express';
import { db, queryAll, queryOne, runCommand } from '../db/database.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { droneTrackingService } from '../services/droneTrackingService.js';

const router = Router();

// 1. CHECK GEOFENCE & DRONE DELIVERY ELIGIBILITY
router.post('/eligibility', (req, res): void => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: 'Latitude and Longitude coordinates are required.' });
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    // Find closest active fulfillment hub in database
    const zones = queryAll<any>("SELECT * FROM delivery_zones WHERE status = 'ACTIVE'");
    if (zones.length === 0) {
      res.json({
        isEligible: false,
        message: 'No active drone fulfillment hubs available in this region.',
        distanceFromHubKm: 999,
        estimatedFlightMinutes: 0,
        status: 'Temporarily Unavailable',
      });
      return;
    }

    let nearestZone = zones[0];
    let minDistance = droneTrackingService.calculateDistanceKm(
      nearestZone.hub_latitude,
      nearestZone.hub_longitude,
      lat,
      lng
    );

    for (let i = 1; i < zones.length; i++) {
      const dist = droneTrackingService.calculateDistanceKm(
        zones[i].hub_latitude,
        zones[i].hub_longitude,
        lat,
        lng
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestZone = zones[i];
      }
    }

    const isEligible = minDistance <= nearestZone.radius_km;
    const flightMinutes = isEligible ? Math.max(8, Math.round(minDistance * 1.6 + 4)) : 0;

    res.json({
      isEligible,
      message: isEligible
        ? `Within ${nearestZone.name} airspace corridor. Safe drone landing confirmed.`
        : `Location is ${minDistance} km away (exceeds ${nearestZone.radius_km} km max drone radius).`,
      distanceFromHubKm: minDistance,
      estimatedFlightMinutes: flightMinutes,
      status: isEligible ? 'Eligible' : 'Not Eligible',
      hubName: nearestZone.hub_name,
    });
  } catch (err) {
    console.error('Eligibility error:', err);
    res.status(500).json({ error: 'Failed to verify drone delivery eligibility.' });
  }
});

// 2. TRANSACTIONAL ORDER CREATION
router.post('/orders', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const {
      addressId,
      customAddress,
      paymentMethod = 'Credit Card',
      deliverySpeed = 'standard',
      scheduledTime,
      deliveryInstructions,
      promoCode,
    } = req.body;

    // Fetch customer cart
    const cart = queryOne<any>('SELECT id FROM carts WHERE customer_id = ?', [userId]);
    if (!cart) {
      res.status(400).json({ error: 'Your shopping cart is empty.' });
      return;
    }

    const cartItems = queryAll<any>(`
      SELECT ci.quantity, p.*
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = ?
    `, [cart.id]);

    if (cartItems.length === 0) {
      res.status(400).json({ error: 'Your shopping cart is empty.' });
      return;
    }

    // Resolve delivery address
    let deliveryAddress: any = null;
    if (addressId) {
      deliveryAddress = queryOne<any>('SELECT * FROM addresses WHERE id = ? AND customer_id = ?', [addressId, userId]);
    } else if (customAddress) {
      deliveryAddress = customAddress;
    }

    if (!deliveryAddress) {
      res.status(400).json({ error: 'Please specify a valid delivery drop zone address.' });
      return;
    }

    // Compute authoritative pricing & check stock in database
    let subtotal = 0;
    let totalWeightGrams = 0;

    for (const item of cartItems) {
      if (item.stock_count < item.quantity || !item.in_stock) {
        res.status(400).json({
          error: `Product "${item.name}" is out of stock or only has ${item.stock_count} remaining.`,
        });
        return;
      }
      subtotal += item.price * item.quantity;
      totalWeightGrams += (item.weight_grams || 250) * item.quantity;
    }

    // Drone delivery fee
    let baseDeliveryFee = 3.99;
    if (deliverySpeed === 'express') baseDeliveryFee += 3.50;
    if (totalWeightGrams > 1500) baseDeliveryFee += 2.00;

    const deliveryFee = parseFloat(baseDeliveryFee.toFixed(2));

    // Promo code discount
    let promoDiscountPct = 0;
    if (promoCode) {
      const clean = promoCode.trim().toUpperCase();
      if (clean === 'DRONE10' || clean === 'SKYFIRST') promoDiscountPct = 10;
      else if (clean === 'AERO20' && subtotal >= 50) promoDiscountPct = 20;
    }

    const discount = parseFloat(((subtotal * promoDiscountPct) / 100).toFixed(2));
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = parseFloat((taxableAmount * 0.085).toFixed(2));
    const total = parseFloat((taxableAmount + deliveryFee + tax).toFixed(2));

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit handover OTP
    const estimatedMinutes = deliverySpeed === 'express' ? 10 : 15;
    const estFormatted = `${estimatedMinutes} mins`;
    const arrivalTimestamp = new Date(Date.now() + estimatedMinutes * 60000).toISOString();

    // Find and assign available drone
    let assignedDrone = queryOne<any>(`
      SELECT * FROM drones
      WHERE status = 'AVAILABLE' AND battery_level >= 30
      ORDER BY battery_level DESC
      LIMIT 1
    `);

    if (!assignedDrone) {
      assignedDrone = queryOne<any>('SELECT * FROM drones ORDER BY battery_level DESC LIMIT 1') || {
        id: 'drone_01',
        identifier: 'SkyLink Alpha-01',
      };
    }

    // Hub coordinates
    const hub = queryOne<any>('SELECT * FROM delivery_zones LIMIT 1') || {
      hub_latitude: 37.7625,
      hub_longitude: -122.4480,
      hub_name: 'SkyHub Aero Fulfillment Central #1',
    };

    const destLat = deliveryAddress.latitude || 37.7749;
    const destLng = deliveryAddress.longitude || -122.4194;
    const flightRoute = droneTrackingService.generateFlightRoute(hub.hub_latitude, hub.hub_longitude, destLat, destLng);
    const initialDistanceKm = droneTrackingService.calculateDistanceKm(hub.hub_latitude, hub.hub_longitude, destLat, destLng);

    // EXECUTE TRANSACTION
    db.transaction(() => {
      // 1. Create Order
      runCommand(`
        INSERT INTO orders (
          id, customer_id, subtotal, delivery_fee, tax, discount, total,
          payment_method, payment_status, status, delivery_speed, scheduled_time,
          delivery_address_json, delivery_instructions, drop_zone_type, delivery_otp,
          is_cancellable, estimated_delivery_time, estimated_arrival_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Paid', 'Order Placed', ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `, [
        orderId,
        userId,
        parseFloat(subtotal.toFixed(2)),
        deliveryFee,
        tax,
        discount,
        total,
        paymentMethod,
        deliverySpeed,
        scheduledTime || null,
        JSON.stringify(deliveryAddress),
        deliveryInstructions || deliveryAddress.instructions || '',
        deliveryAddress.dropZoneType || 'Lawn',
        deliveryOtp,
        estFormatted,
        arrivalTimestamp,
      ]);

      // 2. Create Order Items & Decrement Stock
      for (const item of cartItems) {
        runCommand(`
          INSERT INTO order_items (
            id, order_id, product_id, product_name, product_image, unit_price, quantity, total_price, weight_grams
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `oi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          orderId,
          item.id,
          item.name,
          item.image,
          item.price,
          item.quantity,
          parseFloat((item.price * item.quantity).toFixed(2)),
          item.weight_grams || 250,
        ]);

        runCommand('UPDATE products SET stock_count = stock_count - ? WHERE id = ?', [item.quantity, item.id]);
      }

      // 3. Initial Timeline Entry
      runCommand(`
        INSERT INTO order_status_history (id, order_id, previous_status, new_status, description, completed)
        VALUES (?, ?, NULL, 'Order Placed', 'Order received and verified by SkyHub fulfillment automated dispatch.', 1)
      `, [`hist_${Date.now()}_1`, orderId]);

      // 4. Create Active Delivery Record
      runCommand(`
        INSERT INTO deliveries (
          id, order_id, drone_id, status, pickup_latitude, pickup_longitude,
          destination_latitude, destination_longitude, flight_route_json,
          current_latitude, current_longitude, current_altitude, current_speed,
          current_bearing, remaining_distance_km, estimated_arrival_mins, handover_otp, started_at
        ) VALUES (?, ?, ?, 'PREPARING', ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, datetime('now'))
      `, [
        `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId,
        assignedDrone.id,
        hub.hub_latitude,
        hub.hub_longitude,
        destLat,
        destLng,
        JSON.stringify(flightRoute),
        hub.hub_latitude,
        hub.hub_longitude,
        initialDistanceKm,
        estimatedMinutes,
        deliveryOtp,
      ]);

      // 5. Update Drone Status
      runCommand("UPDATE drones SET status = 'ASSIGNED', current_delivery_id = ? WHERE id = ?", [orderId, assignedDrone.id]);

      // 6. Clear Cart
      runCommand('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);

      // 7. Create Deduplicated Notification
      runCommand(`
        INSERT INTO notifications (id, customer_id, title, message, type, is_read, order_id, event_id)
        VALUES (?, ?, 'Order Confirmed & Drone Assigned', 'Your aerial order #${orderId} is being prepared at SkyHub Central.', 'order', 0, ?, ?)
      `, [
        `notif_${Date.now()}_placed`,
        userId,
        orderId,
        `evt_order_placed_${orderId}`
      ]);
    })();

    // Start Realtime Autonomous Drone Flight Simulation
    droneTrackingService.startFlightSimulation(orderId);

    // Fetch and return formatted order
    const createdOrder = queryOne<any>('SELECT * FROM orders WHERE id = ?', [orderId]);
    const items = queryAll<any>('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    const timeline = queryAll<any>('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY timestamp ASC', [orderId]);

    res.status(201).json({
      ...createdOrder,
      items: items.map((i) => ({
        product: {
          id: i.product_id,
          name: i.product_name,
          price: i.unit_price,
          image: i.product_image,
        },
        quantity: i.quantity,
      })),
      deliveryAddress: JSON.parse(createdOrder.delivery_address_json),
      timeline: timeline.map((t) => ({
        status: t.new_status,
        timestamp: t.timestamp,
        description: t.description,
        completed: Boolean(t.completed),
      })),
    });
  } catch (err: any) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to place order.' });
  }
});

export default router;
