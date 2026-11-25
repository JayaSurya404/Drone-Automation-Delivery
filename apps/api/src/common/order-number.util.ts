import { randomBytes } from "node:crypto";

/** Human-readable, sufficiently-unique order reference (DB unique constraint is the real guarantee). */
export function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = randomBytes(3).toString("hex").toUpperCase();
  return `SN-${datePart}-${randomPart}`;
}
