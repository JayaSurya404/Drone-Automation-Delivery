import type { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";

/**
 * WebSocket connections carry no `Authorization` header the way HTTP
 * requests do — `JwtAuthGuard`'s per-request guard doesn't apply here.
 * Socket.IO's own convention is `socket.handshake.auth.token`, set by the
 * client on every (re)connect attempt (see `packages/ui`'s `useSocket`
 * hook) so a token refreshed mid-session is picked up on the next
 * reconnect; `handshake.query.token` is accepted as a fallback for any
 * client that can't set `auth` (e.g. a manual `wscat` test).
 */
export function extractSocketToken(socket: Socket): string | undefined {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.length > 0) {
    return authToken;
  }
  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === "string" && queryToken.length > 0) {
    return queryToken;
  }
  return undefined;
}

/** `AuthenticatedUser` only declares the claims the app actually reads (`sub`/`email`/`roles`/`permissions`); `exp` is the standard JWT expiry claim (seconds since epoch) that `jwtService.verifyAsync` returns on the same decoded payload regardless — declared here so `scheduleTokenExpiryDisconnect` can read it without an unsafe cast. */
export interface AuthenticatedSocketUser extends AuthenticatedUser {
  exp?: number;
}

/** Verifies the token exactly like `JwtAuthGuard` does for HTTP — same secret, same payload shape. Returns `null` on any failure (missing/invalid/expired) rather than throwing, since the caller's response to an unauthenticated socket is always "disconnect," never an HTTP-style exception. */
export async function authenticateSocket(jwtService: JwtService, socket: Socket): Promise<AuthenticatedSocketUser | null> {
  const token = extractSocketToken(socket);
  if (!token) {
    return null;
  }
  try {
    return await jwtService.verifyAsync<AuthenticatedSocketUser>(token);
  } catch {
    return null;
  }
}

/**
 * Phase 12 security fix: unlike HTTP (where `JwtAuthGuard` re-verifies the
 * token, and therefore its expiry, on every single request), a WebSocket
 * connection was previously authenticated once at `handleConnection` and
 * never re-checked for the rest of its lifetime — a socket opened just
 * before a token's `exp` would keep receiving events indefinitely past
 * expiry, unlike every REST call the same user makes. This schedules a
 * disconnect for the moment the token that authenticated the connection
 * actually expires, so a stale socket is closed at (approximately) the same
 * boundary HTTP already enforces. The client's own reconnect logic (see
 * `packages/ui`'s `useSocket` hook) re-authenticates with a fresh token on
 * the next connection attempt, the same way a 401 triggers a refresh on the
 * HTTP side.
 */
export function scheduleTokenExpiryDisconnect(socket: Socket, user: AuthenticatedSocketUser): NodeJS.Timeout | null {
  if (!user.exp) {
    return null;
  }
  const remainingMs = user.exp * 1000 - Date.now();
  if (remainingMs <= 0) {
    socket.disconnect(true);
    return null;
  }
  return setTimeout(() => socket.disconnect(true), remainingMs);
}
