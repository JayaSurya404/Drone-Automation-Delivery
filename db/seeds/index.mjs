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

    await client.query("COMMIT;");
    console.log("\\n==================================================");
    console.log("CLEAN SEED DATA LOADED SUCCESSFULLY");
    console.log("==================================================");
    console.log("Single Administrator: " + ADMIN_EMAIL);
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
