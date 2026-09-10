import { Router, Request, Response } from 'express';
import { queryAll, queryOne, runCommand } from '../db/database.js';

const router = Router();

// ── GEOFENCE ZONES ──
router.get('/geofences', (_req: Request, res: Response): void => {
  try {
    const rows = queryAll<any>('SELECT * FROM geofence_zones ORDER BY created_at ASC');
    const geofences = rows.map((r) => {
      let coordinates: [number, number][] = [];
      try {
        coordinates = JSON.parse(r.coordinates_json);
      } catch {}
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        coordinates,
        boundsRadiusMeters: r.bounds_radius_meters,
        active: Boolean(r.active),
        maxAltitudeMeters: r.max_altitude_meters,
        description: r.description || '',
      };
    });
    res.json(geofences);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/geofences', (req: Request, res: Response): void => {
  try {
    const { name, type, coordinates, boundsRadiusMeters, active, maxAltitudeMeters, description } = req.body;
    const id = `GEO-${Date.now().toString().slice(-4)}`;

    runCommand(`
      INSERT INTO geofence_zones (id, name, type, coordinates_json, bounds_radius_meters, active, max_altitude_meters, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      name || 'New Geofence',
      type || 'caution',
      JSON.stringify(coordinates || []),
      boundsRadiusMeters || 500,
      active !== false ? 1 : 0,
      maxAltitudeMeters || 120,
      description || '',
    ]);

    res.status(201).json({
      id,
      name,
      type,
      coordinates: coordinates || [],
      boundsRadiusMeters: boundsRadiusMeters || 500,
      active: active !== false,
      maxAltitudeMeters: maxAltitudeMeters || 120,
      description: description || '',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── EMERGENCY ALERTS ──
router.get('/emergencies', (_req: Request, res: Response): void => {
  try {
    const rows = queryAll<any>('SELECT * FROM emergency_alerts ORDER BY timestamp DESC');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/emergencies', (req: Request, res: Response): void => {
  try {
    const { droneId, issueType, message, priority, batteryLevel } = req.body;
    const id = `EMG-${Date.now().toString().slice(-4)}`;

    runCommand(`
      INSERT INTO emergency_alerts (id, drone_id, issue_type, priority, battery_level, status, message)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `, [
      id,
      droneId,
      issueType || 'Route Deviation',
      priority || 'Critical',
      batteryLevel || 15,
      message || 'Autonomous emergency alert triggered.',
    ]);

    runCommand("UPDATE drones SET status = 'emergency' WHERE id = ?", [droneId]);

    res.status(201).json({ id, droneId, issueType, status: 'active', message });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/emergencies/:id/command', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { command, droneId } = req.body; // 'RTH' | 'LAND' | 'PAUSE' | 'CANCEL'

    if (command === 'RTH') {
      runCommand("UPDATE drones SET status = 'returning' WHERE id = ?", [droneId]);
    } else if (command === 'LAND') {
      runCommand("UPDATE drones SET status = 'offline', altitude = 0 WHERE id = ?", [droneId]);
    } else if (command === 'PAUSE') {
      runCommand("UPDATE drones SET speed = 0 WHERE id = ?", [droneId]);
    } else if (command === 'CANCEL') {
      runCommand("UPDATE drones SET status = 'available', current_mission_id = NULL WHERE id = ?", [droneId]);
    }

    runCommand("UPDATE emergency_alerts SET status = 'resolved' WHERE id = ? OR drone_id = ?", [id, droneId]);

    res.json({ success: true, command, droneId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── MAINTENANCE RECORDS ──
router.get('/maintenance', (_req: Request, res: Response): void => {
  try {
    const rows = queryAll<any>('SELECT * FROM maintenance_records ORDER BY created_at DESC');
    res.json(rows.map((r) => ({
      id: r.id,
      droneId: r.drone_id,
      issue: r.issue,
      priority: r.priority,
      reportedDate: r.reported_date,
      scheduledDate: r.scheduled_date,
      status: r.status,
      technician: r.technician,
      notes: r.notes,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/maintenance', (req: Request, res: Response): void => {
  try {
    const { droneId, issue, priority, scheduledDate, technician, notes } = req.body;
    const id = `MNT-${Date.now().toString().slice(-4)}`;

    runCommand(`
      INSERT INTO maintenance_records (id, drone_id, issue, priority, scheduled_date, status, technician, notes)
      VALUES (?, ?, ?, ?, ?, 'Scheduled', ?, ?)
    `, [
      id,
      droneId,
      issue,
      priority || 'Medium',
      scheduledDate || new Date().toISOString().split('T')[0],
      technician || 'Fleet Tech',
      notes || '',
    ]);

    res.status(201).json({ id, droneId, issue, priority, status: 'Scheduled' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── AUDIT LOGS ──
router.get('/audit-logs', (_req: Request, res: Response): void => {
  try {
    const rows = queryAll<any>('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
    res.json(rows.map((r) => ({
      id: r.id,
      adminName: r.admin_name,
      adminRole: r.admin_role,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      severity: r.severity,
      timestamp: r.timestamp,
      details: r.details,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/audit-logs', (req: Request, res: Response): void => {
  try {
    const { adminName, adminRole, action, entity, entityId, severity, details } = req.body;
    const id = `LOG-${Date.now().toString().slice(-4)}`;

    runCommand(`
      INSERT INTO audit_logs (id, admin_name, admin_role, action, entity, entity_id, severity, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      adminName || 'Admin',
      adminRole || 'Operator',
      action,
      entity,
      entityId,
      severity || 'Info',
      details || '',
    ]);

    res.status(201).json({ id, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── SYSTEM NOTIFICATIONS ──
router.get('/notifications', (_req: Request, res: Response): void => {
  try {
    const rows = queryAll<any>('SELECT * FROM system_notifications ORDER BY created_at DESC LIMIT 50');
    res.json(rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      category: r.category,
      timestamp: r.created_at,
      read: Boolean(r.read),
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/notifications/:id/read', (req: Request, res: Response): void => {
  try {
    runCommand('UPDATE system_notifications SET read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/notifications/read-all', (_req: Request, res: Response): void => {
  try {
    runCommand('UPDATE system_notifications SET read = 1');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CUSTOMERS & ANALYTICS ──
router.get('/customers', (_req: Request, res: Response): void => {
  try {
    const orders = queryAll<any>('SELECT customer_order_id, customer_name, customer_phone, total_amount, status, destination_address, created_at FROM operational_orders');

    // Group by customer
    const customerMap = new Map<string, any>();
    for (const ord of orders) {
      const name = ord.customer_name || 'Customer';
      if (!customerMap.has(name)) {
        customerMap.set(name, {
          id: `CUST-${customerMap.size + 1}`,
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          phone: ord.customer_phone || '+1 (555) 000-0000',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          totalOrders: 0,
          successfulDeliveries: 0,
          status: 'Active',
          joinedDate: ord.created_at || '2026-01-01',
          defaultAddress: ord.destination_address || 'Chinniyampalayam, Coimbatore, Tamil Nadu',
          defaultCoords: { lat: 11.0550, lng: 77.0650 },
        });
      }
      const c = customerMap.get(name);
      c.totalOrders++;
      if (ord.status === 'delivered') c.successfulDeliveries++;
    }

    res.json(Array.from(customerMap.values()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics', (_req: Request, res: Response): void => {
  try {
    const orders = queryAll<any>('SELECT status, total_amount FROM operational_orders');
    const drones = queryAll<any>('SELECT status, battery FROM drones');
    const missions = queryAll<any>('SELECT current_status, distance_km, estimated_duration_minutes FROM missions');

    const totalOrders = orders.length;
    const deliveredOrders = orders.filter((o) => o.status === 'delivered').length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const activeDrones = drones.filter((d) => d.status === 'in_flight' || d.status === 'assigned').length;
    const totalDrones = drones.length;
    const avgBattery = drones.length > 0 ? Math.round(drones.reduce((sum, d) => sum + d.battery, 0) / drones.length) : 100;

    res.json({
      totalOrders,
      deliveredOrders,
      totalRevenue,
      activeDrones,
      totalDrones,
      avgBattery,
      totalMissions: missions.length,
      successRatePercent: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 100,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PAYMENTS & FINANCIAL TRANSACTIONS ──
router.get('/payments', (_req: Request, res: Response): void => {
  try {
    const orders = queryAll<any>('SELECT id, customer_order_id, customer_name, total_amount, created_at, status FROM operational_orders ORDER BY created_at DESC');
    const payments = orders.map((o) => ({
      id: `TXN-${o.id.replace('ORD-', '')}`,
      orderId: o.id,
      customerName: o.customer_name || 'Customer',
      amount: o.total_amount || 0,
      paymentMethod: 'Credit Card (Stripe)',
      timestamp: o.created_at,
      status: o.status === 'cancelled' ? 'Refunded' : (o.status === 'failed' ? 'Failed' : 'Successful')
    }));
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── MERCHANTS ──
let merchantStore = [
  {
    id: 'M-01',
    businessName: 'Kovai Fresh Aero Kitchen',
    ownerName: 'Kavitha Ramasamy',
    category: 'Hot Meals & Food',
    totalOrders: 142,
    successRate: 98.4,
    revenue: 44800.00,
    status: 'Approved',
    address: 'Avinashi Road, Chinniyampalayam, Coimbatore, Tamil Nadu',
    coords: { lat: 11.0540, lng: 77.0620 }
  },
  {
    id: 'M-02',
    businessName: 'AeroRescue Apollo Pharmacy Pod',
    ownerName: 'Dr. Ramesh Sundaram',
    category: 'Medicine & Health',
    totalOrders: 89,
    successRate: 99.1,
    revenue: 38900.00,
    status: 'Approved',
    address: 'KMCH Corridor, Avinashi Rd, Peelamedu, Coimbatore',
    coords: { lat: 11.0420, lng: 77.0420 }
  },
  {
    id: 'M-03',
    businessName: 'Kovai Tech & Electronics Hub',
    ownerName: 'Senthil Kumar',
    category: 'Tech & Electronics',
    totalOrders: 64,
    successRate: 97.0,
    revenue: 31500.00,
    status: 'Approved',
    address: 'Tidel Park Road, Peelamedu, Coimbatore',
    coords: { lat: 11.0280, lng: 77.0260 }
  }
];

router.get('/merchants', (_req: Request, res: Response): void => {
  res.json(merchantStore);
});

router.patch('/merchants/:id/status', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { status } = req.body;
  const m = merchantStore.find((item) => item.id === id);
  if (m) {
    m.status = status;
    res.json({ success: true, merchant: m });
  } else {
    res.status(404).json({ error: 'Merchant not found' });
  }
});

// ── SUPPORT TICKETS ──
let ticketStore = [
  {
    id: 'TCK-101',
    orderId: 'ORD-1002',
    customerName: 'Test Customer',
    issueType: 'Delivery Status Query',
    status: 'Open',
    priority: 'Medium',
    createdAt: new Date().toISOString(),
    messages: [
      { sender: 'customer', text: 'When will the drone launch for my express charger order?', timestamp: new Date().toISOString() }
    ]
  }
];

router.get('/tickets', (_req: Request, res: Response): void => {
  res.json(ticketStore);
});

// ── ADMIN ACCOUNTS ──
router.get('/admins', (_req: Request, res: Response): void => {
  try {
    const rows = queryAll<any>('SELECT id, name, email, role, phone, avatar, status, created_at FROM admin_users');
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      phone: r.phone,
      avatar: r.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      status: r.status,
      lastLogin: 'Active Session',
      permissions: ['*'],
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
