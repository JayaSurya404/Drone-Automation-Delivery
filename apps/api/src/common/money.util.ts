import type { Prisma } from "@prisma/client";

/**
 * Prisma serializes `Decimal` columns to `Decimal.js` instances (or, over
 * the wire in a raw query, strings) — never a plain JS number. This is the
 * one place that conversion happens so a raw Decimal object never leaks
 * through the API by accident.
 */
export function toMoney(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

/** Rounds to 2 decimal places using integer cents to avoid float drift (e.g. 0.1 + 0.2). */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
