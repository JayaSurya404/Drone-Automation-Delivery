import { IsIn } from "class-validator";
import { AnalyticsDateRangeQueryDto } from "./analytics-date-range-query.dto";

const TREND_METRICS = ["orders", "deliveries", "missions"] as const;

export class AnalyticsTrendsQueryDto extends AnalyticsDateRangeQueryDto {
  @IsIn(TREND_METRICS)
  metric!: (typeof TREND_METRICS)[number];
}
