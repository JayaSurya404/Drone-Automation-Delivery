import { randomInt } from "node:crypto";
import { hashToken } from "./token.util";

/** A 6-digit numeric code — short enough to type, easy to also encode into a QR image. */
export function generateVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Only the hash is ever persisted at rest — same convention as email/reset tokens. */
export function hashVerificationCode(code: string): string {
  return hashToken(code);
}
