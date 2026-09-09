import bcrypt from 'bcryptjs';
import { db, initDb } from './database.js';

export const seedAdminDatabase = async () => {
  console.log('🌱 Initializing schema and seeding SkyNav Admin database...');
  initDb();

  // Clear existing records
  db.exec(`
    DELETE FROM system_notifications;
    DELETE FROM maintenance_records;
    DELETE FROM geofence_zones;
    DELETE FROM emergency_alerts;
    DELETE FROM audit_logs;
    DELETE FROM missions;
    DELETE FROM operational_orders;
    DELETE FROM drones;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM admin_users;
  `);

  // 1. ADMIN OPERATORS
  const passwordHash = await bcrypt.hash('admin123', 10);
  const adminStmt = db.prepare(`
    INSERT INTO admin_users (id, name, email, password_hash, role, phone, avatar, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  adminStmt.run('ADM-01', 'Rajesh Sharma', 'admin@skynav.com', passwordHash, 'super_admin', '+1 (555) 019-2831', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 'Active');
  adminStmt.run('ADM-02', 'Arjun Kumar', 'ops@skynav.com', passwordHash, 'ops_admin', '+1 (555) 019-2832', null, 'Active');
  adminStmt.run('ADM-03', 'Ananya Sen', 'dispatch@skynav.com', passwordHash, 'dispatch_manager', '+1 (555) 019-2833', null, 'Active');
  adminStmt.run('ADM-04', 'Vikram Singh', 'fleet@skynav.com', passwordHash, 'fleet_manager', '+1 (555) 019-2834', null, 'Active');
  adminStmt.run('ADM-05', 'Meera Patel', 'support@skynav.com', passwordHash, 'support_admin', '+1 (555) 019-2835', null, 'Active');
  adminStmt.run('ADM-06', 'Karan Mehta', 'analytics@skynav.com', passwordHash, 'analytics_admin', '+1 (555) 019-2836', null, 'Active');
  adminStmt.run('ADM-07', 'Sneha Rao', 'analyst@skynav.com', passwordHash, 'analyst', '+1 (555) 019-2837', null, 'Active');

  // 2. CATEGORIES
  const catStmt = db.prepare(`
    INSERT INTO categories (id, name, slug, description, image, icon, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const categories = [
    { id: 'cat_food', name: 'Hot Meals & Food', slug: 'Food', desc: 'Fresh chef-crafted pizzas, sushi, burgers & artisan delicacies delivered hot.', img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80', icon: 'Pizza', order: 1 },
    { id: 'cat_med', name: 'Medicine & Health', slug: 'Medicine', desc: 'Emergency trauma packs, test kits, inhalers, analgesics & prescription refills.', img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80', icon: 'Pill', order: 2 },
    { id: 'cat_groc', name: 'Fresh Groceries', slug: 'Groceries', desc: 'Organic produce, artisan coffee, bakery bread, dairy & gourmet pantry staples.', img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80', icon: 'ShoppingBag', order: 3 },
    { id: 'cat_elec', name: 'Tech & Electronics', slug: 'Electronics', desc: 'High-speed GaN chargers, ANC earbuds, MagSafe accessories & cables.', img: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80', icon: 'Zap', order: 4 },
    { id: 'cat_doc', name: 'Instant Documents', slug: 'Documents', desc: 'Secure biometric sealed pouches, legal contracts, notary briefs & deeds.', img: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80', icon: 'FileText', order: 5 },
    { id: 'cat_other', name: 'Daily Essentials', slug: 'Other', desc: 'Weather gear, titanium tools, emergency battery pods & home lifestyle.', img: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80', icon: 'Sparkles', order: 6 },
  ];

  for (const c of categories) {
    catStmt.run(c.id, c.name, c.slug, c.desc, c.img, c.icon, c.order);
  }

  // 3. PRODUCTS (Admin Source of Truth)
  const prodStmt = db.prepare(`
    INSERT INTO products (
      id, name, slug, brand, category_id, sub_category, description, price,
      stock_count, weight_grams, is_drone_eligible, is_active, image, badge
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const products = [
    {
      id: 'prod_food_1',
      name: 'Artisan Woodfired Truffle Mushroom Pizza (12")',
      slug: 'artisan-woodfired-truffle-mushroom-pizza-12',
      brand: 'Bella Napoli Aero Kitchen',
      category_id: 'cat_food',
      sub_category: 'Italian Gourmet',
      description: 'Hand-stretched sourdough pizza with black truffle puree, wild cremini mushrooms, and buffalo mozzarella.',
      price: 21.99,
      stock_count: 45,
      weight_grams: 850,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
      badge: 'Popular'
    },
    {
      id: 'prod_med_1',
      name: 'Rapid Response First-Aid Trauma Kit',
      slug: 'rapid-response-first-aid-trauma-kit',
      brand: 'AeroRescue Medical',
      category_id: 'cat_med',
      sub_category: 'Emergency Care',
      description: 'Compact emergency trauma response pack with sterile dressings, tourniquet, burn gel, and CPR shield.',
      price: 34.50,
      stock_count: 80,
      weight_grams: 450,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
      badge: 'Urgent Dispatch'
    },
    {
      id: 'prod_elec_1',
      name: 'Anker 65W GaN High-Speed Fast Charger',
      slug: 'anker-65w-gan-fast-charger',
      brand: 'Anker Innovations',
      category_id: 'cat_elec',
      sub_category: 'Charging & Power',
      description: 'Ultra-compact Gallium Nitride 65W fast charger with dual USB-C and single USB-A power delivery.',
      price: 29.99,
      stock_count: 60,
      weight_grams: 180,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
      badge: 'Best Seller'
    },
    {
      id: 'prod_groc_1',
      name: 'Organic Artisan Cold Brew Blend Beans (12oz)',
      slug: 'organic-artisan-cold-brew-blend',
      brand: 'Blue Bottle Aero Lab',
      category_id: 'cat_groc',
      sub_category: 'Artisan Beverages',
      description: 'Whole-bean organic roast with rich tasting notes of dark chocolate, bourbon vanilla, and hazelnut.',
      price: 18.50,
      stock_count: 35,
      weight_grams: 340,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
      badge: 'Staff Pick'
    }
  ];

  for (const p of products) {
    prodStmt.run(p.id, p.name, p.slug, p.brand, p.category_id, p.sub_category, p.description, p.price, p.stock_count, p.weight_grams, p.is_drone_eligible, p.is_active, p.image, p.badge);
  }

  // 4. 40 REALISTIC FLEET DRONES
  const droneModels = ['SKYNAV X1', 'SKYNAV X2', 'SKYNAV Cargo', 'SKYNAV VTOL', 'SKYNAV Heavy Cargo'];
  const hubLat = 37.7625;
  const hubLng = -122.4480;

  const droneStmt = db.prepare(`
    INSERT INTO drones (
      id, name, model, serial_number, registration, status, battery,
      battery_health, battery_cycles, payload_capacity, latitude, longitude, altitude, heading, speed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
  `);

  for (let i = 1; i <= 40; i++) {
    const id = `D-${i.toString().padStart(3, '0')}`;
    const model = droneModels[(i - 1) % droneModels.length];
    const capacity = model.includes('Heavy') ? 15.0 : model.includes('Cargo') ? 8.5 : model.includes('VTOL') ? 5.0 : 4.5;
    
    // Spread coordinates around the central hub
    const angle = (i / 40) * 2 * Math.PI;
    const distOffset = 0.005 + (i % 5) * 0.003;
    const lat = hubLat + Math.sin(angle) * distOffset;
    const lng = hubLng + Math.cos(angle) * distOffset;

    droneStmt.run(
      id,
      `SkyNav Unit ${i}`,
      model,
      `SN-SKY-${80000 + i}`,
      `FAA-REG-${10000 + i}`,
      'available',
      Math.min(100, 85 + (i * 3) % 16),
      92 + (i % 8),
      40 + (i * 12) % 100,
      capacity,
      parseFloat(lat.toFixed(6)),
      parseFloat(lng.toFixed(6))
    );
  }

  // 5. GEOFENCE ZONES
  const geoStmt = db.prepare(`
    INSERT INTO geofence_zones (id, name, type, coordinates_json, bounds_radius_meters, active, max_altitude_meters, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  geoStmt.run('GEO-01', 'SFO Airport Exclusion Zone', 'nofly', JSON.stringify([[37.6213, -122.3790]]), 6200, 1, 3000, 'FAA Class B Airport Exclusion Corridor');
  geoStmt.run('GEO-02', 'Presidio Military Coastal Zone', 'restricted', JSON.stringify([[37.7989, -122.4662]]), 2100, 1, 1200, 'Federal Security Reservation & Military Reserve');
  geoStmt.run('GEO-03', 'Downtown SF High-Density Corridor', 'delivery', JSON.stringify([[37.7897, -122.3969]]), 3500, 1, 120, 'Primary Autonomous Delivery Flight Corridor');
  geoStmt.run('GEO-04', 'UCSF Medical Heliport Caution Area', 'caution', JSON.stringify([[37.7631, -122.4580]]), 1000, 1, 350, 'Emergency Medevac Helicopter Transit Corridor');

  // 6. MAINTENANCE RECORDS
  const maintStmt = db.prepare(`
    INSERT INTO maintenance_records (id, drone_id, issue, priority, scheduled_date, status, technician, notes)
    VALUES (?, ?, ?, ?, date('now', '+3 days'), 'Scheduled', ?, ?)
  `);

  maintStmt.run('MNT-01', 'D-005', 'Rotor blade leading-edge micro-pitting detected during preflight inspection', 'Medium', 'Vikram Singh', 'Scheduled 100-cycle rotor replacement.');
  maintStmt.run('MNT-02', 'D-012', 'LiDAR obstacle sensor calibration drift (+1.2cm variance)', 'Low', 'Fleet Tech A', 'Sensor array software zero-point recalibration.');
  maintStmt.run('MNT-03', 'D-024', 'Battery cell #4 internal resistance higher than nominal (+8%)', 'High', 'Vikram Singh', 'Replace smart battery power pack module.');

  // 7. OPERATIONAL ORDERS & MISSIONS
  const opOrderStmt = db.prepare(`
    INSERT INTO operational_orders (
      id, customer_order_id, customer_name, customer_phone, package_name,
      package_weight_kg, items_json, pickup_address, pickup_lat, pickup_lng,
      destination_address, destination_lat, destination_lng, delivery_speed,
      status, drone_id, mission_id, handover_otp, total_amount, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
  `);

  const missionStmt = db.prepare(`
    INSERT INTO missions (
      id, operational_order_id, customer_order_id, drone_id,
      planned_route_json, actual_route_json, distance_km, estimated_duration_minutes,
      current_status, current_latitude, current_longitude, current_altitude,
      current_speed, current_bearing, remaining_distance_km, eta_seconds,
      created_at, start_time, completion_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?), datetime('now', ?))
  `);

  const items1 = JSON.stringify([
    { productId: 'prod_food_1', name: 'Artisan Woodfired Truffle Mushroom Pizza (12")', quantity: 1, price: 21.99 },
    { productId: 'prod_med_1', name: 'Rapid Response First-Aid Trauma Kit', quantity: 1, price: 34.99 }
  ]);

  const items2 = JSON.stringify([
    { productId: 'prod_elec_1', name: 'Anker 65W GaN High-Speed Fast Charger', quantity: 1, price: 39.99 }
  ]);

  // ORD-1001: Delivered
  opOrderStmt.run(
    'ORD-1001',
    'ORD-1001',
    'Test Customer',
    '+1 (555) 789-0123',
    'Food & Trauma Kit Pod',
    1.23,
    items1,
    'SkyHub Aero Fulfillment Central #1 (37.7625, -122.4480)',
    37.7625,
    -122.4480,
    '100 Market Street, San Francisco, CA',
    37.7897,
    -122.3969,
    'standard',
    'delivered',
    'D-002',
    'MSN-1001',
    '7842',
    60.49,
    '-2 days',
    '-2 days'
  );

  missionStmt.run(
    'MSN-1001',
    'ORD-1001',
    'ORD-1001',
    'D-002',
    JSON.stringify([[37.7625, -122.4480], [37.7750, -122.4200], [37.7897, -122.3969]]),
    JSON.stringify([[37.7625, -122.4480], [37.7750, -122.4200], [37.7897, -122.3969]]),
    5.4,
    14,
    'delivered',
    37.7897,
    -122.3969,
    0,
    0,
    45,
    0,
    0,
    '-2 days',
    '-2 days',
    '-2 days'
  );

  // ORD-1002: Pending Dispatch
  opOrderStmt.run(
    'ORD-1002',
    'ORD-1002',
    'Test Customer',
    '+1 (555) 789-0123',
    'High-Speed Tech Pod',
    0.22,
    items2,
    'SkyHub Aero Fulfillment Central #1 (37.7625, -122.4480)',
    37.7625,
    -122.4480,
    '100 Market Street, San Francisco, CA',
    37.7897,
    -122.3969,
    'express',
    'pending_dispatch',
    null,
    null,
    '3195',
    47.18,
    '-1 hour',
    '-1 hour'
  );

  // 8. SYSTEM NOTIFICATIONS
  const notifStmt = db.prepare(`
    INSERT INTO system_notifications (id, title, message, category, read)
    VALUES (?, ?, ?, ?, ?)
  `);

  notifStmt.run('NOTIF-01', 'Fleet Readiness 100%', 'All 40 autonomous delivery drones telemetry links operational.', 'success', 0);
  notifStmt.run('NOTIF-02', 'Weather Advisory', 'Wind gusts 14 kt at Hub #1. All operations within safe flight envelope.', 'info', 0);
  notifStmt.run('NOTIF-03', 'Airspace Clearance', 'FAA Part 107 authorization renewed for Bay Area operational corridor.', 'info', 1);

  // 9. AUDIT LOGS
  const auditStmt = db.prepare(`
    INSERT INTO audit_logs (id, admin_name, admin_role, action, entity, entity_id, severity, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  auditStmt.run('LOG-01', 'Rajesh Sharma', 'super_admin', 'SYSTEM_INITIALIZATION', 'System', 'CORE', 'Info', 'SkyNav Autonomous Drone System initialized');

  console.log('✅ SkyNav Admin Database seeded with Admins, Products, Categories, 40 Drones, Geofences, Orders, Missions, Maintenance & Alerts.');
};

seedAdminDatabase().catch((err) => {
  console.error('Error seeding admin database:', err);
  process.exit(1);
});
