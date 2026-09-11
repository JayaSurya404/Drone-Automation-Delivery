import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDb } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

export const seedAdminDatabase = async () => {
  console.log('🌱 Initializing schema and seeding SkyNav Admin database (Coimbatore / Kurumbapalayam)...');
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

  // 1. SINGLE FULL-ACCESS ADMIN ACCOUNT
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@skynav').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'skynav@123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminStmt = db.prepare(`
    INSERT INTO admin_users (id, name, email, password_hash, role, phone, avatar, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  adminStmt.run(
    'ADM-01',
    'SkyNav Administrator',
    adminEmail,
    passwordHash,
    'admin',
    '+91 98422 10001',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'Active'
  );

  // 2. CATEGORIES
  const catStmt = db.prepare(`
    INSERT INTO categories (id, name, slug, description, image, icon, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const categories = [
    { id: 'cat_food', name: 'Hot Meals & Food', slug: 'Food', desc: 'Fresh chef-crafted meals, authentic South Indian breakfast & delicacies delivered hot.', img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80', icon: 'Pizza', order: 1 },
    { id: 'cat_med', name: 'Medicine & Health', slug: 'Medicine', desc: 'Emergency trauma packs, test kits, inhalers, analgesics & prescription refills.', img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80', icon: 'Pill', order: 2 },
    { id: 'cat_groc', name: 'Fresh Groceries', slug: 'Groceries', desc: 'Aavin fresh dairy, Nilgiris tea, organic farm produce & pantry staples.', img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80', icon: 'ShoppingBag', order: 3 },
    { id: 'cat_elec', name: 'Tech & Electronics', slug: 'Electronics', desc: 'High-speed GaN chargers, heavy-duty power banks & durable USB-C cables.', img: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80', icon: 'Zap', order: 4 },
    { id: 'cat_doc', name: 'Instant Documents', slug: 'Documents', desc: 'Secure biometric sealed pouches, legal contracts, notary briefs & deeds.', img: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80', icon: 'FileText', order: 5 },
    { id: 'cat_other', name: 'Daily Essentials', slug: 'Other', desc: 'Heritage cold-pressed oils, air care, emergency pods & home lifestyle.', img: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80', icon: 'Sparkles', order: 6 },
  ];

  for (const c of categories) {
    catStmt.run(c.id, c.name, c.slug, c.desc, c.img, c.icon, c.order);
  }

  // 3. PRODUCTS (Admin Source of Truth - INR Prices)
  const prodStmt = db.prepare(`
    INSERT INTO products (
      id, name, slug, brand, category_id, sub_category, description, price,
      stock_count, weight_grams, is_drone_eligible, is_active, image, badge
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const products = [
    {
      id: 'prod_elec_1',
      name: 'BoAt Storm GaN 65W Rapid Dual-Port Fast Charger',
      slug: 'boat-storm-gan-65w-rapid-fast-charger',
      brand: 'boAt',
      category_id: 'cat_elec',
      sub_category: 'Charging & Power',
      description: 'Ultra-compact Gallium Nitride 65W fast charger with dual Type-C and USB-A power delivery for Indian smartphones and laptops.',
      price: 1299.00,
      stock_count: 50,
      weight_grams: 180,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
      badge: 'Best Seller'
    },
    {
      id: 'prod_elec_2',
      name: 'Syska 20000mAh Heavy Duty Power Bank',
      slug: 'syska-20000mah-power-bank',
      brand: 'Syska',
      category_id: 'cat_elec',
      sub_category: 'Power Accessories',
      description: 'High-density 20000mAh external battery pack with 22.5W two-way fast charging and LED digital battery level display.',
      price: 1499.00,
      stock_count: 35,
      weight_grams: 420,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1609592424368-45097df6db82?w=600&auto=format&fit=crop&q=80',
      badge: 'High Capacity'
    },
    {
      id: 'prod_med_1',
      name: 'Apollo Rapid Emergency First-Aid Trauma Kit',
      slug: 'apollo-rapid-emergency-first-aid-trauma-kit',
      brand: 'Apollo Pharmacy',
      category_id: 'cat_med',
      sub_category: 'Emergency Care',
      description: 'Sterile hospital-grade emergency trauma pack with tourniquet, antiseptics, sterile gauze dressings, and burn shield.',
      price: 499.00,
      stock_count: 75,
      weight_grams: 450,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
      badge: 'Urgent Dispatch'
    },
    {
      id: 'prod_med_2',
      name: 'Amrutanjan Rapid Pain Relief & Vaporub Duo Pack',
      slug: 'amrutanjan-rapid-pain-relief-duo',
      brand: 'Amrutanjan Health',
      category_id: 'cat_med',
      sub_category: 'Pain Care',
      description: 'Trusted ayurvedic pain balm and eucalyptus chest rub for headache, congestion, and muscular fatigue.',
      price: 199.00,
      stock_count: 90,
      weight_grams: 150,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1550572017-ed200f5e5a43?w=600&auto=format&fit=crop&q=80',
      badge: 'Essential'
    },
    {
      id: 'prod_groc_1',
      name: 'Coimbatore Authentic Filter Coffee Blend (500g)',
      slug: 'coimbatore-authentic-filter-coffee-blend-500g',
      brand: 'Kovai Coffee Works',
      category_id: 'cat_groc',
      sub_category: 'Beverages',
      description: 'Traditional 80:20 plantation peaberry and chicory roast freshly grounded for a rich aromatic South Indian morning cup.',
      price: 340.00,
      stock_count: 65,
      weight_grams: 520,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
      badge: 'Local Favorite'
    },
    {
      id: 'prod_groc_2',
      name: 'Aavin Fresh Farm Pasteurized Pure Milk (1L x 2)',
      slug: 'aavin-fresh-farm-pure-milk-2l',
      brand: 'Aavin Tamil Nadu',
      category_id: 'cat_groc',
      sub_category: 'Dairy',
      description: 'Chilled pasteurized homogenized cow milk delivered in insulated flight thermal pods direct from local dairy union.',
      price: 120.00,
      stock_count: 120,
      weight_grams: 1050,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=600&auto=format&fit=crop&q=80',
      badge: 'Fresh Daily'
    },
    {
      id: 'prod_food_1',
      name: 'Anand Bhavan Ghee Mysore Pak Special Gift Box (400g)',
      slug: 'anand-bhavan-ghee-mysore-pak-400g',
      brand: 'Sri Anand Bhavan',
      category_id: 'cat_food',
      sub_category: 'Traditional Sweets',
      description: 'Melt-in-mouth traditional Coimbatore sweet crafted with pure desi ghee, gram flour, and cardamom.',
      price: 420.00,
      stock_count: 40,
      weight_grams: 450,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
      badge: 'Popular'
    },
    {
      id: 'prod_food_2',
      name: 'Kovai Crispy Masala Dosa & Sambar Breakfast Box',
      slug: 'kovai-crispy-masala-dosa-breakfast-box',
      brand: 'Kovai Kitchen Direct',
      category_id: 'cat_food',
      sub_category: 'Breakfast Combos',
      description: 'Crisp golden dosa filled with spiced potato masala, served steaming hot at 65°C with coconut chutney and piping hot sambar.',
      price: 180.00,
      stock_count: 30,
      weight_grams: 550,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
      badge: 'Hot Pod'
    },
    {
      id: 'prod_doc_1',
      name: 'Biometric Sealed Legal Document Security Pouch',
      slug: 'biometric-sealed-legal-document-pouch',
      brand: 'SkyNav Secure',
      category_id: 'cat_doc',
      sub_category: 'Legal Courier',
      description: 'Tamper-evident waterproof polymer envelope with dynamic QR seal, tracked end-to-end for contracts, property deeds, and certificates.',
      price: 250.00,
      stock_count: 100,
      weight_grams: 120,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80',
      badge: 'Secure Seal'
    },
    {
      id: 'prod_oth_1',
      name: 'Kovai Heritage Cold-Pressed Sesame Gingelly Oil (500ml)',
      slug: 'kovai-heritage-sesame-gingelly-oil-500ml',
      brand: 'Heritage Kovai Organics',
      category_id: 'cat_other',
      sub_category: 'Cooking Essentials',
      description: 'Wood-pressed authentic unrefined gingelly oil extracted with palm jaggery, ideal for South Indian traditional cooking.',
      price: 260.00,
      stock_count: 55,
      weight_grams: 520,
      is_drone_eligible: 1,
      is_active: 1,
      image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
      badge: 'Organic'
    }
  ];

  for (const p of products) {
    prodStmt.run(p.id, p.name, p.slug, p.brand, p.category_id, p.sub_category, p.description, p.price, p.stock_count, p.weight_grams, p.is_drone_eligible, p.is_active, p.image, p.badge);
  }

  // 4. 40 FLEET DRONES AT SKYHUB KURUMBAPALAYAM
  const droneModels = ['SKYNAV X1', 'SKYNAV X2', 'SKYNAV Cargo', 'SKYNAV VTOL', 'SKYNAV Heavy Cargo'];
  const hubLat = 11.1132;
  const hubLng = 77.0277;

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
    
    // Authoritative Hub: All idle drones stay at SkyHub Kurumbapalayam
    // 34 Available, 6 Charging at the hub docking bays
    const status = i <= 34 ? 'available' : 'charging';
    const battery = status === 'charging' ? 45 + (i % 30) : Math.min(100, 85 + (i * 3) % 16);

    droneStmt.run(
      id,
      `SkyNav Unit ${i}`,
      model,
      `SN-SKY-${80000 + i}`,
      `UIN-IND-SKY-${10000 + i}`,
      status,
      battery,
      92 + (i % 8),
      40 + (i * 12) % 100,
      capacity,
      hubLat,
      hubLng
    );
  }

  // 5. GEOFENCE ZONES (Coimbatore / Tamil Nadu DGCA)
  const geoStmt = db.prepare(`
    INSERT INTO geofence_zones (id, name, type, coordinates_json, bounds_radius_meters, active, max_altitude_meters, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  geoStmt.run('GEO-01', 'Coimbatore International Airport (CJB) Exclusion Buffer', 'nofly', JSON.stringify([[11.0298, 77.0434]]), 5000, 1, 3000, 'DGCA UAS Rules 2021 Class D Airspace Corridor');
  geoStmt.run('GEO-02', 'Sulur Air Force Station (AFS Sulur) Military Zone', 'restricted', JSON.stringify([[11.0136, 77.1611]]), 6000, 1, 4000, 'MoD IAF Defense Flight Training Range & Red Zone');
  geoStmt.run('GEO-03', 'Kurumbapalayam Operations & Delivery Corridor', 'delivery', JSON.stringify([[11.1132, 77.0277]]), 12000, 1, 120, 'Primary Autonomous Delivery Flight Corridor for Kurumbapalayam & Coimbatore North');
  geoStmt.run('GEO-04', 'CMCH & PSG Hospitals Medical Heliport Caution Area', 'caution', JSON.stringify([[11.0250, 77.0300]]), 1200, 1, 350, 'Emergency Medevac Helicopter Transit Corridor');

  // 6. MAINTENANCE RECORDS
  const maintStmt = db.prepare(`
    INSERT INTO maintenance_records (id, drone_id, issue, priority, scheduled_date, status, technician, notes)
    VALUES (?, ?, ?, ?, date('now', '+3 days'), 'Scheduled', ?, ?)
  `);

  maintStmt.run('MNT-01', 'D-005', 'Rotor blade leading-edge micro-pitting detected during preflight inspection', 'Medium', 'Muthukumar K', 'Scheduled 100-cycle rotor replacement.');
  maintStmt.run('MNT-02', 'D-012', 'LiDAR obstacle sensor calibration drift (+1.2cm variance)', 'Low', 'Fleet Tech A', 'Sensor array software zero-point recalibration.');
  maintStmt.run('MNT-03', 'D-024', 'Battery cell #4 internal resistance higher than nominal (+8%)', 'High', 'Muthukumar K', 'Replace smart battery power pack module.');

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
    { productId: 'prod_food_1', name: 'Anand Bhavan Ghee Mysore Pak Special Gift Box (400g)', quantity: 1, price: 420.00 },
    { productId: 'prod_med_1', name: 'Apollo Rapid Emergency First-Aid Trauma Kit', quantity: 1, price: 499.00 }
  ]);

  const items2 = JSON.stringify([
    { productId: 'prod_elec_1', name: 'BoAt Storm GaN 65W Rapid Dual-Port Fast Charger', quantity: 1, price: 1299.00 }
  ]);

  // ORD-1001: Delivered
  opOrderStmt.run(
    'ORD-1001',
    'ORD-1001',
    'SkyNav Customer',
    '+91 98422 10002',
    'Food & Trauma Kit Pod',
    0.90,
    items1,
    'SkyHub Kurumbapalayam (11.1132, 77.0277)',
    11.1132,
    77.0277,
    'Tech Corridor Block 4, Kalapatti Main Road, Coimbatore, Tamil Nadu, 641048',
    11.0725,
    77.0345,
    'standard',
    'delivered',
    'D-002',
    'MSN-1001',
    '7842',
    968.00,
    '-2 days',
    '-2 days'
  );

  missionStmt.run(
    'MSN-1001',
    'ORD-1001',
    'ORD-1001',
    'D-002',
    JSON.stringify([[11.1132, 77.0277], [11.0928, 77.0311], [11.0725, 77.0345]]),
    JSON.stringify([[11.1132, 77.0277], [11.0928, 77.0311], [11.0725, 77.0345]]),
    4.6,
    11,
    'delivered',
    11.1132,
    77.0277,
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
    'SkyNav Customer',
    '+91 98422 10002',
    'High-Speed Tech Pod',
    0.18,
    items2,
    'SkyHub Kurumbapalayam (11.1132, 77.0277)',
    11.1132,
    77.0277,
    'Tech Corridor Block 4, Kalapatti Main Road, Coimbatore, Tamil Nadu, 641048',
    11.0725,
    77.0345,
    'express',
    'pending_dispatch',
    null,
    null,
    '3195',
    1387.00,
    '-1 hour',
    '-1 hour'
  );

  // 8. SYSTEM NOTIFICATIONS
  const notifStmt = db.prepare(`
    INSERT INTO system_notifications (id, title, message, category, read)
    VALUES (?, ?, ?, ?, ?)
  `);

  notifStmt.run('NOTIF-01', 'Fleet Readiness 100%', 'All 40 autonomous delivery drones connected to SkyHub Kurumbapalayam.', 'success', 0);
  notifStmt.run('NOTIF-02', 'Weather Advisory', 'Kurumbapalayam / Coimbatore: Wind speed 11 km/h, clear visibility. Optimal flight conditions.', 'info', 0);
  notifStmt.run('NOTIF-03', 'Airspace Clearance', 'DGCA Digital Sky automated corridor authorization active for Kurumbapalayam operational zone.', 'info', 1);

  // 9. AUDIT LOGS
  const auditStmt = db.prepare(`
    INSERT INTO audit_logs (id, admin_name, admin_role, action, entity, entity_id, severity, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  auditStmt.run('LOG-01', 'SkyNav Administrator', 'admin', 'SYSTEM_INITIALIZATION', 'System', 'CORE', 'Info', 'SkyNav Autonomous Drone System initialized for Kurumbapalayam, Coimbatore, Tamil Nadu, India');

  console.log('✅ SkyNav Admin Database seeded with single Admin (admin@skynav), Indian Products, Categories, 40 Drones at SkyHub Kurumbapalayam, Geofences, Orders & Missions.');
};

seedAdminDatabase().catch((err) => {
  console.error('Error seeding admin database:', err);
  process.exit(1);
});
