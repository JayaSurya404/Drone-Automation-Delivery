/** Rounds to 2 decimal places — the same integer-based approach `roundMoney()` uses, applied to any metric (percentages, durations, distances), not just money. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A rate as a 0-100 percentage — `null`, never a misleading `0`, when the
 * denominator is zero (phase-10 "do not expose metrics that cannot be
 * computed reliably" requirement). Every rate-shaped analytics field in
 * this module goes through this function so "no data" and "genuinely 0%"
 * are never confused.
 */
export function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }
  return round2((numerator / denominator) * 100);
}

/** Same null-vs-zero distinction as `safeRate`, for a plain average (durations, distances, scores). */
export function safeAverage(sum: number, count: number): number | null {
  if (count <= 0) {
    return null;
  }
  return round2(sum / count);
}

/** Converts a duration in milliseconds to whole seconds — every duration-shaped analytics field (dispatch time, mission duration, delivery time) is expressed in seconds for a consistent, documented unit. */
export function millisecondsToSeconds(ms: number): number {
  return Math.round(ms / 1000);
}
