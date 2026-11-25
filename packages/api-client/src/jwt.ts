/**
 * Decodes a JWT payload client-side WITHOUT verifying its signature — only
 * ever use this for UI hints (e.g. which nav links to show). Real
 * authorization is always enforced server-side by `PermissionsGuard`.
 */
export function decodeJwtPayload<T>(token: string): T | null {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as T;
  } catch {
    return null;
  }
}
