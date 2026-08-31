import { env } from "../../config/env.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  error?: Error | unknown;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "jwt_secret",
  "authorization",
  "cookie",
  "cookies",
  "set-cookie",
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
  "credential",
  "credentials"
]);

/**
 * Deeply redacts sensitive keys from log context objects.
 */
export function redactSensitiveData<T>(obj: T, depth = 0): T {
  if (depth > 8 || obj === null || obj === undefined) return obj;

  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1)) as unknown as T;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, "");
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes("password") || lowerKey.includes("token") || lowerKey.includes("secret")) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveData(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }

  return redacted as T;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  message: string;
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  error?: {
    name?: string;
    message?: string;
    code?: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
}

export class StructuredLogger {
  private readonly service: string;
  private readonly environment: string;

  constructor(service = "api", environment = env.NODE_ENV) {
    this.service = service;
    this.environment = environment;
  }

  private log(level: LogLevel, message: string, context: LogContext = {}): void {
    const { correlationId, userId, organizationId, route, method, statusCode, durationMs, error, ...extra } = context;

    let serializedError: StructuredLogEntry["error"];
    if (error) {
      if (error instanceof Error) {
        serializedError = {
          name: error.name,
          message: error.message,
          code: (error as any).code,
          stack: this.environment !== "production" ? error.stack : undefined
        };
      } else {
        serializedError = {
          message: String(error)
        };
      }
    }

    const safeExtra = redactSensitiveData(extra);

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      environment: this.environment,
      message,
      correlationId,
      userId,
      organizationId,
      route: method && route ? `${method} ${route}` : route,
      statusCode,
      durationMs,
      error: serializedError,
      context: Object.keys(safeExtra).length > 0 ? safeExtra : undefined
    };

    const output = JSON.stringify(entry);

    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.environment !== "production") {
      this.log("debug", message, context);
    }
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }
}

export const logger = new StructuredLogger();
