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
    // Groceries
    {
      id: "10000000-0000-0000-0000-000000000001",
      name: "Organic Honeycrisp Apples (1kg)",
      slug: "organic-honeycrisp-apples-1kg",
      description: "Crisp, sweet, and locally harvested organic apples. Shipped in protective shock-absorbing packaging.",
      category: "Groceries",
      price_cents: 699,
      image_url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 50,
      weight_grams: 1050,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000002",
      name: "Organic Haas Avocados (Pack of 4)",
      slug: "organic-haas-avocados-pack-4",
      description: "Ripe, creamy, pesticide-free Haas avocados ready for instant healthy meals.",
      category: "Groceries",
      price_cents: 849,
      image_url: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 40,
      weight_grams: 800,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000003",
      name: "Artisan Sourdough Boule (500g)",
      slug: "artisan-sourdough-boule-500g",
      description: "Naturally fermented sourdough with a crispy crust and soft crumb, baked fresh daily.",
      category: "Groceries",
      price_cents: 599,
      image_url: "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 30,
      weight_grams: 520,
      is_featured: false
    },
    // Pharmacy
    {
      id: "10000000-0000-0000-0000-000000000004",
      name: "Emergency First Aid Trauma Pack",
      slug: "emergency-first-aid-trauma-pack",
      description: "Hospital-grade sterile gauze, SWAT-T tourniquet, antiseptic wipes, and burn gel.",
      category: "Pharmacy",
      price_cents: 3499,
      image_url: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 25,
      weight_grams: 450,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000005",
      name: "Non-Drowsy Allergy Relief (30 Tablets)",
      slug: "non-drowsy-allergy-relief-30-tablets",
      description: "Fast-acting 24-hour symptom relief for seasonal and airborne allergens.",
      category: "Pharmacy",
      price_cents: 1499,
      image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 60,
      weight_grams: 80,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000006",
      name: "Sterile Electrolyte Saline Solution (500ml)",
      slug: "sterile-electrolyte-saline-solution-500ml",
      description: "Purified sterile rehydration solution for clinical and emergency support.",
      category: "Pharmacy",
      price_cents: 999,
      image_url: "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 35,
      weight_grams: 550,
      is_featured: false
    },
    // Food & Beverages
    {
      id: "10000000-0000-0000-0000-000000000007",
      name: "Single-Origin Nitro Cold Brew (4 x 250ml)",
      slug: "single-origin-nitro-cold-brew-4pack",
      description: "Micro-filtered Ethiopian single-origin beans infused with nitrogen for a velvety smooth pour.",
      category: "Food & Beverages",
      price_cents: 1699,
      image_url: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 30,
      weight_grams: 1100,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000008",
      name: "Organic Ceremonial Grade Matcha (30g)",
      slug: "organic-ceremonial-grade-matcha-30g",
      description: "First-harvest Uji matcha with rich umami flavor and vibrant emerald color.",
      category: "Food & Beverages",
      price_cents: 2899,
      image_url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 45,
      weight_grams: 95,
      is_featured: false
    },
    // Electronics
    {
      id: "10000000-0000-0000-0000-000000000009",
      name: "Thunderbolt 4 Braided USB-C Cable (2m)",
      slug: "thunderbolt-4-braided-usbc-cable-2m",
      description: "40Gbps high-speed data transfer and 100W Power Delivery with kevlar-reinforced exterior.",
      category: "Electronics",
      price_cents: 2999,
      image_url: "https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 50,
      weight_grams: 110,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000010",
      name: "Ultra-Compact 65W GaN Fast Charger",
      slug: "ultra-compact-65w-gan-fast-charger",
      description: "Dual USB-C ports with intelligent power distribution. Charges laptops, tablets, and phones simultaneously.",
      category: "Electronics",
      price_cents: 3999,
      image_url: "https://images.unsplash.com/photo-1622445262464-84b1456045b6?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 35,
      weight_grams: 140,
      is_featured: false
    },
    // Essentials
    {
      id: "10000000-0000-0000-0000-000000000011",
      name: "100% Pure Organic Coconut Water (6 x 330ml)",
      slug: "pure-organic-coconut-water-6pack",
      description: "Naturally isotonic, potassium-rich fresh coconut water with zero added sugars.",
      category: "Essentials",
      price_cents: 1299,
      image_url: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 40,
      weight_grams: 2100,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000012",
      name: "Plant-Based Surface Sanitizing Wipes (80 Wipes)",
      slug: "plant-based-surface-sanitizing-wipes-80",
      description: "Biodegradable disinfectant wipes formulated with botanical active ingredients.",
      category: "Essentials",
      price_cents: 749,
      image_url: "https://images.unsplash.com/photo-1584744982491-665216d95f8b?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 55,
      weight_grams: 480,
      is_featured: false
    },
    // Emergency Supplies
    {
      id: "10000000-0000-0000-0000-000000000013",
      name: "Solar & Hand-Crank Emergency Weather Radio",
      slug: "solar-hand-crank-emergency-weather-radio",
      description: "AM/FM/NOAA broadcast receiver with 4000mAh power bank and ultra-bright LED emergency beacon.",
      category: "Emergency Supplies",
      price_cents: 4299,
      image_url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 20,
      weight_grams: 390,
      is_featured: true
    },
    {
      id: "10000000-0000-0000-0000-000000000014",
      name: "Compact Membrane Microfilter Water Straw",
      slug: "compact-membrane-microfilter-water-straw",
      description: "Filters 99.9999% of waterborne bacteria, parasites, and microplastics without chemicals.",
      category: "Emergency Supplies",
      price_cents: 2499,
      image_url: "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 30,
      weight_grams: 65,
      is_featured: false
    },
    // Documents
    {
      id: "10000000-0000-0000-0000-000000000015",
      name: "Tamper-Evident Secure Legal Document Sleeve",
      slug: "tamper-evident-secure-legal-document-sleeve",
      description: "Weather-sealed, tear-proof RFID-shielded courier sleeve for rapid notarized document transport.",
      category: "Documents",
      price_cents: 1899,
      image_url: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 100,
      weight_grams: 120,
      is_featured: false
    },
    {
      id: "10000000-0000-0000-0000-000000000016",
      name: "Confidential Bio-Sample Thermal Transport Container",
      slug: "confidential-bio-sample-thermal-transport-container",
      description: "Certified UN3373 diagnostic specimen shipper with integrated temperature data logger.",
      category: "Documents",
      price_cents: 4999,
      image_url: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=600&q=80",
      stock_quantity: 25,
      weight_grams: 480,
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

    // 1. Clean order child tables
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
      DELETE FROM packages
      WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE email != $1));
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM recipients
      WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE email != $1));
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM order_items
      WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM users WHERE email != $1));
    `, [ADMIN_EMAIL]);

    // 2. Clean orders and user-referenced tables
    await client.query(`
      DELETE FROM orders
      WHERE customer_id IN (SELECT id FROM users WHERE email != $1)
         OR cancelled_by_user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM outbox_events
      WHERE actor_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM audit_logs
      WHERE actor_user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM notifications
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM refresh_tokens
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM customer_addresses
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM cart_items
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM wishlist_items
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    await client.query(`
      DELETE FROM organization_members
      WHERE user_id IN (SELECT id FROM users WHERE email != $1);
    `, [ADMIN_EMAIL]);

    // 3. Delete non-admin users
    await client.query(`
      DELETE FROM users
      WHERE email != $1;
    `, [ADMIN_EMAIL]);

    // 4. Clean empty organizations created for test customers
    await client.query(`
      DELETE FROM organizations
      WHERE id != '00000000-0000-0000-0000-000000000001'
        AND id NOT IN (SELECT organization_id FROM organization_members);
    `);

    // 5. Seed Main Operations Organization
    for (const org of SEED_DATA.organizations) {
      await client.query(
        `INSERT INTO organizations (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`,
        [org.id, org.name]
      );
      console.log(`[seed] Organization: ${org.name} (${org.id})`);
    }

    // 6. Seed Single Administrator Account
    for (const user of SEED_DATA.users) {
      const passwordHash = await argon2.hash(user.password, { type: argon2.argon2id });

      await client.query(
        `INSERT INTO users (id, email, name, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
           SET email = EXCLUDED.email,
               name = EXCLUDED.name,
               password_hash = EXCLUDED.password_hash;`,
        [user.id, user.email, user.name, passwordHash]
      );

      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;`,
        [user.orgId, user.id, user.role]
      );

      console.log(`[seed] Admin User: ${user.email} (Role: ${user.role})`);
    }

    // 7. Seed Real Ecommerce Products
    console.log("[seed] Seeding store products catalog...");
    for (const p of SEED_DATA.products) {
      await client.query(
        `INSERT INTO products (
          id, name, slug, description, category, price_cents, currency, image_url,
          stock_quantity, weight_grams, is_drone_eligible, is_featured, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          price_cents = EXCLUDED.price_cents,
          image_url = EXCLUDED.image_url,
          stock_quantity = EXCLUDED.stock_quantity,
          weight_grams = EXCLUDED.weight_grams,
          is_drone_eligible = EXCLUDED.is_drone_eligible,
          is_featured = EXCLUDED.is_featured,
          is_active = EXCLUDED.is_active,
          updated_at = now();`,
        [
          p.id,
          p.name,
          p.slug,
          p.description,
          p.category,
          p.price_cents,
          "USD",
          p.image_url,
          p.stock_quantity,
          p.weight_grams,
          true,
          p.is_featured,
          true
        ]
      );
    }
    console.log(`[seed] Seeded ${SEED_DATA.products.length} store catalog products.`);

    await client.query("COMMIT;");
    console.log("\\n==================================================");
    console.log("CLEAN SEED DATA LOADED SUCCESSFULLY");
    console.log("==================================================");
    console.log("Single Administrator: " + ADMIN_EMAIL);
    console.log("Products in Catalog:  " + SEED_DATA.products.length);
    console.log("Customer accounts:    0 (Fresh registration ready)");
    console.log("==================================================\\n");
  } catch (error) {
    await client.query("ROLLBACK;").catch(() => {});
    console.error("[seed] Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

seedDatabase();
