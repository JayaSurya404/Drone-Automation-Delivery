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

export const seedDatabase = async () => {
  console.log('🌱 Initializing schema and seeding SkyNav Customer database (Coimbatore / Kurumbapalayam)...');
  initDb();

  // Clear existing records
  db.exec(`
    DELETE FROM support_messages;
    DELETE FROM support_tickets;
    DELETE FROM reviews;
    DELETE FROM notifications;
    DELETE FROM deliveries;
    DELETE FROM order_status_history;
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM wishlist_items;
    DELETE FROM wishlists;
    DELETE FROM cart_items;
    DELETE FROM carts;
    DELETE FROM addresses;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM drones;
    DELETE FROM delivery_zones;
    DELETE FROM notification_preferences;
    DELETE FROM users;
    DELETE FROM faqs;
  `);

  // 1. SEED SINGLE DEVELOPMENT CUSTOMER (customer@skynav / skynav@123)
  const passwordHash = await bcrypt.hash('skynav@123', 10);
  const userId = 'cust_skynav_dev';

  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, avatar, is_verified, account_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 'active', datetime('now', '-30 days'), datetime('now'))
  `).run(
    userId,
    'SkyNav Customer',
    'customer@skynav',
    '+91 98422 10002',
    passwordHash,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
  );

  // Notification Preferences
  db.prepare(`
    INSERT INTO notification_preferences (user_id, email_updates, sms_alerts, drone_proximity_sound)
    VALUES (?, 1, 1, 1)
  `).run(userId);

  // Initialize Cart & Wishlist for customer@skynav
  const cartId = `cart_${userId}`;
  const wishlistId = `wish_${userId}`;
  db.prepare(`INSERT INTO carts (id, customer_id) VALUES (?, ?)`).run(cartId, userId);
  db.prepare(`INSERT INTO wishlists (id, customer_id) VALUES (?, ?)`).run(wishlistId, userId);

  // 2. SEED AUTHORITATIVE FULFILLMENT HUB & DELIVERY ZONE
  const zoneStmt = db.prepare(`
    INSERT INTO delivery_zones (id, name, hub_name, hub_latitude, hub_longitude, radius_km, max_drone_weight_kg, base_fee, express_surcharge, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  zoneStmt.run(
    'zone_coimbatore_cbe',
    'Coimbatore Urban Autonomous Flight Corridor',
    'SkyHub Kurumbapalayam',
    11.1132,
    77.0277,
    12.0,
    5.0,
    49.00,
    39.00,
    'ACTIVE'
  );

  // 3. SEED DRONES FLEET AT SKYHUB KURUMBAPALAYAM
  const droneStmt = db.prepare(`
    INSERT INTO drones (id, identifier, model, status, battery_level, latitude, longitude, altitude, heading, speed_kmh, max_payload_kg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  droneStmt.run('drone_01', 'SkyNav Alpha-01', 'AeroCarrier Hexacopter v4', 'AVAILABLE', 98, 11.1132, 77.0277, 0, 0, 0, 4.5);
  droneStmt.run('drone_02', 'SkyNav Falcon-02', 'AeroCarrier HeavyLift v5', 'AVAILABLE', 100, 11.1132, 77.0277, 0, 0, 0, 5.0);
  droneStmt.run('drone_03', 'SkyNav Osprey-03', 'Osprey Rapid VTOL', 'AVAILABLE', 92, 11.1132, 77.0277, 0, 0, 0, 3.5);
  droneStmt.run('drone_04', 'SkyNav Swift-04', 'SwiftCourier MedPod', 'AVAILABLE', 88, 11.1132, 77.0277, 0, 0, 0, 2.5);
  droneStmt.run('drone_05', 'SkyNav Hawk-05', 'SkyNav Hawk Cargo-X', 'AVAILABLE', 95, 11.1132, 77.0277, 0, 0, 0, 4.0);

  // 4. SEED CATEGORIES
  const categoryStmt = db.prepare(`
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
    categoryStmt.run(c.id, c.name, c.slug, c.desc, c.img, c.icon, c.order);
  }

  // 5. SEED PRODUCTS (INR Prices)
  const productStmt = db.prepare(`
    INSERT INTO products (
      id, name, slug, brand, category_id, sub_category, description, price,
      original_price, discount_percent, rating, review_count, in_stock, stock_count,
      is_drone_eligible, weight_grams, dimensions, estimated_delivery_mins,
      badge, features_json, specifications_json, image, images_json
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  const products = [
    {
      id: 'prod_elec_1',
      name: 'BoAt Storm GaN 65W Rapid Dual-Port Fast Charger',
      slug: 'boat-storm-gan-65w-rapid-fast-charger',
      brand: 'boAt',
      categoryId: 'cat_elec',
      category: 'Electronics',
      subCategory: 'Charging & Power',
      description: 'Ultra-compact Gallium Nitride 65W fast charger with dual Type-C and USB-A power delivery for Indian smartphones and laptops.',
      price: 1299.00,
      originalPrice: 1999.00,
      discountPercent: 35,
      rating: 4.9,
      reviewCount: 342,
      inStock: 1,
      stockCount: 50,
      isDroneEligible: 1,
      weightGrams: 180,
      dimensions: '5.2 x 4.8 x 3.1 cm',
      deliveryMins: 11,
      badge: 'Best Seller',
      featured: 1,
      tags: JSON.stringify(['gan', 'fast-charger', 'boat', 'electronics', 'type-c']),
      image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
      images: JSON.stringify(['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80']),
      specs: JSON.stringify({ 'Wattage': '65W GaN', 'Ports': '2x USB-C, 1x USB-A', 'Protocol': 'PD 3.0 / QC 4+', 'Weight': '180g' })
    },
    {
      id: 'prod_elec_2',
      name: 'Syska 20000mAh Heavy Duty Power Bank',
      slug: 'syska-20000mah-power-bank',
      brand: 'Syska',
      categoryId: 'cat_elec',
      category: 'Electronics',
      subCategory: 'Power Accessories',
      description: 'High-density 20000mAh external battery pack with 22.5W two-way fast charging and LED digital battery level display.',
      price: 1499.00,
      originalPrice: 2499.00,
      discountPercent: 40,
      rating: 4.8,
      reviewCount: 218,
      inStock: 1,
      stockCount: 35,
      isDroneEligible: 1,
      weightGrams: 420,
      dimensions: '14.2 x 6.8 x 2.8 cm',
      deliveryMins: 12,
      badge: 'High Capacity',
      featured: 1,
      tags: JSON.stringify(['powerbank', 'syska', 'battery', 'fast-charge']),
      image: 'https://images.unsplash.com/photo-1609592424368-45097df6db82?w=600&auto=format&fit=crop&q=80',
      images: JSON.stringify(['https://images.unsplash.com/photo-1609592424368-45097df6db82?w=600&auto=format&fit=crop&q=80']),
      specs: JSON.stringify({ 'Capacity': '20000mAh', 'Output': '22.5W Fast Charge', 'Ports': 'Micro-USB, Type-C, USB-A', 'Weight': '420g' })
    },
    {
      id: 'prod_med_1',
      name: 'Apollo Rapid Emergency First-Aid Trauma Kit',
      slug: 'apollo-rapid-emergency-first-aid-trauma-kit',
      brand: 'Apollo Pharmacy',
      categoryId: 'cat_med',
      category: 'Medicine',
      subCategory: 'Emergency Care',
      description: 'Sterile hospital-grade emergency trauma pack with tourniquet, antiseptics, sterile gauze dressings, and burn shield.',
      price: 499.00,
      originalPrice: 699.00,
      discountPercent: 28,
      rating: 5.0,
      reviewCount: 512,
      inStock: 1,
      stockCount: 75,
      isDroneEligible: 1,
      weightGrams: 450,
      dimensions: '18 x 12 x 8 cm',
      deliveryMins: 8,
      badge: 'Urgent Dispatch',
      featured: 1,
      tags: JSON.stringify(['trauma', 'first-aid', 'apollo', 'sterile', 'emergency']),
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
      images: JSON.stringify(['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80']),
      specs: JSON.stringify({ 'Certification': 'ISO 13485 / Apollo Healthcare', 'Contents': '38 Sterile Items', 'Drop Method': 'Shock-Absorbing Pod', 'Weight': '450g' })
    },
    {
      id: 'prod_med_2',
      name: 'Amrutanjan Rapid Pain Relief & Vaporub Duo Pack',
      slug: 'amrutanjan-rapid-pain-relief-duo',
      brand: 'Amrutanjan Health',
      categoryId: 'cat_med',
      category: 'Medicine',
      subCategory: 'Pain Care',
      description: 'Trusted ayurvedic pain balm and eucalyptus chest rub for headache, congestion, and muscular fatigue.',
      price: 199.00,
      originalPrice: 260.00,
      discountPercent: 23,
      rating: 4.8,
      reviewCount: 420,
      inStock: 1,
      stockCount: 90,
      isDroneEligible: 1,
      weightGrams: 150,
      dimensions: '10 x 6 x 5 cm',
      deliveryMins: 9,
      badge: 'Essential',
      featured: 0,
      tags: JSON.stringify(['pain-relief', 'balm', 'ayurvedic', 'amrutanjan']),
      image: 'https://images.unsplash.com/photo-1550572017-ed200f5e5a43?w=600&auto=format&fit=crop&q=80',
      images: JSON.stringify(['https://images.unsplash.com/photo-1550572017-ed200f5e5a43?w=600&auto=format&fit=crop&q=80']),
      specs: JSON.stringify({ 'Form': 'Herbal Balm & Rub', 'Net Volume': '50g + 30g', 'Active Herbs': 'Pudina, Gandhapura, Eucalyptus' })
    },
    {
      id: 'prod_groc_1',
      name: 'Coimbatore Authentic Filter Coffee Blend (500g)',
      slug: 'coimbatore-authentic-filter-coffee-blend-500g',
      brand: 'Kovai Coffee Works',
      categoryId: 'cat_groc',
      category: 'Groceries',
      subCategory: 'Beverages',
      description: 'Traditional 80:20 plantation peaberry and chicory roast freshly grounded for a rich aromatic South Indian morning cup.',
      price: 340.00,
      originalPrice: 420.00,
      discountPercent: 19,
      rating: 4.9,
      reviewCount: 680,
      inStock: 1,
      stockCount: 65,
      isDroneEligible: 1,
      weightGrams: 520,
      dimensions: '16 x 10 x 6 cm',
      deliveryMins: 11,
      badge: 'Local Favorite',
      featured: 1,
      tags: JSON.stringify(['coffee', 'filter-coffee', 'coimbatore', 'south-indian']),
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
      images: JSON.stringify(['https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80']),
      specs: JSON.stringify({ 'Roast': 'Medium-Dark', 'Blend Ratio': '80% Coffee : 20% Chicory', 'Origin': 'Western Ghats / Anamalai Hills' })
    },
    {
      id: 'prod_groc_2',
      name: 'Aavin Fresh Farm Pasteurized Pure Milk (1L x 2)',
      slug: 'aavin-fresh-farm-pure-milk-2l',
      brand: 'Aavin Tamil Nadu',
      categoryId: 'cat_groc',
      category: 'Groceries',
      subCategory: 'Dairy',
      description: 'Chilled pasteurized homogenized cow milk delivered in insulated flight thermal pods direct from local dairy union.',
      price: 120.00,
      originalPrice: 130.00,
      discountPercent: 8,
      rating: 4.9,
      reviewCount: 1100,
      inStock: 1,
      stockCount: 120,
      isDroneEligible: 1,
      weightGrams: 1050,
      dimensions: '20 x 14 x 10 cm',
      deliveryMins: 10,
      badge: 'Fresh Daily',
      featured: 1,
      tags: JSON.stringify(['milk', 'aavin', 'fresh', 'dairy', 'coimbatore']),
      image: 'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=600&auto=format&fit=crop&q=80',
      images: JSON.stringify(['https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=600&auto=format&fit=crop&q=80']),
      specs: JSON.stringify({ 'Volume': '2 Litres (1L x 2)', 'Fat Content': '4.5% Standardized', 'Temperature': 'Chilled 4°C Pod' })
    },
    {
      id: 'prod_food_1',
      name: 'Anand Bhavan Ghee Mysore Pak Special Gift Box (400g)',
      slug: 'anand-bhavan-ghee-mysore-pak-400g',
      brand: 'Sri Anand Bhavan',
      categoryId: 'cat_food',
      category: 'Food',
      subCategory: 'Traditional Sweets',
      description: 'Melt-in-mouth traditional Coimbatore sweet crafted with pure desi ghee, gram flour, and cardamom.',
      price: 420.00,
      originalPrice: 480.00,
      discountPercent: 12,
      rating: 5.0,
      reviewCount: 390,
      inStock: 1,
      stockCount: 40,
      isDroneEligible: 1,
      weightGrams: 450,
      dimensions: '18 x 14 x 5 cm',
      deliveryMins: 13,
      badge: 'Popular',
      featured: 1,
      tags: JSON.stringify(['sweets', 'mysore-pak', 'ghee', 'coimbatore', 'anand-bhavan']),
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
      images: JSON.stringify(['https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80']),
      specs: JSON.stringify({ 'Weight': '400g Net', 'Ingredients': 'Pure Desi Ghee, Gram Flour, Sugar, Cardamom', 'Shelf Life': '15 Days' })
    },
    {
      id: 'prod_food_2',
      name: 'Kovai Crispy Masala Dosa & Sambar Breakfast Box',
      slug: 'kovai-crispy-masala-dosa-breakfast-box',
      brand: 'Kovai Kitchen Direct',
      categoryId: 'cat_food',
      category: 'Food',
      subCategory: 'Breakfast Combos',
      description: 'Crisp golden dosa filled with spiced potato masala, served steaming hot at 65°C with coconut chutney and piping hot sambar.',
      price: 180.00,
      originalPrice: 220.00,
      discountPercent: 18,
      rating: 4.8,
      reviewCount: 520,
      inStock: 1,
      stockCount: 30,
      isDroneEligible: 1,
      weightGrams: 550,
      dimensions: '22 x 18 x 8 cm',
      deliveryMins: 12,
      badge: 'Hot Pod',
      featured: 1,
      tags: JSON.stringify(['dosa', 'breakfast', 'south-indian', 'hot-meal']),
      image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
      images: JSON.stringify(['https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80']),
      specs: JSON.stringify({ 'Packaging': 'Thermal Lock 65°C Pod', 'Includes': '2x Dosa, Sambar (200ml), Chutney', 'Weight': '550g' })
    },
    {
      id: 'prod_doc_1',
      name: 'Biometric Sealed Legal Document Security Pouch',
      slug: 'biometric-sealed-legal-document-pouch',
      brand: 'SkyNav Secure',
      categoryId: 'cat_doc',
      category: 'Documents',
      subCategory: 'Legal Courier',
      description: 'Tamper-evident waterproof polymer envelope with dynamic QR seal, tracked end-to-end for contracts, property deeds, and certificates.',
      price: 250.00,
      originalPrice: 350.00,
      discountPercent: 28,
      rating: 4.9,
      reviewCount: 160,
      inStock: 1,
      stockCount: 100,
      isDroneEligible: 1,
      weightGrams: 120,
      dimensions: '32 x 24 x 1 cm',
      deliveryMins: 8,
      badge: 'Secure Seal',
      featured: 0,
      tags: JSON.stringify(['document', 'legal', 'secure', 'confidential']),
      image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80',
      images: JSON.stringify(['https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80']),
      specs: JSON.stringify({ 'Security': 'Dynamic Handover OTP', 'Capacity': 'Up to 50 A4 Sheets', 'Waterproofing': 'IP68 Enclosure' })
    },
    {
      id: 'prod_oth_1',
      name: 'Kovai Heritage Cold-Pressed Sesame Gingelly Oil (500ml)',
      slug: 'kovai-heritage-sesame-gingelly-oil-500ml',
      brand: 'Heritage Kovai Organics',
      categoryId: 'cat_other',
      category: 'Other',
      subCategory: 'Cooking Essentials',
      description: 'Wood-pressed authentic unrefined gingelly oil extracted with palm jaggery, ideal for South Indian traditional cooking.',
      price: 260.00,
      originalPrice: 320.00,
      discountPercent: 19,
      rating: 4.8,
      reviewCount: 290,
      inStock: 1,
      stockCount: 55,
      isDroneEligible: 1,
      weightGrams: 520,
      dimensions: '18 x 7 x 7 cm',
      deliveryMins: 11,
      badge: 'Organic',
      featured: 0,
      tags: JSON.stringify(['oil', 'gingelly', 'sesame', 'cold-pressed', 'organic']),
      image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
      images: JSON.stringify(['https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80']),
      specs: JSON.stringify({ 'Extraction': 'Traditional Wood Vaagai Chekku', 'Net Volume': '500ml', 'Purity': '100% Raw Unfiltered' })
    }
  ];

  for (const p of products) {
    productStmt.run(
      p.id, p.name, p.slug, p.brand, p.categoryId, p.subCategory, p.description, p.price,
      p.originalPrice, p.discountPercent, p.rating, p.reviewCount, p.inStock, p.stockCount,
      p.isDroneEligible, p.weightGrams, p.dimensions, p.deliveryMins,
      p.badge, p.tags, p.specs, p.image, p.images
    );
  }

  // 6. SEED SAVED CUSTOMER ADDRESSES IN COIMBATORE / KURUMBAPALAYAM
  const addrStmt = db.prepare(`
    INSERT INTO addresses (id, customer_id, label, name, phone, building, street, area, city, state, postal_code, latitude, longitude, instructions, is_default, drop_zone_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  addrStmt.run(
    'addr_1',
    userId,
    'Home',
    'SkyNav Customer',
    '+91 98422 10002',
    'Tech Corridor Block 4',
    'Kalapatti Main Road',
    'Kurumbapalayam / Kalapatti',
    'Coimbatore',
    'Tamil Nadu',
    '641048',
    11.0725,
    77.0345,
    'Backyard lawn landing pad marked with high-visibility SkyNav drone beacon.',
    1,
    'Lawn'
  );

  addrStmt.run(
    'addr_2',
    userId,
    'Office',
    'SkyNav Customer (Tech Office)',
    '+91 98422 10002',
    'Tidel Park Tech Center, 4th Floor',
    'Civil Aerodrome Post',
    'Peelamedu',
    'Coimbatore',
    'Tamil Nadu',
    '641014',
    11.0280,
    77.0260,
    'Designated rooftop drone landing pad on tower roof. Security clearance active.',
    0,
    'Rooftop Pad'
  );

  // 7. SEED INITIAL DATABASE-BACKED ORDERS
  const orderStmt = db.prepare(`
    INSERT INTO orders (
      id, customer_id, subtotal, delivery_fee, tax, discount, total,
      payment_method, payment_status, status, delivery_speed, delivery_address_json,
      delivery_instructions, drop_zone_type, delivery_otp, is_cancellable,
      estimated_delivery_time, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?), ?)
  `);

  const orderItemStmt = db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, product_name, product_image, unit_price, quantity, total_price, weight_grams)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const statusHistoryStmt = db.prepare(`
    INSERT INTO order_status_history (id, order_id, previous_status, new_status, description, completed, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  // ORD-1001 (Delivered past order)
  const addrSnapshot1 = JSON.stringify({
    name: 'SkyNav Customer',
    phone: '+91 98422 10002',
    building: 'Tech Corridor Block 4',
    street: 'Kalapatti Main Road',
    area: 'Kurumbapalayam / Kalapatti',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    postalCode: '641048',
    dropZoneType: 'Lawn'
  });

  orderStmt.run(
    'ORD-1001',
    userId,
    919.00,
    49.00,
    45.95,
    0,
    1013.95,
    'Credit Card',
    'Paid',
    'Delivered',
    'standard',
    addrSnapshot1,
    'Lower pod gently onto designated lawn beacon.',
    'Lawn',
    '7842',
    0,
    '14 mins',
    '-2 days',
    '-2 days',
    new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  );

  orderItemStmt.run('item_1001_1', 'ORD-1001', 'prod_food_1', 'Anand Bhavan Ghee Mysore Pak Special Gift Box (400g)', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80', 420.00, 1, 420.00, 450);
  orderItemStmt.run('item_1001_2', 'ORD-1001', 'prod_med_1', 'Apollo Rapid Emergency First-Aid Trauma Kit', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80', 499.00, 1, 499.00, 450);

  statusHistoryStmt.run('hist_1001_1', 'ORD-1001', null, 'Order Placed', 'Order placed successfully.', 1, '-2 days');
  statusHistoryStmt.run('hist_1001_2', 'ORD-1001', 'Order Placed', 'Order Confirmed', 'Payment confirmed via Razorpay.', 1, '-2 days');
  statusHistoryStmt.run('hist_1001_3', 'ORD-1001', 'Order Confirmed', 'Preparing', 'Items packed at SkyHub Kurumbapalayam.', 1, '-2 days');
  statusHistoryStmt.run('hist_1001_4', 'ORD-1001', 'Preparing', 'Drone Assigned', 'SkyNav Falcon-02 assigned to delivery.', 1, '-2 days');
  statusHistoryStmt.run('hist_1001_5', 'ORD-1001', 'Drone Assigned', 'Drone Launched', 'Autonomous drone dispatched via Kurumbapalayam corridor.', 1, '-2 days');
  statusHistoryStmt.run('hist_1001_6', 'ORD-1001', 'Drone Launched', 'Delivered', 'Autonomous payload tether lowered successfully.', 1, '-2 days');

  // 8. SEED INITIAL SAMPLE REVIEWS
  const revStmt = db.prepare(`
    INSERT INTO reviews (id, product_id, customer_id, author_name, author_avatar, rating, title, comment, verified_purchase, helpful_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  revStmt.run(
    'rev_1',
    'prod_food_1',
    userId,
    'Suresh Natarajan',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    5.0,
    'Mysore Pak arrived fresh and delicious!',
    'Arrived in 11 minutes straight to my lawn pad. The ghee aroma and freshness was unmatched.',
    1,
    24
  );

  revStmt.run(
    'rev_2',
    'prod_med_1',
    userId,
    'Dr. K. Senthil',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    5.0,
    'Lifesaving emergency delivery',
    'Urgent trauma kit needed during an emergency at home. Flown from SkyHub Kurumbapalayam in 8 minutes.',
    1,
    42
  );

  // 9. SEED FAQS
  const faqStmt = db.prepare(`
    INSERT INTO faqs (id, question, answer, category)
    VALUES (?, ?, ?, ?)
  `);

  const faqs = [
    { id: 'faq_1', q: 'How does autonomous drone delivery work in Coimbatore?', a: 'Once your order is confirmed, our SkyHub Kurumbapalayam hub packs your items into an aerodynamically sealed cargo pod and assigns an electric autonomous drone. The drone navigates certified DGCA aerial corridors at 100m altitude and gently lowers the package to your selected landing zone using sonar tether precision.', cat: 'Delivery' },
    { id: 'faq_2', q: 'Where can the drone land?', a: 'You can choose between a private lawn, designated rooftop pad, driveway, or balcony landing zone. Our drones use LiDAR obstacle sensing and precision optical beacons to deliver contactless and safe drop-offs.', cat: 'Drop Zones' },
    { id: 'faq_3', q: 'What is the drone delivery service radius?', a: 'Our service radius extends up to 12 km from SkyHub Kurumbapalayam, covering Kurumbapalayam, Kalapatti, Peelamedu, Saravanampatti, Chinniyampalayam, and surrounding Coimbatore regions.', cat: 'Service Area' },
    { id: 'faq_4', q: 'What is the maximum payload weight?', a: 'SkyNav standard drones carry up to 5.0 kg. If your basket exceeds this weight, our system automatically schedules a tandem multi-drone flight or heavy-lift carrier.', cat: 'Orders' },
  ];

  for (const f of faqs) {
    faqStmt.run(f.id, f.q, f.a, f.cat);
  }

  // 10. SEED DEFAULT NOTIFICATIONS
  const notifStmt = db.prepare(`
    INSERT INTO notifications (id, customer_id, title, message, type, is_read, order_id, event_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  notifStmt.run(
    'notif_1',
    userId,
    'Welcome to SkyNav Aero Store',
    'Your customer account is active and ready for autonomous drone deliveries in Coimbatore.',
    'system',
    0,
    null,
    'evt_welcome_init',
    '-2 hours'
  );

  notifStmt.run(
    'notif_2',
    userId,
    'SkyHub Kurumbapalayam Corridor Active',
    'Clear skies across Coimbatore. Average delivery time is currently 10–14 minutes.',
    'promo',
    0,
    null,
    'evt_corridor_active',
    '-30 minutes'
  );

  console.log('✅ Customer Database seeded successfully with Indian Products (INR), Categories, Drones, SkyHub Kurumbapalayam, customer@skynav, and Saved Coimbatore Addresses!');
};

// If run directly via tsx
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase().catch((err) => {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  });
}
