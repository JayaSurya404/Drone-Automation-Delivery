import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from workspace root first, then backend-local directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const FORBIDDEN_DEFAULTS = new Set([
  'skynav_admin_jwt_secret_2026',
  'skynav_super_secure_jwt_secret_2026_aerodelivery',
  'skynav_secure_internal_service_key_2026',
  'your_secure_jwt_secret_key_here',
  'your_hmac_shared_secret_here',
  'skynav@123',
  'admin123',
  'changeme',
]);

function requireStrongEnv(name: string, minLength = 16): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[Startup Error] Required environment variable ${name} is not set.`);
  }
  if (FORBIDDEN_DEFAULTS.has(value) || value.length < minLength) {
    throw new Error(
      `[Startup Error] Environment variable ${name} must be at least ${minLength} characters and not use an insecure default.`
    );
  }
  return value;
}

export interface CustomerEnv {
  PORT: number;
  NODE_ENV: string;
  JWT_SECRET: string;
  SKYNAV_INTERNAL_SERVICE_KEY: string;
  CORS_ORIGINS: string[];
}

let cachedEnv: CustomerEnv | null = null;

export function getCustomerEnv(): CustomerEnv {
  if (cachedEnv) return cachedEnv;

  const nodeEnv = (process.env.NODE_ENV || 'development').trim();
  const rawOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
  const corsOrigins = rawOrigins
    ? rawOrigins
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s !== '*')
    : nodeEnv === 'production'
      ? []
      : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  if (nodeEnv === 'production' && corsOrigins.length === 0) {
    throw new Error('[Startup Error] CORS_ORIGINS must be explicitly configured in production.');
  }

  cachedEnv = {
    PORT: Number(process.env.PORT || 5000),
    NODE_ENV: nodeEnv,
    JWT_SECRET: requireStrongEnv('JWT_SECRET'),
    SKYNAV_INTERNAL_SERVICE_KEY: requireStrongEnv('SKYNAV_INTERNAL_SERVICE_KEY'),
    CORS_ORIGINS: corsOrigins,
  };

  return cachedEnv;
}

// Validate immediately on module load so startup fails fast before serving requests.
getCustomerEnv();
