import argon2 from "argon2";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL || "postgresql://skynav:skynav@localhost:5432/skynav";

const SEED_DATA = {
  organizations: [
    { id: "00000000-0000-0000-0000-000000000001", name: "SkyNav Demo Fleet" },
    { id: "00000000-0000-0000-0000-000000000002", name: "AeroFlight Global" }
  ],
  users: [
    {
      id: "00000000-0000-0000-0000-000000000011",
      email: "admin@skynav.test",
      name: "SkyNav Admin",
      password: "Password123!",
      orgId: "00000000-0000-0000-0000-000000000001",
      role: "ADMIN"
    },
    {
      id: "00000000-0000-0000-0000-000000000012",
      email: "operator@skynav.test",
      name: "SkyNav Mission Operator",
      password: "Password123!",
      orgId: "00000000-0000-0000-0000-000000000001",
      role: "OPERATOR"
    },
    {
      id: "00000000-0000-0000-0000-000000000013",
      email: "customer@skynav.test",
      name: "SkyNav Customer",
      password: "Password123!",
      orgId: "00000000-0000-0000-0000-000000000001",
      role: "CUSTOMER"
    },
    {
      id: "00000000-0000-0000-0000-000000000021",
      email: "competitor_admin@aeroflight.test",
      name: "AeroFlight Admin",
      password: "Password123!",
      orgId: "00000000-0000-0000-0000-000000000002",
      role: "ADMIN"
    }
  ]
};

async function seedDatabase() {
  console.log(`[seed] Connecting to PostgreSQL at ${databaseUrl.replace(/:[^:@]+@/, ":****@")}...`);
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log("[seed] Connected to database.");
    console.log("[seed] Starting idempotent seed transaction...");

    await client.query("BEGIN;");

    // 1. Seed Organizations
    for (const org of SEED_DATA.organizations) {
      await client.query(
        `INSERT INTO organizations (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`,
        [org.id, org.name]
      );
      console.log(`[seed] Organization: ${org.name} (${org.id})`);
    }

    // 2. Seed Users & Memberships
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

      console.log(`[seed] User: ${user.email} (Role: ${user.role})`);
    }

    await client.query("COMMIT;");
    console.log("\n==================================================");
    console.log("DEVELOPMENT SEED DATA LOADED SUCCESSFULLY");
    console.log("==================================================");
    console.log("NOTE: These accounts are for local development/testing only.");
    console.log("Admin:    admin@skynav.test / Password123!");
    console.log("Operator: operator@skynav.test / Password123!");
    console.log("Customer: customer@skynav.test / Password123!");
    console.log("Org 2:    competitor_admin@aeroflight.test / Password123!");
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
