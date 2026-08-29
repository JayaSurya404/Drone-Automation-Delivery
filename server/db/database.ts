import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'skylink.db');
export const db = new Database(dbPath);

// Enable WAL mode and foreign key constraints
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
export const initDb = () => {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
};

// Database helper functions
export const queryOne = <T = any>(sql: string, params: any[] = []): T | undefined => {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as T | undefined;
};

export const queryAll = <T = any>(sql: string, params: any[] = []): T[] => {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
};

export const runCommand = (sql: string, params: any[] = []): Database.RunResult => {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
};

export const executeTransaction = <T>(fn: () => T): T => {
  const transaction = db.transaction(fn);
  return transaction();
};

export default db;
