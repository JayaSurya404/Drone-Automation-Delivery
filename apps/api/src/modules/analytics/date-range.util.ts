import { BadRequestException } from "@nestjs/common";

export type DateRangePreset = "today" | "7d" | "30d";

export interface DateRangeQuery {
  preset?: DateRangePreset;
  from?: string;
  to?: string;
}

export interface ResolvedDateRange {
  from: Date;
  to: Date;
}

/** Hard ceiling on a custom range — prevents an unbounded/accidental multi-year aggregate scan (the phase-10 "query bounds" requirement). Presets are always well within this on their own. */
export const MAX_CUSTOM_RANGE_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolves a query's date range deterministically — a preset (`today`/`7d`/
 * `30d`), an explicit `from`/`to` custom range (validated and bounded), or
 * (nothing given) a default of the last 30 days. `now` is injectable for
 * deterministic testing; every real caller lets it default. All preset
 * boundaries are computed in UTC (`today` = the current UTC calendar day),
 * documented explicitly since "today" is otherwise timezone-ambiguous.
 */
export function resolveDateRange(query: DateRangeQuery, now: Date = new Date()): ResolvedDateRange {
  if (query.from || query.to) {
    if (!query.from || !query.to) {
      throw new BadRequestException("Both 'from' and 'to' must be provided together for a custom date range");
    }
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException("'from' and 'to' must be valid ISO 8601 dates");
    }
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException("'from' must not be after 'to'");
    }
    const rangeDays = (to.getTime() - from.getTime()) / MS_PER_DAY;
    if (rangeDays > MAX_CUSTOM_RANGE_DAYS) {
      throw new BadRequestException(`Custom date range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`);
    }
    return { from, to };
  }

  const to = now;
  switch (query.preset) {
    case "today": {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      return { from, to };
    }
    case "7d":
      return { from: new Date(to.getTime() - 7 * MS_PER_DAY), to };
    case "30d":
    default:
      return { from: new Date(to.getTime() - 30 * MS_PER_DAY), to };
  }
}
