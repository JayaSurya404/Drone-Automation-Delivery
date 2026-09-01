import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import type { Database } from "./schema.js";
import { env } from "../../config/env.js";

export interface DatabaseContext {
  db: Kysely<Database>;
  pool: pg.Pool;
  close: () => Promise<void>;
}

let activeDbContext: DatabaseContext | null = null;

/**
 * Creates a new Kysely database client backed by pg connection pool.
 */
export function createDb(
  connectionString: string = env.DATABASE_URL,
  poolConfig?: Partial<pg.PoolConfig>
): DatabaseContext {
  const pool = new pg.Pool({
    connectionString,
    max: poolConfig?.max ?? 20,
    idleTimeoutMillis: poolConfig?.idleTimeoutMillis ?? 30000,
    connectionTimeoutMillis: poolConfig?.connectionTimeoutMillis ?? 5000,
    ...poolConfig
  });

  pool.on("error", (err) => {
    console.error("[db] Unexpected idle client error on PostgreSQL pool:", err);
  });

  const dialect = new PostgresDialect({ pool });

  const db = new Kysely<Database>({
    dialect,
    log(event) {
      if (event.level === "error") {
        console.error("[db:query:error]", event.error, event.query.sql);
      }
    }
  });

  const close = async () => {
    await db.destroy();
    await pool.end();
  };

  return { db, pool, close };
}

/**
 * Returns the active default database instance, initializing it if not present.
 */
export function getDb(): Kysely<Database> {
  if (!activeDbContext) {
    activeDbContext = createDb();
  }
  return activeDbContext.db;
}

/**
 * Cleanly closes the active database connection pool.
 */
export async function closeDb(): Promise<void> {
  if (activeDbContext) {
    await activeDbContext.close();
    activeDbContext = null;
  }
}

/**
 * Performs a lightweight health check against the database.
 */
export async function checkDbHealth(db: Kysely<Database> = getDb()): Promise<boolean> {
  try {
    const result = await sql<{ ok: number }>`SELECT 1 as ok`.execute(db);
    return result.rows.length > 0 && result.rows[0]?.ok === 1;
  } catch (error) {
    console.error("[db:health:failed]", error);
    return false;
  }
}
