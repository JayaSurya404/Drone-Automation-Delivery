import { IsIn, IsISO8601, IsOptional } from "class-validator";

const DATE_RANGE_PRESETS = ["today", "7d", "30d"] as const;

/** Shared by every `/analytics/*` endpoint — a preset, or an explicit custom `from`/`to` pair (validated and bounded by `resolveDateRange()`). */
export class AnalyticsDateRangeQueryDto {
  @IsOptional()
  @IsIn(DATE_RANGE_PRESETS)
  preset?: (typeof DATE_RANGE_PRESETS)[number];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
