import bcrypt from 'bcryptjs';
import { db, initDb } from './database.js';

export const seedDatabase = async () => {
  console.log('🌱 Initializing schema and seeding SkyNav Drone database...');
  initDb();

  // Clear existing records to ensure clean idempotent seed
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

  // 1. SEED DEFAULT USER (Alex Mercer)
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const userId = 'cust_984210';

  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, avatar, is_verified, account_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-30 days'), datetime('now'))
  `).run(
    userId,
    'Alex Mercer',
    'alex.mercer@skynav.io',
    '+1 (555) 248-7790',
    passwordHash,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    1,
    'active'
  );

  // Notification Preferences
  db.prepare(`
    INSERT INTO notification_preferences (user_id, email_updates, sms_alerts, drone_proximity_sound)
    VALUES (?, 1, 1, 1)
  `).run(userId);

  // Initialize Cart & Wishlist for user
  const cartId = 'cart_984210';
  const wishlistId = 'wish_984210';
  db.prepare(`INSERT INTO carts (id, customer_id) VALUES (?, ?)`).run(cartId, userId);
  db.prepare(`INSERT INTO wishlists (id, customer_id) VALUES (?, ?)`).run(wishlistId, userId);

  // 2. SEED FULFILLMENT HUBS & DELIVERY ZONES
  const zoneStmt = db.prepare(`
    INSERT INTO delivery_zones (id, name, hub_name, hub_latitude, hub_longitude, radius_km, max_drone_weight_kg, base_fee, express_surcharge, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  zoneStmt.run(
    'zone_sf_central',
    'San Francisco Metro Urban Corridor',
    'SkyHub Aero Fulfillment Central #1',
    37.7625,
    -122.4480,
    18.5,
    5.0,
    3.99,
    3.50,
    'ACTIVE'
  );

  zoneStmt.run(
    'zone_soma_tech',
    'SoMa & Mission High-Density Bay Corridor',
    'SkyHub Bay Gateway Station #2',
    37.7850,
    -122.3950,
    12.0,
    4.5,
    3.99,
    2.99,
    'ACTIVE'
  );

  // 3. SEED DRONES FLEET
  const droneStmt = db.prepare(`
    INSERT INTO drones (id, identifier, model, status, battery_level, latitude, longitude, altitude, heading, speed_kmh, max_payload_kg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  droneStmt.run('drone_01', 'SkyNav Alpha-01', 'AeroCarrier Hexacopter v4', 'AVAILABLE', 98, 37.7625, -122.4480, 0, 0, 0, 4.5);
  droneStmt.run('drone_02', 'SkyNav Falcon-02', 'AeroCarrier HeavyLift v5', 'AVAILABLE', 100, 37.7625, -122.4480, 0, 0, 0, 5.0);
  droneStmt.run('drone_03', 'SkyNav Osprey-03', 'Osprey Rapid VTOL', 'AVAILABLE', 92, 37.7850, -122.3950, 0, 0, 0, 3.5);
  droneStmt.run('drone_04', 'SkyNav Swift-04', 'SwiftCourier MedPod', 'AVAILABLE', 88, 37.7625, -122.4480, 0, 0, 0, 2.5);
  droneStmt.run('drone_05', 'SkyNav Hawk-05', 'SkyNav Hawk Cargo-X', 'AVAILABLE', 95, 37.7850, -122.3950, 0, 0, 0, 4.0);

  // 4. SEED CATEGORIES
  const categoryStmt = db.prepare(`
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
    categoryStmt.run(c.id, c.name, c.slug, c.desc, c.img, c.icon, c.order);
  }

  // 5. SEED PRODUCTS
  const prodStmt = db.prepare(`
    INSERT INTO products (
      id, name, slug, brand, category_id, sub_category, description, price, original_price,
      discount_percent, rating, review_count, image, images_json, is_drone_eligible, max_payload_kg,
      estimated_delivery_mins, in_stock, stock_count, badge, features_json, specifications_json,
      dimensions, weight_grams
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const products = [
    {
      id: 'prod_food_1',
      name: 'Artisan Woodfired Truffle Mushroom Pizza (12")',
      slug: 'artisan-woodfired-truffle-mushroom-pizza-12',
      brand: 'Bella Napoli Aero Kitchen',
      category_id: 'cat_food',
      sub_category: 'Italian Gourmet',
      description: 'Hand-stretched 48-hour fermented sourdough crust topped with black truffle puree, wild foraged cremini mushrooms, fresh buffalo mozzarella, and aged Parmigiano Reggiano. Dispatched in an insulated thermal heat-lock pod ensuring 68°C table-ready temperature on arrival.',
      price: 21.99,
      original_price: 28.00,
      discount_percent: 21,
      rating: 4.9,
      review_count: 310,
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&auto=format&fit=crop&q=80'
      ]),
      is_drone_eligible: 1,
      max_payload_kg: 1.5,
      estimated_delivery_mins: 14,
      in_stock: 1,
      stock_count: 45,
      badge: 'Popular',
      features_json: JSON.stringify([
        '48h naturally fermented sourdough',
        'Italian black truffle reduction & wild mushrooms',
        'Insulated 68°C thermal drone pod dispatch'
      ]),
      specifications_json: JSON.stringify({ Size: '12 inches', Servings: '1-2 persons', Temp: 'Thermal Lock 68°C', Crust: 'Sourdough' }),
      dimensions: '32 x 32 x 5 cm',
      weight_grams: 580,
    },
    {
      id: 'prod_food_2',
      name: 'Kyoto Special Wild Salmon Sashimi & Nigiri Bento',
      slug: 'kyoto-special-wild-salmon-sashimi-nigiri-bento',
      brand: 'Sora Craft Sushi Lab',
      category_id: 'cat_food',
      sub_category: 'Japanese Cuisine',
      description: 'Chef selection of Norwegian wild salmon sashimi, king salmon nigiri, spicy salmon roll, house pickled ginger, and fresh grated Shizuoka wasabi. Transported in a precision active sub-zero gel cooling chamber to preserve pristine raw fish texture.',
      price: 26.50,
      original_price: 34.00,
      discount_percent: 22,
      rating: 4.95,
      review_count: 220,
      image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80'
      ]),
      is_drone_eligible: 1,
      max_payload_kg: 1.2,
      estimated_delivery_mins: 12,
      in_stock: 1,
      stock_count: 30,
      badge: 'Chef Special',
      features_json: JSON.stringify([
        'Fresh daily wild-caught Norwegian salmon',
        'Active sub-zero cooling capsule dispatch',
        'Includes authentic Shizuoka fresh wasabi'
      ]),
      specifications_json: JSON.stringify({ Pieces: '18 pieces', Diet: 'Gluten-conscious', Packaging: 'Cold-Lock Sealed' }),
      dimensions: '25 x 18 x 4 cm',
      weight_grams: 420,
    },
    {
      id: 'prod_med_1',
      name: 'AeroFirst Rapid First Aid & Trauma Burn Kit',
      slug: 'aerofirst-rapid-first-aid-trauma-burn-kit',
      brand: 'AeroMed Safety Corp',
      category_id: 'cat_med',
      sub_category: 'Emergency Supplies',
      description: 'Hospital-grade emergency trauma pack certified for rapid aerial dispatch. Contains sterile trauma bandages, burn hydrogels, tourniquet, antiseptic wipes, shears, instant cold packs, and emergency instructions.',
      price: 34.99,
      original_price: 49.99,
      discount_percent: 30,
      rating: 4.9,
      review_count: 142,
      image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&auto=format&fit=crop&q=80',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&auto=format&fit=crop&q=80'
      ]),
      is_drone_eligible: 1,
      max_payload_kg: 2.0,
      estimated_delivery_mins: 9,
      in_stock: 1,
      stock_count: 85,
      badge: 'Critical Urgent',
      features_json: JSON.stringify([
        'High-priority aerial flight dispatch',
        'Complete burn gel & trauma wound coverage',
        'Waterproof hermetic sealing'
      ]),
      specifications_json: JSON.stringify({ Standard: 'OSHA & ANSI Compliant', Pieces: '64 items', Expiry: '2028-12' }),
      dimensions: '22 x 15 x 8 cm',
      weight_grams: 650,
    },
    {
      id: 'prod_med_2',
      name: 'Glucofast Instant Glucose Monitor & 50 Test Strips',
      slug: 'glucofast-instant-glucose-monitor-50-test-strips',
      brand: 'AeroMed Diagnostics',
      category_id: 'cat_med',
      sub_category: 'Diagnostic Health',
      description: 'High-precision blood glucose monitoring device with Bluetooth 5.2 cloud sync. Delivers accurate readings in under 5 seconds with zero coding required. Includes 50 sterile test strips and lancing device.',
      price: 44.50,
      original_price: 59.99,
      discount_percent: 26,
      rating: 4.8,
      review_count: 96,
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80'
      ]),
      is_drone_eligible: 1,
      max_payload_kg: 1.0,
      estimated_delivery_mins: 11,
      in_stock: 1,
      stock_count: 40,
      badge: 'Trending',
      features_json: JSON.stringify([
        '5-second rapid measurement',
        'Bluetooth sync to smartphone health apps',
        'Includes 50 calibrated test strips'
      ]),
      specifications_json: JSON.stringify({ Battery: 'CR2032 included', Memory: '500 readings', Connectivity: 'Bluetooth 5.2' }),
      dimensions: '10 x 6 x 2 cm',
      weight_grams: 180,
    },
    {
      id: 'prod_med_3',
      name: 'BioShield Rapid Antihistamine & Allergy Relief (30 Caps)',
      slug: 'bioshield-rapid-antihistamine-allergy-relief-30-caps',
      brand: 'BioShield Pharma',
      category_id: 'cat_med',
      sub_category: 'Pharmacy',
      description: 'Non-drowsy 24h fast relief tablets for acute seasonal pollen, dust, animal dander, and respiratory allergic irritation. Fast dissolving softgels.',
      price: 16.50,
      original_price: 22.00,
      discount_percent: 25,
      rating: 4.7,
      review_count: 88,
      image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&auto=format&fit=crop&q=80',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&auto=format&fit=crop&q=80'
      ]),
      is_drone_eligible: 1,
      max_payload_kg: 0.5,
      estimated_delivery_mins: 10,
      in_stock: 1,
      stock_count: 120,
      badge: 'Best Seller',
      features_json: JSON.stringify([
        'Non-drowsy 24h active formula',
        'Fast acting within 15 minutes',
        'Doctor recommended active ingredients'
      ]),
      specifications_json: JSON.stringify({ Quantity: '30 softgels', Dosage: '1 capsule per 24h', Expiry: '2027-06' }),
      dimensions: '8 x 4 x 4 cm',
      weight_grams: 85,
    },
    {
      id: 'prod_groc_1',
      name: 'Organic Whole Fair-Trade Coffee Beans (1kg)',
      slug: 'organic-whole-fair-trade-coffee-beans-1kg',
      brand: 'Sierra Summit Roasters',
      category_id: 'cat_groc',
      sub_category: 'Coffee & Tea',
      description: 'Single-origin Ethiopian Yirgacheffe medium roast. Notes of bergamot, dark chocolate, and wild blueberry. Freshly roasted within 48 hours of aerial dispatch.',
      price: 18.99,
      original_price: 24.50,
      discount_percent: 22,
      rating: 4.85,
      review_count: 195,
      image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80'
      ]),
      is_drone_eligible: 1,
      max_payload_kg: 1.5,
      estimated_delivery_mins: 15,
      in_stock: 1,
      stock_count: 65,
      badge: 'Fresh Roast',
      features_json: JSON.stringify([
        '100% USDA Organic & Fair Trade',
        'Aromatically sealed one-way valve bag',
        'Medium roast Ethiopian Yirgacheffe'
      ]),
      specifications_json: JSON.stringify({ Weight: '1000g / 2.2 lbs', Roast: 'Medium', Origin: 'Ethiopia' }),
      dimensions: '14 x 9 x 24 cm',
      weight_grams: 1020,
    },
    {
      id: 'prod_elec_1',
      name: 'VoltWave 100W GaN Pro Fast Charger & 240W Cable',
      slug: 'voltwave-100w-gan-pro-fast-charger-240w-cable',
      brand: 'VoltWave Technologies',
      category_id: 'cat_elec',
      sub_category: 'Charging & Power',
      description: 'Ultra-compact Gallium Nitride (GaN III) fast wall charger with 3x USB-C and 1x USB-A ports. Powers MacBook Pro 16", iPad, and iPhone simultaneously at peak speeds. Includes 2m braided 240W PD cable.',
      price: 39.99,
      original_price: 54.99,
      discount_percent: 27,
      rating: 4.9,
      review_count: 240,
      image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80'
      ]),
      is_drone_eligible: 1,
      max_payload_kg: 1.0,
      estimated_delivery_mins: 14,
      in_stock: 1,
      stock_count: 70,
      badge: 'Tech Choice',
      features_json: JSON.stringify([
        '100W total output via GaN III technology',
        'Charges 4 devices simultaneously',
        'Includes 240W braided silicone USB-C cable'
      ]),
      specifications_json: JSON.stringify({ Output: '100W Max', Ports: '3x USB-C, 1x USB-A', Warranty: '2 Years' }),
      dimensions: '6.5 x 6.5 x 3.2 cm',
      weight_grams: 220,
    },
    {
      id: 'prod_doc_1',
      name: 'Tamper-Evident Notary & Contract Courier Dispatch',
      slug: 'tamper-evident-notary-contract-courier-dispatch',
      brand: 'SkyNav Secure Courier',
      category_id: 'cat_doc',
      sub_category: 'Legal Logistics',
      description: 'RFID-sealed, military-grade ballistic nylon document pouch with dual-custody OTP biometric verification. Ideal for closing real estate deeds, legal filings, and sensitive corporate affidavits.',
      price: 29.00,
      original_price: 38.00,
      discount_percent: 23,
      rating: 4.95,
      review_count: 84,
      image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80'
      ]),
      is_drone_eligible: 1,
      max_payload_kg: 1.5,
      estimated_delivery_mins: 11,
      in_stock: 1,
      stock_count: 50,
      badge: 'High Security',
      features_json: JSON.stringify([
        'RFID tamper-evident physical locking mechanism',
        'Chain-of-custody cryptographic delivery audit log',
        'Point-to-point direct non-stop flight corridor'
      ]),
      specifications_json: JSON.stringify({ Security: 'Level 4 Vault Seal', Capacity: 'Up to 150 legal pages', Insurance: 'Included $10,000' }),
      dimensions: '35 x 26 x 3 cm',
      weight_grams: 310,
    },
    {
      id: 'prod_other_1',
      name: 'AeroShield Carbon Umbrella & Titanium EDC Multi-Tool',
      slug: 'aeroshield-carbon-umbrella-titanium-edc-multi-tool',
      brand: 'AeroShield Essentials',
      category_id: 'cat_other',
      sub_category: 'Weather & Tools',
      description: 'Wind-tunnel tested carbon fiber canopy resistant to 90 km/h gusts. Paired with a grade-5 titanium grade pocket EDC multi-tool with knife, pliers, wire cutter, and screwdriver.',
      price: 49.00,
      original_price: 65.00,
      discount_percent: 24,
      rating: 4.8,
      review_count: 112,
      image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80'
      ]),
      is_drone_eligible: 1,
      max_payload_kg: 1.5,
      estimated_delivery_mins: 15,
      in_stock: 1,
      stock_count: 40,
      badge: 'Bestseller',
      features_json: JSON.stringify([
        'Hydrophobic Teflon coated nano-fabric',
        'Grade-5 aerospace titanium construction',
        'Includes rugged ballistic carrying holster'
      ]),
      specifications_json: JSON.stringify({ WindRating: 'Category 1 gale resistant', Material: 'Toray Carbon & Titanium', Weight: '390g' }),
      dimensions: '28 x 6 x 6 cm',
      weight_grams: 390,
    }
  ];

  for (const p of products) {
    prodStmt.run(
      p.id, p.name, p.slug, p.brand, p.category_id, p.sub_category, p.description,
      p.price, p.original_price, p.discount_percent, p.rating, p.review_count,
      p.image, p.images_json, p.is_drone_eligible, p.max_payload_kg,
      p.estimated_delivery_mins, p.in_stock, p.stock_count, p.badge,
      p.features_json, p.specifications_json, p.dimensions, p.weight_grams
    );
  }

  // 6. SEED SAVED CUSTOMER ADDRESSES
  const addrStmt = db.prepare(`
    INSERT INTO addresses (id, customer_id, label, name, phone, building, street, area, city, state, postal_code, latitude, longitude, instructions, is_default, drop_zone_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  addrStmt.run(
    'addr_1',
    userId,
    'Home',
    'Alex Mercer',
    '+1 (555) 248-7790',
    'Apt 4B, Apex Heights',
    '742 Evergreen Terrace',
    'Skyline District',
    'San Francisco',
    'CA',
    '94107',
    37.7749,
    -122.4194,
    'Lower package onto the marked AstroTurf pad in backyard lawn. Call if wind is high.',
    1,
    'Lawn'
  );

  addrStmt.run(
    'addr_2',
    userId,
    'Office',
    'Alex Mercer (Work)',
    '+1 (555) 248-7790',
    'Horizon Tower 3, Floor 14',
    '500 Howard Street',
    'SoMa Tech Corridor',
    'San Francisco',
    'CA',
    '94105',
    37.7885,
    -122.3972,
    'Designated rooftop drone landing beacon #2. Reception security will notify upon ping.',
    0,
    'Rooftop Pad'
  );

  // 7. SEED INITIAL SAMPLE REVIEWS
  const revStmt = db.prepare(`
    INSERT INTO reviews (id, product_id, customer_id, author_name, author_avatar, rating, title, comment, verified_purchase, helpful_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  revStmt.run(
    'rev_1',
    'prod_food_1',
    userId,
    'Marcus Vance',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    5.0,
    'Pizza was piping hot! Unreal speed.',
    'Arrived in 13 minutes straight to my backyard lawn pad. The crust was crisp and the truffle aroma filled the room.',
    1,
    14
  );

  revStmt.run(
    'rev_2',
    'prod_med_1',
    userId,
    'Dr. Elena Rostova',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    5.0,
    'Lifesaver emergency dispatch',
    'We needed clean sterile burn dressings immediately for a kitchen accident. Drone landed smoothly in under 10 minutes.',
    1,
    28
  );

  // 8. SEED FAQS
  const faqStmt = db.prepare(`
    INSERT INTO faqs (id, question, answer, category)
    VALUES (?, ?, ?, ?)
  `);

  const faqs = [
    { id: 'faq_1', q: 'How does autonomous drone delivery work?', a: 'Once your order is confirmed, our automated fulfillment hub packs your items into an aerodynamically sealed cargo pod and assigns an electric autonomous drone. The drone navigates certified aerial corridors at 120m altitude and gently lowers the package to your selected landing zone using sonar tether precision.', cat: 'Delivery' },
    { id: 'faq_2', q: 'Where does the drone land?', a: 'You can choose between a private lawn, designated rooftop pad, driveway, or balcony landing zone. Our drones use LiDAR obstacle sensing and precision optical beacons to deliver contactless and safe drop-offs.', cat: 'Drop Zones' },
    { id: 'faq_3', q: 'What happens in rainy or windy weather?', a: 'Our aircraft operate in wind speeds up to 45 km/h and light rain. If severe weather exceeds certified FAA safety thresholds, the system will automatically notify you and either reroute to the nearest safe ground hub or delay until winds calm down.', cat: 'Safety' },
    { id: 'faq_4', q: 'What is the maximum payload weight?', a: 'SkyNav standard drones carry up to 4.5 kg (10 lbs). If your basket exceeds this weight, our system automatically schedules a tandem multi-drone flight or heavy-lift carrier.', cat: 'Orders' },
  ];

  for (const f of faqs) {
    faqStmt.run(f.id, f.q, f.a, f.cat);
  }

  // 9. SEED DEFAULT NOTIFICATIONS
  const notifStmt = db.prepare(`
    INSERT INTO notifications (id, customer_id, title, message, type, is_read, order_id, event_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  notifStmt.run(
    'notif_1',
    userId,
    'Welcome to SkyNav Aero Store',
    'Your customer account is verified and ready for instant aerial deliveries.',
    'system',
    0,
    null,
    'evt_welcome_init',
    '-2 hours'
  );

  notifStmt.run(
    'notif_2',
    userId,
    'San Francisco Sky Corridor Active',
    'Optimal flight weather detected. Average delivery time is currently 12 minutes.',
    'promo',
    0,
    null,
    'evt_corridor_active',
    '-30 minutes'
  );

  console.log('✅ Database seeded successfully with 6 categories, 9 rich products, drones, hubs, user, and drop zones!');
};

// If run directly via tsx
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase().catch((err) => {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  });
}
