import argon2 from "argon2";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL || "postgresql://skynav:skynav@localhost:5432/skynav";

const ADMIN_EMAIL = (process.env.ADMIN_USERNAME || "drone@gmail.com").toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "drone@automation";

const SEED_DATA = {
  organizations: [
    { id: "00000000-0000-0000-0000-000000000001", name: "SkyNav Flight Operations" }
  ],
  users: [
    {
      id: "00000000-0000-0000-0000-000000000011",
      email: ADMIN_EMAIL,
      name: "SkyNav Administrator",
      password: ADMIN_PASSWORD,
      orgId: "00000000-0000-0000-0000-000000000001",
      role: "ADMIN"
    }
  ],
  products: [
    // 1. Groceries & Staples
    {
      id: "10000000-0000-0000-0000-000000000001",
      name: "Aashirvaad Superior MP Atta (1kg)",
      slug: "aashirvaad-superior-mp-atta-1kg",
      description: "100% pure whole wheat flour processed with traditional stone grinding for soft rotis.",
      category: "Groceries",
      price_cents: 6200,
      mrp_cents: 7500,
      image_url: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 60,
      weight_grams: 1000,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000002",
      name: "India Gate Premium Basmati Rice (1kg)",
      slug: "india-gate-premium-basmati-rice-1kg",
      description: "Aged long-grain aromatic basmati rice perfect for biryani and daily meals.",
      category: "Groceries",
      price_cents: 13500,
      mrp_cents: 16000,
      image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 50,
      weight_grams: 1000,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000003",
      name: "Tata Sampann Unpolished Toor Dal (500g)",
      slug: "tata-sampann-unpolished-toor-dal-500g",
      description: "Rich in natural protein with wholesome nutritional value, unpolished and chemical-free.",
      category: "Groceries",
      price_cents: 8800,
      mrp_cents: 10500,
      image_url: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 40,
      weight_grams: 500,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000004",
      name: "Fortune Sunlite Refined Sunflower Oil (1L)",
      slug: "fortune-sunlite-sunflower-oil-1l",
      description: "Light, healthy cooking oil enriched with Vitamins A and D for healthy digestion.",
      category: "Groceries",
      price_cents: 14200,
      mrp_cents: 16500,
      image_url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 45,
      weight_grams: 910,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000005",
      name: "Tata Salt Vacuum Evaporated Iodized Salt (1kg)",
      slug: "tata-salt-iodized-1kg",
      description: "India's most trusted vacuum-evaporated iodized cooking salt for balanced nutrition.",
      category: "Groceries",
      price_cents: 2800,
      mrp_cents: 3000,
      image_url: "https://images.unsplash.com/photo-1626197031507-c17099753214?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 100,
      weight_grams: 1000,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000006",
      name: "Madhur Pure & Hygienic Refined Sugar (1kg)",
      slug: "madhur-refined-sugar-1kg",
      description: "Sulphur-free, sparkling white refined sugar crystals prepared untouched by hand.",
      category: "Groceries",
      price_cents: 5400,
      mrp_cents: 6000,
      image_url: "https://images.unsplash.com/photo-1587734195503-904fca47e0e9?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 80,
      weight_grams: 1000,
      is_featured: false
    },

    // 2. Daily Essentials (Dairy, Bread, Eggs)
    {
      id: "10000000-0000-0000-0000-000000000007",
      name: "Amul Taaza Homogenised Toned Milk (500ml)",
      slug: "amul-taaza-toned-milk-500ml",
      description: "Fresh pasteurized toned milk with 3.0% fat, rich in calcium and natural proteins.",
      category: "Daily Essentials",
      price_cents: 3000,
      mrp_cents: 3200,
      image_url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 75,
      weight_grams: 515,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000008",
      name: "Britannia 100% Whole Wheat Bread (400g)",
      slug: "britannia-whole-wheat-bread-400g",
      description: "Healthy fiber-rich whole wheat brown bread baked fresh daily with zero maida.",
      category: "Daily Essentials",
      price_cents: 4500,
      mrp_cents: 5000,
      image_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 50,
      weight_grams: 400,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000009",
      name: "Eggoz Farm Fresh White Eggs (Pack of 6)",
      slug: "eggoz-farm-fresh-white-eggs-6pack",
      description: "UV-sanitized, antibiotic-free farm fresh eggs rich in natural Omega-3 and proteins.",
      category: "Daily Essentials",
      price_cents: 5500,
      mrp_cents: 6500,
      image_url: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 40,
      weight_grams: 350,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000010",
      name: "Amul Pasteurised Butter (100g)",
      slug: "amul-pasteurised-butter-100g",
      description: "Utterly butterly delicious creamy salted dairy butter made from fresh cow milk.",
      category: "Daily Essentials",
      price_cents: 5800,
      mrp_cents: 6000,
      image_url: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 60,
      weight_grams: 100,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000011",
      name: "Milky Mist Natural Set Curd / Dahi (400g)",
      slug: "milky-mist-natural-set-curd-400g",
      description: "Thick, creamy, traditional set curd packed with live active probiotic cultures.",
      category: "Daily Essentials",
      price_cents: 4000,
      mrp_cents: 4500,
      image_url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 35,
      weight_grams: 400,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000012",
      name: "Kinley Packaged Drinking Mineral Water (1L)",
      slug: "kinley-drinking-water-1l",
      description: "Reverse osmosis purified drinking water with added essential minerals.",
      category: "Daily Essentials",
      price_cents: 2000,
      mrp_cents: 2000,
      image_url: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 120,
      weight_grams: 1020,
      is_featured: false
    },

    // 3. Snacks & Beverages
    {
      id: "10000000-0000-0000-0000-000000000013",
      name: "Haldiram's Nagpur Aloo Bhujia (200g)",
      slug: "haldirams-nagpur-aloo-bhujia-200g",
      description: "Crispy, spicy potato sev snack prepared with pure edible oil and Indian aromatic spices.",
      category: "Snacks & Beverages",
      price_cents: 5200,
      mrp_cents: 6000,
      image_url: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 70,
      weight_grams: 200,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000014",
      name: "Maggi 2-Minute Masala Instant Noodles (Pack of 4)",
      slug: "maggi-2-minute-masala-noodles-4pack",
      description: "Classic favorite Indian masala noodles with authentic blend of roasted spices and herbs.",
      category: "Snacks & Beverages",
      price_cents: 5600,
      mrp_cents: 6000,
      image_url: "https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 90,
      weight_grams: 280,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000015",
      name: "Cadbury Dairy Milk Silk Chocolate Bar (60g)",
      slug: "cadbury-dairy-milk-silk-60g",
      description: "Smooth, velvety premium milk chocolate that melts effortlessly on your tongue.",
      category: "Snacks & Beverages",
      price_cents: 8500,
      mrp_cents: 9000,
      image_url: "https://images.unsplash.com/photo-1548907040-4baa42d10919?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 65,
      weight_grams: 60,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000016",
      name: "Tata Tea Gold Premium Black Tea (250g)",
      slug: "tata-tea-gold-premium-blend-250g",
      description: "Exquisite CTC tea leaves infused with 15% gently rolled aromatic long leaves.",
      category: "Snacks & Beverages",
      price_cents: 14000,
      mrp_cents: 16000,
      image_url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 45,
      weight_grams: 250,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000017",
      name: "Nescafe Classic 100% Pure Instant Coffee (50g Jar)",
      slug: "nescafe-classic-instant-coffee-50g",
      description: "Medium-dark roasted premium Robusta beans delivering rich aroma and refreshing taste.",
      category: "Snacks & Beverages",
      price_cents: 17500,
      mrp_cents: 19500,
      image_url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 50,
      weight_grams: 180,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000018",
      name: "Real Fruit Power 100% Mixed Fruit Juice (1L)",
      slug: "real-mixed-fruit-juice-1l",
      description: "Wholesome blend of apples, mangoes, bananas, and apricots with zero added preservatives.",
      category: "Snacks & Beverages",
      price_cents: 11500,
      mrp_cents: 13500,
      image_url: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 40,
      weight_grams: 1050,
      is_featured: false
    },

    // 4. Personal & Household Care
    {
      id: "10000000-0000-0000-0000-000000000019",
      name: "Dettol Original Liquid Handwash Refill (250ml)",
      slug: "dettol-original-handwash-refill-250ml",
      description: "Germ defense liquid formula providing 100% better protection against illness-causing germs.",
      category: "Personal Care",
      price_cents: 4900,
      mrp_cents: 5500,
      image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 60,
      weight_grams: 270,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000020",
      name: "Colgate Total Advanced Health Toothpaste (150g)",
      slug: "colgate-total-advanced-health-150g",
      description: "Antibacterial toothpaste with zinc and fluoride providing 12-hour comprehensive oral defense.",
      category: "Personal Care",
      price_cents: 11500,
      mrp_cents: 13000,
      image_url: "https://images.unsplash.com/photo-1559591937-e102202b28c3?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 55,
      weight_grams: 170,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000021",
      name: "Surf Excel Easy Wash Detergent Powder (1kg)",
      slug: "surf-excel-easy-wash-1kg",
      description: "Advanced super-clean stain removal formula engineered for quick bucket and machine washing.",
      category: "Household Essentials",
      price_cents: 13800,
      mrp_cents: 15500,
      image_url: "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 40,
      weight_grams: 1000,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000022",
      name: "Vim Dishwash Gel Lemon Power (250ml)",
      slug: "vim-dishwash-gel-lemon-250ml",
      description: "Concentrated degreasing dishwash gel formulated with real lemon power for sparkling utensils.",
      category: "Household Essentials",
      price_cents: 5500,
      mrp_cents: 6000,
      image_url: "https://images.unsplash.com/photo-1585670210693-e7fdd16b142e?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 70,
      weight_grams: 275,
      is_featured: false
    },

    // 5. Pharmacy Wellness & Small Tech
    {
      id: "10000000-0000-0000-0000-000000000023",
      name: "SkyNav Rapid First Aid & Trauma Bandage Kit",
      slug: "skynav-rapid-first-aid-trauma-kit",
      description: "Compact emergency first response kit: sterile dressings, adhesive bandages, antiseptic wipes, burn gel.",
      category: "Pharmacy & Wellness",
      price_cents: 34900,
      mrp_cents: 42000,
      image_url: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 35,
      weight_grams: 320,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000024",
      name: "Boat Rugged Type-C 3A Fast Charging Cable (1.2m)",
      slug: "boat-rugged-typec-charging-cable",
      description: "Heavy-duty braided nylon fast-charging cable with reinforced stress-relief collars.",
      category: "Small Electronics",
      price_cents: 24900,
      mrp_cents: 49900,
      image_url: "https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 50,
      weight_grams: 75,
      is_featured: true
    }
  ]
};

