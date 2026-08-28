import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");

const databaseUrl = process.env.DATABASE_URL || "postgresql://skynav:skynav@localhost:5432/skynav";

async function runMigrations() {
  console.log(`[migrate] Connecting to PostgreSQL at ${databaseUrl.replace(/:[^:@]+@/, ":****@")}...`);
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log("[migrate] Connected to database.");

    // Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Fetch applied migrations
    const { rows } = await client.query("SELECT name FROM _schema_migrations ORDER BY name ASC;");
    const appliedSet = new Set(rows.map((r) => r.name));

    // Read and sort all migration files
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`[migrate] Applying migration: ${file}...`);
      await client.query("BEGIN;");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _schema_migrations (name) VALUES ($1);", [file]);
        await client.query("COMMIT;");
        console.log(`[migrate] Successfully applied: ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query("ROLLBACK;");
        console.error(`[migrate] FAILED applying ${file}:`, err);
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log("[migrate] Database is already up to date. No pending migrations.");
    } else {
      console.log(`[migrate] Successfully applied ${appliedCount} migration(s).`);
    }
  } catch (error) {
    console.error("[migrate] Fatal migration error:", error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

runMigrations();
