import { createHash, randomBytes } from "node:crypto";

/** A cryptographically random, URL-safe opaque token (refresh/verification/reset tokens). */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

/** Only the hash is ever persisted — never store a raw token at rest. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
