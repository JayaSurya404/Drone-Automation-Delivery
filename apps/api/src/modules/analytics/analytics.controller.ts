import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsDateRangeQueryDto } from "./dto/analytics-date-range-query.dto";
import { AnalyticsTrendsQueryDto } from "./dto/analytics-trends-query.dto";

/** Administrative/operations reporting — every endpoint requires `analytics.read` (the `analyst`/`super_admin` roles, seeded since Phase 1). Customers have no route here at all: no controller method accepts a customer-scoped identity, and the permission simply isn't in their role's matrix. */
@Controller("analytics")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission("analytics.read")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  async dashboard(@Query() query: AnalyticsDateRangeQueryDto) {
    return this.analyticsService.getDashboardSummary(query);
  }

  @Get("orders")
  async orders(@Query() query: AnalyticsDateRangeQueryDto) {
    return this.analyticsService.getOrderAnalytics(query);
  }

  @Get("deliveries")
  async deliveries(@Query() query: AnalyticsDateRangeQueryDto) {
    return this.analyticsService.getDeliveryAnalytics(query);
  }

  @Get("fleet")
  async fleet(@Query() query: AnalyticsDateRangeQueryDto) {
    return this.analyticsService.getFleetAnalytics(query);
  }

  @Get("safety")
  async safety(@Query() query: AnalyticsDateRangeQueryDto) {
    return this.analyticsService.getSafetyAnalytics(query);
  }

  @Get("ai")
  async ai(@Query() query: AnalyticsDateRangeQueryDto) {
    return this.analyticsService.getAiAnalytics(query);
  }

  @Get("trends")
  async trends(@Query() query: AnalyticsTrendsQueryDto) {
    return this.analyticsService.getTrends(query, query.metric);
  }
}
