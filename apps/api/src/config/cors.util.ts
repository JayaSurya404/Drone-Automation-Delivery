/** The same safe default `env.validation.ts`'s `CORS_ORIGINS` schema documents — duplicated here (not imported) because this must be readable before Nest's DI container (and therefore `ConfigService`) exists. */
const DEFAULT_CORS_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];

/**
 * Resolves the CORS allow-list directly from `process.env.CORS_ORIGINS`.
 * Used both by `bootstrap.ts` (where `ConfigService` is available but this
 * keeps every caller consistent) and by `@WebSocketGateway({ cors: ... })`
 * decorator options (evaluated at class-definition time, before Nest's DI
 * container exists, so `ConfigService` genuinely cannot be injected there) —
 * see `tracking.gateway.ts`/`ops.gateway.ts`.
 *
 * Phase 12 security fix: the three previous call sites each independently
 * wrote `process.env.CORS_ORIGINS?.split(",")... ?? true`, which — because
 * `true` tells Express/Socket.IO's CORS middleware to reflect *any* request
 * origin back as allowed — silently opened the HTTP API and both WebSocket
 * namespaces to every origin (with `credentials: true`) if the env var was
 * ever unset, rather than falling back to the documented safe default. This
 * function never returns `true`; an unset/empty env var always resolves to
 * the same localhost allow-list `env.validation.ts` defaults to.
 */
export function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_CORS_ORIGINS;
  }
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