async function seedDatabase() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_SEED_IN_PROD !== "true") {
    console.error("[seed] CRITICAL: Refusing to seed default development accounts in production environment.");
    console.error("[seed] To override for staging/demo environments, set ALLOW_DEV_SEED_IN_PROD=true");
    process.exit(1);
  }

  console.log(`[seed] Connecting to PostgreSQL at ${databaseUrl.replace(/:[^:@]+@/, ":****@")}...`);
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log("[seed] Connected to database.");
    console.log("[seed] Cleaning old demo accounts and starting clean seed transaction...");

    await client.query("BEGIN;");

    // 1. Ensure mrp_cents column exists in products table if not created yet
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp_cents integer CHECK (mrp_cents >= 0);
    `);

    // 2. Clean order child tables
    await client.query(`
      DELETE FROM mission_waypoints
      WHERE mission_id IN (SELECT id FROM missions WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE email != $1)));
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM deliveries
      WHERE mission_id IN (SELECT id FROM missions WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE email != $1)))
         OR recipient_id IN (SELECT id FROM recipients WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE email != $1)));
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM missions
      WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE email != $1));
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM order_items
      WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE email != $1));
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM orders
      WHERE customer_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    // 3. Clean cart, wishlist, and customer addresses for non-admin accounts
    await client.query(`
      DELETE FROM cart_items
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM wishlist_items
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM customer_addresses
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    // 4. Clean user tokens, audit logs, notifications, and customer accounts
    await client.query(`
      DELETE FROM refresh_tokens
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM notifications
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM audit_logs
      WHERE actor_user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM organization_members
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM users
      WHERE email != $1;
    `, [ADMIN_EMAIL]);

    // 5. Seed Single Organization
    console.log("[seed] Seeding primary organization...");
    for (const org of SEED_DATA.organizations) {
      await client.query(
        `INSERT INTO organizations (id, name, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now();`,
        [org.id, org.name]
      );
    }

    // 6. Seed Single Configured Admin Account
    console.log("[seed] Seeding single configured administrator account...");
    const adminUser = SEED_DATA.users[0];
    const passwordHash = await argon2.hash(adminUser.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    await client.query(
      `INSERT INTO users (id, email, password_hash, name, role, organization_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         organization_id = EXCLUDED.organization_id,
         updated_at = now();`,
      [adminUser.id, adminUser.email, passwordHash, adminUser.name, adminUser.role, adminUser.orgId]
    );

    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();`,
      [
        "00000000-0000-0000-0000-000000000021",
        adminUser.orgId,
        adminUser.id,
        "OWNER"
      ]
    );

    // 7. Clear and Re-seed Indian Store Products Catalog
    console.log("[seed] Seeding Indian store products catalog...");
    await client.query("DELETE FROM products;");

    for (const p of SEED_DATA.products) {
      await client.query(
        `INSERT INTO products (
          id, name, slug, description, category, price_cents, mrp_cents, currency, image_url,
          stock_quantity, weight_grams, is_drone_eligible, is_featured, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now());`,
        [
          p.id,
          p.name,
          p.slug,
          p.description,
          p.category,
          p.price_cents,
          p.mrp_cents,
          "INR",
          p.image_url,
          p.stock_quantity,
          p.weight_grams,
          true,
          p.is_featured,
          true
        ]
      );
    }
    console.log(`[seed] Seeded ${SEED_DATA.products.length} Indian store catalog products.`);

    await client.query("COMMIT;");
    console.log("\n==================================================");
    console.log("INDIAN ECOMMERCE SEED DATA LOADED SUCCESSFULLY");
    console.log("==================================================");
    console.log("Single Administrator: " + ADMIN_EMAIL);
    console.log("Products in Catalog:  " + SEED_DATA.products.length);
    console.log("Currency:             INR (₹)");
    console.log("Customer accounts:    0 (Fresh registration ready)");
    console.log("==================================================\n");
  } catch (error) {
    await client.query("ROLLBACK;").catch(() => {});
    console.error("[seed] Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

seedDatabase();
