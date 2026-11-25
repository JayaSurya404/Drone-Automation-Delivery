import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../../config/env.validation";
import { toMoney } from "../../common/money.util";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { DronesService } from "../drones/drones.service";
import { pathLengthMeters } from "../ai/route-geo.util";
import { estimateCostPerDelivery } from "./analytics-cost.util";
import { millisecondsToSeconds, round2, safeAverage, safeRate } from "./analytics-math.util";
import type { DateRangeQuery, ResolvedDateRange } from "./date-range.util";
import { resolveDateRange } from "./date-range.util";

export interface AnalyticsRangeView {
  from: string;
  to: string;
}

export interface OrderAnalyticsView {
  range: AnalyticsRangeView;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  cancellationRate: number | null;
  statusBreakdown: Record<string, number>;
  paymentSucceeded: number;
  paymentFailed: number;
  averageOrderValue: number | null;
  totalRevenue: number;
}

export interface DeliveryAnalyticsView {
  range: AnalyticsRangeView;
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  successRate: number | null;
  activeDeliveries: number;
  averageDeliveryTimeSeconds: number | null;
  delayedDeliveries: number;
  averageDelaySeconds: number | null;
  statusBreakdown: Record<string, number>;
  hubBreakdown: Array<{ hubId: string; hubName: string; count: number }>;
}

export interface FleetAnalyticsView {
  range: AnalyticsRangeView;
  totalMissions: number;
  completedMissions: number;
  abortedMissions: number;
  activeMissions: number;
  missionStatusBreakdown: Record<string, number>;
  averageDispatchTimeSeconds: number | null;
  averageMissionDurationSeconds: number | null;
  distanceFlownKm: number;
  averageDistancePerMissionKm: number | null;
  costPerDeliveryUsd: number | null;
  droneUtilization: { activeDroneCount: number; totalDroneCount: number; utilizationRate: number | null };
  fleetAvailability: { availableDrones: number; totalDrones: number; availabilityRate: number | null; byStatus: Record<string, number> };
  battery: { averageDropPercentPerMission: number | null; averageFleetHealthPercent: number | null; sampledMissionCount: number };
  maintenance: { inMaintenance: number; degradedBatteryHealth: number };
}

export interface SafetyAnalyticsView {
  range: AnalyticsRangeView;
  weatherRelatedEvents: number;
  geofenceBlocks: number;
  rthEvents: number;
  missionAborts: number;
  emergencyEvents: number;
  safetyStateBreakdown: Record<string, number>;
}

export interface AiAnalyticsView {
  range: AnalyticsRangeView;
  decisionsByType: Record<string, number>;
  averageRiskScore: number | null;
  riskLevelBreakdown: Record<string, number>;
  missionsRequiringApproval: number;
  missionsApproved: number;
  approvalRate: number | null;
  rerouteCount: number;
  droneRecommendationsWithEligibleDrone: number;
  droneRecommendationsWithNoEligibleDrone: number;
}

export interface DashboardSummaryView {
  range: AnalyticsRangeView;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  deliverySuccessRate: number | null;
  activeDeliveries: number;
  activeMissions: number;
  fleetAvailabilityRate: number | null;
  averageDeliveryTimeSeconds: number | null;
  safetyIncidentCount: number;
  averageRiskScore: number | null;
  lowStockItemCount: number;
  generatedAt: string;
}

export interface TrendPointView {
  date: string;
  count: number;
}

export type TrendMetric = "orders" | "deliveries" | "missions";

const DASHBOARD_CACHE_KEY_PREFIX = "analytics:dashboard:";

/**
 * Every metric is computed on demand with bounded, indexed aggregate
 * queries directly over the existing operational tables — no
 * `AnalyticsEventRaw` capture table, no background rollup jobs (see
 * `schema.prisma`'s "Analytics (Phase 10)" comment for why this phase
 * deviates from the written prompt/roadmap's event-capture design). This
 * module never mutates any table — every method here is read-only, so it
 * intentionally reads via `PrismaService` directly across every domain
 * (orders, deliveries, missions, drones, AI decisions) rather than adding a
 * bespoke aggregate method to five different owning services: those
 * services' APIs are shaped around their own business operations, not
 * cross-table reporting joins, and analytics never touches any business
 * invariant those services protect. The one exception is `DronesService`
 * (`fleetOverview()`), reused as-is rather than re-implemented, per "do not
 * duplicate operational data unnecessarily."
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly redisService: RedisService,
    private readonly dronesService: DronesService,
  ) {}

  async getDashboardSummary(query: DateRangeQuery): Promise<DashboardSummaryView> {
    const range = resolveDateRange(query);
    const cacheKey = `${DASHBOARD_CACHE_KEY_PREFIX}${query.preset ?? "custom"}:${range.from.toISOString()}:${range.to.toISOString()}`;
    const ttlSeconds = this.configService.get("ANALYTICS_DASHBOARD_CACHE_TTL_SECONDS", { infer: true });

    if (ttlSeconds > 0) {
      const cached = await this.redisService.client.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as DashboardSummaryView;
      }
    }

    const [orderCounts, deliveryCounts, activeDeliveries, activeMissions, fleetOverview, avgDeliveryTimeMs, safetyIncidentCount, avgRiskScore, lowStockItemCount] =
      await Promise.all([
        this.prisma.order.groupBy({ by: ["status"], where: this.dateWhere(range), _count: true }),
        this.prisma.delivery.groupBy({ by: ["status"], where: this.dateWhere(range), _count: true }),
        this.countActiveDeliveries(),
        this.countActiveMissions(),
        this.dronesService.fleetOverview(),
        this.averageDeliveryTimeMs(range),
        this.countSafetyIncidents(range),
        this.averageRiskAssessmentScore(range),
        this.countLowStockItems(),
      ]);

    const totalOrders = orderCounts.reduce((sum, row) => sum + row._count, 0);
    const completedOrders = orderCounts.find((row) => row.status === "CONFIRMED")?._count ?? 0;
    const cancelledOrders = orderCounts.find((row) => row.status === "CANCELLED")?._count ?? 0;
    const completedDeliveries = deliveryCounts.find((row) => row.status === "COMPLETED")?._count ?? 0;
    const cancelledDeliveries = deliveryCounts.find((row) => row.status === "CANCELLED")?._count ?? 0;
    const availableDrones = fleetOverview.byStatus["IDLE"] ?? 0;

    const summary: DashboardSummaryView = {
      range: this.toRangeView(range),
      totalOrders,
      completedOrders,
      cancelledOrders,
      deliverySuccessRate: safeRate(completedDeliveries, completedDeliveries + cancelledDeliveries),
      activeDeliveries,
      activeMissions,
      fleetAvailabilityRate: safeRate(availableDrones, fleetOverview.totalDrones),
      averageDeliveryTimeSeconds: avgDeliveryTimeMs === null ? null : millisecondsToSeconds(avgDeliveryTimeMs),
      safetyIncidentCount,
      averageRiskScore: avgRiskScore,
      lowStockItemCount,
      generatedAt: new Date().toISOString(),
    };

    if (ttlSeconds > 0) {
      await this.redisService.client.set(cacheKey, JSON.stringify(summary), "EX", ttlSeconds);
    }
    return summary;
  }

  async getOrderAnalytics(query: DateRangeQuery): Promise<OrderAnalyticsView> {
    const range = resolveDateRange(query);
    const [statusRows, paymentRows, avgOrderValue, revenueSum] = await Promise.all([
      this.prisma.order.groupBy({ by: ["status"], where: this.dateWhere(range), _count: true }),
      this.prisma.payment.groupBy({ by: ["status"], where: { createdAt: { gte: range.from, lte: range.to } }, _count: true }),
      this.prisma.order.aggregate({ where: { ...this.dateWhere(range), status: "CONFIRMED" }, _avg: { totalAmount: true } }),
      this.prisma.order.aggregate({ where: { ...this.dateWhere(range), status: "CONFIRMED" }, _sum: { totalAmount: true } }),
    ]);

    const statusBreakdown: Record<string, number> = {};
    let totalOrders = 0;
    for (const row of statusRows) {
      statusBreakdown[row.status] = row._count;
      totalOrders += row._count;
    }
    const completedOrders = statusBreakdown["CONFIRMED"] ?? 0;
    const cancelledOrders = statusBreakdown["CANCELLED"] ?? 0;
    const paymentSucceeded = paymentRows.find((row) => row.status === "SUCCEEDED")?._count ?? 0;
    const paymentFailed = paymentRows.find((row) => row.status === "FAILED")?._count ?? 0;

    return {
      range: this.toRangeView(range),
      totalOrders,
      completedOrders,
      cancelledOrders,
      cancellationRate: safeRate(cancelledOrders, totalOrders),
      statusBreakdown,
      paymentSucceeded,
      paymentFailed,
      averageOrderValue: avgOrderValue._avg.totalAmount === null ? null : toMoney(avgOrderValue._avg.totalAmount),
      totalRevenue: toMoney(revenueSum._sum.totalAmount),
    };
  }

  async getDeliveryAnalytics(query: DateRangeQuery): Promise<DeliveryAnalyticsView> {
    const range = resolveDateRange(query);
    const [statusRows, activeDeliveries, avgDeliveryTimeMs, delayStats, hubRows] = await Promise.all([
      this.prisma.delivery.groupBy({ by: ["status"], where: this.dateWhere(range), _count: true }),
      this.countActiveDeliveries(),
      this.averageDeliveryTimeMs(range),
      this.deliveryDelayStats(range),
      this.prisma.delivery.groupBy({ by: ["hubId"], where: { ...this.dateWhere(range), hubId: { not: null } }, _count: true }),
    ]);

    const statusBreakdown: Record<string, number> = {};
    let totalDeliveries = 0;
    for (const row of statusRows) {
      statusBreakdown[row.status] = row._count;
      totalDeliveries += row._count;
    }
    const completedDeliveries = statusBreakdown["COMPLETED"] ?? 0;
    const cancelledDeliveries = statusBreakdown["CANCELLED"] ?? 0;

    const hubIds = hubRows.map((row) => row.hubId).filter((id): id is string => id !== null);
    const hubs = hubIds.length > 0 ? await this.prisma.fulfillmentHub.findMany({ where: { id: { in: hubIds } }, select: { id: true, name: true } }) : [];
    const hubNameById = new Map(hubs.map((hub) => [hub.id, hub.name]));
    const hubBreakdown = hubRows
      .filter((row) => row.hubId !== null)
      .map((row) => ({ hubId: row.hubId as string, hubName: hubNameById.get(row.hubId as string) ?? "Unknown hub", count: row._count }));

    return {
      range: this.toRangeView(range),
      totalDeliveries,
      completedDeliveries,
      cancelledDeliveries,
      successRate: safeRate(completedDeliveries, completedDeliveries + cancelledDeliveries),
      activeDeliveries,
      averageDeliveryTimeSeconds: avgDeliveryTimeMs === null ? null : millisecondsToSeconds(avgDeliveryTimeMs),
      delayedDeliveries: delayStats.delayedCount,
      averageDelaySeconds: delayStats.averageDelayMs === null ? null : millisecondsToSeconds(delayStats.averageDelayMs),
      statusBreakdown,
      hubBreakdown,
    };
  }

  async getFleetAnalytics(query: DateRangeQuery): Promise<FleetAnalyticsView> {
    const range = resolveDateRange(query);
    const [
      statusRows,
      activeMissions,
      avgDispatchTimeMs,
      avgMissionDurationMs,
      distanceStats,
      batteryStats,
      fleetOverview,
      avgFleetBatteryHealth,
      activeDroneCount,
      inMaintenanceCount,
      degradedBatteryCount,
    ] = await Promise.all([
      this.prisma.mission.groupBy({ by: ["status"], where: this.dateWhere(range), _count: true }),
      this.countActiveMissions(),
      this.averageMissionTimingMs(range, "started_at", "planned_at"),
      this.averageMissionTimingMs(range, "completed_at", "started_at"),
      this.fleetDistanceStats(range),
      this.averageBatteryDropPercent(range),
      this.dronesService.fleetOverview(),
      this.prisma.drone.aggregate({ _avg: { batteryHealthPercent: true } }),
      this.countDronesWithMissionInRange(range),
      this.prisma.drone.count({ where: { isMaintenanceMode: true } }),
      this.prisma.drone.count({
        where: { batteryHealthPercent: { lt: this.configService.get("ANALYTICS_DEGRADED_BATTERY_HEALTH_THRESHOLD_PERCENT", { infer: true }) } },
      }),
    ]);

    const missionStatusBreakdown: Record<string, number> = {};
    let totalMissions = 0;
    for (const row of statusRows) {
      missionStatusBreakdown[row.status] = row._count;
      totalMissions += row._count;
    }
    const completedMissions = missionStatusBreakdown["COMPLETED"] ?? 0;
    const abortedMissions = missionStatusBreakdown["ABORTED"] ?? 0;
    const availableDrones = fleetOverview.byStatus["IDLE"] ?? 0;
    const avgDistanceKm = safeAverage(distanceStats.totalDistanceKm, distanceStats.missionCount);

    return {
      range: this.toRangeView(range),
      totalMissions,
      completedMissions,
      abortedMissions,
      activeMissions,
      missionStatusBreakdown,
      averageDispatchTimeSeconds: avgDispatchTimeMs === null ? null : millisecondsToSeconds(avgDispatchTimeMs),
      averageMissionDurationSeconds: avgMissionDurationMs === null ? null : millisecondsToSeconds(avgMissionDurationMs),
      distanceFlownKm: round2(distanceStats.totalDistanceKm),
      averageDistancePerMissionKm: avgDistanceKm,
      costPerDeliveryUsd: estimateCostPerDelivery({
        avgDistanceKm,
        costPerKmUsd: this.configService.get("ANALYTICS_COST_PER_KM_USD", { infer: true }),
        fixedCostPerMissionUsd: this.configService.get("ANALYTICS_FIXED_COST_PER_MISSION_USD", { infer: true }),
      }),
      droneUtilization: {
        activeDroneCount,
        totalDroneCount: fleetOverview.totalDrones,
        utilizationRate: safeRate(activeDroneCount, fleetOverview.totalDrones),
      },
      fleetAvailability: {
        availableDrones,
        totalDrones: fleetOverview.totalDrones,
        availabilityRate: safeRate(availableDrones, fleetOverview.totalDrones),
        byStatus: fleetOverview.byStatus,
      },
      battery: {
        averageDropPercentPerMission: batteryStats.averageDropPercent,
        averageFleetHealthPercent: avgFleetBatteryHealth._avg.batteryHealthPercent === null ? null : round2(avgFleetBatteryHealth._avg.batteryHealthPercent),
        sampledMissionCount: batteryStats.sampledMissionCount,
      },
      maintenance: {
        inMaintenance: inMaintenanceCount,
        degradedBatteryHealth: degradedBatteryCount,
      },
    };
  }

  async getSafetyAnalytics(query: DateRangeQuery): Promise<SafetyAnalyticsView> {
    const range = resolveDateRange(query);
    const [eventRows, abortedMissionCount, emergencyCount, safetyStateRows] = await Promise.all([
      this.prisma.missionEvent.groupBy({
        by: ["type"],
        where: { createdAt: { gte: range.from, lte: range.to }, type: { in: ["weather_unsafe", "weather_caution", "geofence_violation", "rth_triggered"] } },
        _count: true,
      }),
      this.prisma.mission.count({ where: { status: "ABORTED", abortedAt: { gte: range.from, lte: range.to } } }),
      this.prisma.mission.count({ where: { safetyState: "EMERGENCY", abortedAt: { gte: range.from, lte: range.to } } }),
      this.prisma.mission.groupBy({ by: ["safetyState"], where: this.dateWhere(range), _count: true }),
    ]);

    const eventCountByType = new Map(eventRows.map((row) => [row.type, row._count]));
    const safetyStateBreakdown: Record<string, number> = {};
    for (const row of safetyStateRows) {
      safetyStateBreakdown[row.safetyState] = row._count;
    }

    return {
      range: this.toRangeView(range),
      weatherRelatedEvents: (eventCountByType.get("weather_unsafe") ?? 0) + (eventCountByType.get("weather_caution") ?? 0),
      geofenceBlocks: eventCountByType.get("geofence_violation") ?? 0,
      rthEvents: eventCountByType.get("rth_triggered") ?? 0,
      missionAborts: abortedMissionCount,
      emergencyEvents: emergencyCount,
      safetyStateBreakdown,
    };
  }

  async getAiAnalytics(query: DateRangeQuery): Promise<AiAnalyticsView> {
    const range = resolveDateRange(query);
    const droneRecWhere = { createdAt: { gte: range.from, lte: range.to }, type: "DRONE_RECOMMENDATION" as const };
    const [decisionRows, riskAgg, riskLevelRows, approvalRows, approvedRows, rerouteCount, droneRecommendationsWithEligibleDrone, droneRecommendationsWithNoEligibleDrone] =
      await Promise.all([
        this.prisma.aiDecisionLog.groupBy({ by: ["type"], where: { createdAt: { gte: range.from, lte: range.to } }, _count: true }),
        this.prisma.aiDecisionLog.aggregate({ where: { createdAt: { gte: range.from, lte: range.to }, type: "RISK_ASSESSMENT" }, _avg: { score: true } }),
        this.prisma.mission.groupBy({ by: ["riskLevel"], where: { ...this.dateWhere(range), riskLevel: { not: null } }, _count: true }),
        this.prisma.mission.groupBy({ by: ["requiresApproval"], where: this.dateWhere(range), _count: true }),
        this.prisma.mission.count({ where: { ...this.dateWhere(range), requiresApproval: true, approvedAt: { not: null } } }),
        this.prisma.aiDecisionLog.count({ where: { createdAt: { gte: range.from, lte: range.to }, type: "REROUTE" } }),
        // `score` is null exactly when no eligible drone was found (see AiService.recommendDrones) — two direct counts, never a groupBy on a
        // near-continuous numeric column (which would produce one row per distinct score instead of the null/not-null split we actually want).
        this.prisma.aiDecisionLog.count({ where: { ...droneRecWhere, score: { not: null } } }),
        this.prisma.aiDecisionLog.count({ where: { ...droneRecWhere, score: null } }),
      ]);

    const decisionsByType: Record<string, number> = {};
    for (const row of decisionRows) {
      decisionsByType[row.type] = row._count;
    }
    const riskLevelBreakdown: Record<string, number> = {};
    for (const row of riskLevelRows) {
      if (row.riskLevel) {
        riskLevelBreakdown[row.riskLevel] = row._count;
      }
    }
    const missionsRequiringApproval = approvalRows.find((row) => row.requiresApproval)?._count ?? 0;

    return {
      range: this.toRangeView(range),
      decisionsByType,
      averageRiskScore: riskAgg._avg.score === null ? null : round2(riskAgg._avg.score),
      riskLevelBreakdown,
      missionsRequiringApproval,
      missionsApproved: approvedRows,
      approvalRate: safeRate(approvedRows, missionsRequiringApproval),
      rerouteCount,
      droneRecommendationsWithEligibleDrone,
      droneRecommendationsWithNoEligibleDrone,
    };
  }

  async getTrends(query: DateRangeQuery, metric: TrendMetric): Promise<TrendPointView[]> {
    const range = resolveDateRange(query);
    const table = metric === "orders" ? "orders" : metric === "deliveries" ? "deliveries" : "missions";
    const rows = await this.prisma.$queryRawUnsafe<Array<{ day: Date; count: bigint }>>(
      `SELECT date_trunc('day', created_at) as day, count(*)::bigint as count FROM ${table} WHERE created_at >= $1 AND created_at <= $2 GROUP BY day ORDER BY day ASC`,
      range.from,
      range.to,
    );
    return rows.map((row) => ({ date: row.day.toISOString().slice(0, 10), count: Number(row.count) }));
  }

  // --- shared helpers -----------------------------------------------------

  private toRangeView(range: ResolvedDateRange): AnalyticsRangeView {
    return { from: range.from.toISOString(), to: range.to.toISOString() };
  }

  private dateWhere(range: ResolvedDateRange) {
    return { createdAt: { gte: range.from, lte: range.to } };
  }

  /** Snapshot, not date-bounded — "how many deliveries are in flight right now," an operational gauge rather than a historical count. */
  private async countActiveDeliveries(): Promise<number> {
    return this.prisma.delivery.count({
      where: { status: { in: ["HUB_ASSIGNED", "MISSION_PLANNED", "DRONE_DISPATCHED", "IN_TRANSIT", "ARRIVED_AT_DESTINATION", "DELIVERED_PENDING_VERIFICATION"] } },
    });
  }

  /** Snapshot, not date-bounded — same reasoning as `countActiveDeliveries`. */
  private async countActiveMissions(): Promise<number> {
    return this.prisma.mission.count({ where: { status: { in: ["DISPATCHED", "IN_PROGRESS", "RETURNING"] } } });
  }

  private async countLowStockItems(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint as count FROM inventory_items WHERE quantity_on_hand <= low_stock_threshold
    `;
    return Number(rows[0]?.count ?? 0);
  }

  /** Distinct drones that flew at least one mission (any status) created in the window — the coarse "share of the fleet actually used" utilization signal; not a per-hour utilization figure (no shift/schedule data exists to compute one against). */
  private async countDronesWithMissionInRange(range: ResolvedDateRange): Promise<number> {
    const rows = await this.prisma.mission.findMany({
      where: { ...this.dateWhere(range), droneId: { not: null } },
      distinct: ["droneId"],
      select: { droneId: true },
    });
    return rows.length;
  }

  /** Average time from a delivery's own `created_at` to its first `COMPLETED` `DeliveryEvent`, bounded to deliveries created in the window. A raw join since the duration spans two tables. */
  private async averageDeliveryTimeMs(range: ResolvedDateRange): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<Array<{ avg_seconds: number | null; sample_count: bigint }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (de.created_at - d.created_at))) as avg_seconds, count(*)::bigint as sample_count
      FROM deliveries d
      JOIN delivery_events de ON de.delivery_id = d.id AND de.to_status = 'COMPLETED'
      WHERE d.created_at >= ${range.from} AND d.created_at <= ${range.to}
    `;
    const row = rows[0];
    if (!row || Number(row.sample_count) === 0 || row.avg_seconds === null) {
      return null;
    }
    return row.avg_seconds * 1000;
  }

  /** Deliveries whose first `COMPLETED` event landed after `estimatedDeliveryAt` (the AI-predicted ETA, Phase 9) — a delay only exists once both a prediction and a real completion time exist. */
  private async deliveryDelayStats(range: ResolvedDateRange): Promise<{ delayedCount: number; averageDelayMs: number | null }> {
    const rows = await this.prisma.$queryRaw<Array<{ delayed_count: bigint; avg_delay_seconds: number | null }>>`
      SELECT
        count(*) FILTER (WHERE de.created_at > d.estimated_delivery_at)::bigint as delayed_count,
        AVG(EXTRACT(EPOCH FROM (de.created_at - d.estimated_delivery_at))) FILTER (WHERE de.created_at > d.estimated_delivery_at) as avg_delay_seconds
      FROM deliveries d
      JOIN delivery_events de ON de.delivery_id = d.id AND de.to_status = 'COMPLETED'
      WHERE d.created_at >= ${range.from} AND d.created_at <= ${range.to} AND d.estimated_delivery_at IS NOT NULL
    `;
    const row = rows[0];
    return {
      delayedCount: Number(row?.delayed_count ?? 0),
      averageDelayMs: row?.avg_delay_seconds ? row.avg_delay_seconds * 1000 : null,
    };
  }

  /** Generic `AVG(EXTRACT(EPOCH FROM (endColumn - startColumn)))` over missions in range, both columns required non-null. Used for dispatch time (`planned_at` -> `started_at`) and mission duration (`started_at` -> `completed_at`). Column names are fixed literals from this file's own two call sites, never user input. */
  private async averageMissionTimingMs(range: ResolvedDateRange, endColumn: "started_at" | "completed_at", startColumn: "planned_at" | "started_at"): Promise<number | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ avg_seconds: number | null }>>(
      `SELECT AVG(EXTRACT(EPOCH FROM (${endColumn} - ${startColumn}))) as avg_seconds
       FROM missions
       WHERE created_at >= $1 AND created_at <= $2 AND ${endColumn} IS NOT NULL AND ${startColumn} IS NOT NULL`,
      range.from,
      range.to,
    );
    const avgSeconds = rows[0]?.avg_seconds;
    return avgSeconds === null || avgSeconds === undefined ? null : avgSeconds * 1000;
  }

  /**
   * Real flown distance (haversine over origin -> waypoints -> destination,
   * the same geometry `RouteOptimizer` scores by) for every `COMPLETED`
   * mission in range — bounded to the requested window (max 366 days, see
   * `date-range.util.ts`), not the whole table. Phase 12 fix: the date-range
   * bound alone doesn't cap row *count* for a high-volume fleet, so this
   * pages through matches in bounded `FLEET_DISTANCE_PAGE_SIZE` chunks
   * (cursor pagination) rather than loading the whole range into memory at
   * once — the total is still the mathematically complete sum for the
   * range, never a truncated sample, so the reported distance stays honest.
   */
  private async fleetDistanceStats(range: ResolvedDateRange): Promise<{ totalDistanceKm: number; missionCount: number }> {
    const PAGE_SIZE = 2000;
    let totalMeters = 0;
    let missionCount = 0;
    let cursorId: string | undefined;

    for (;;) {
      const missions = await this.prisma.mission.findMany({
        where: { ...this.dateWhere(range), status: "COMPLETED" },
        select: {
          id: true,
          originLat: true,
          originLng: true,
          destinationLat: true,
          destinationLng: true,
          waypoints: { select: { lat: true, lng: true }, orderBy: { sequence: "asc" } },
        },
        orderBy: { id: "asc" },
        take: PAGE_SIZE,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });

      for (const mission of missions) {
        const points = [{ lat: mission.originLat, lng: mission.originLng }, ...mission.waypoints, { lat: mission.destinationLat, lng: mission.destinationLng }];
        totalMeters += pathLengthMeters(points);
      }
      missionCount += missions.length;

      if (missions.length < PAGE_SIZE) {
        break;
      }
      cursorId = missions[missions.length - 1]?.id;
    }

    return { totalDistanceKm: totalMeters / 1000, missionCount };
  }

  /** Average battery-percent drop per completed mission — the first battery reading at/after `started_at` minus the last at/before `completed_at`, per mission's own drone, via a lateral join so this is one bounded query rather than N+1. */
  private async averageBatteryDropPercent(range: ResolvedDateRange): Promise<{ averageDropPercent: number | null; sampledMissionCount: number }> {
    const rows = await this.prisma.$queryRaw<Array<{ avg_drop: number | null; sample_count: bigint }>>`
      SELECT AVG(first_log.battery_percent - last_log.battery_percent) as avg_drop, count(*)::bigint as sample_count
      FROM missions m
      JOIN LATERAL (
        SELECT battery_percent FROM battery_logs bl
        WHERE bl.drone_id = m.drone_id AND bl.recorded_at >= m.started_at
        ORDER BY bl.recorded_at ASC LIMIT 1
      ) first_log ON true
      JOIN LATERAL (
        SELECT battery_percent FROM battery_logs bl
        WHERE bl.drone_id = m.drone_id AND bl.recorded_at <= m.completed_at
        ORDER BY bl.recorded_at DESC LIMIT 1
      ) last_log ON true
      WHERE m.status = 'COMPLETED' AND m.drone_id IS NOT NULL AND m.started_at IS NOT NULL AND m.completed_at IS NOT NULL
        AND m.created_at >= ${range.from} AND m.created_at <= ${range.to}
    `;
    const row = rows[0];
    return {
      averageDropPercent: row?.avg_drop === null || row?.avg_drop === undefined ? null : round2(row.avg_drop),
      sampledMissionCount: Number(row?.sample_count ?? 0),
    };
  }

  private async countSafetyIncidents(range: ResolvedDateRange): Promise<number> {
    const rows = await this.prisma.missionEvent.count({
      where: { createdAt: { gte: range.from, lte: range.to }, type: { in: ["weather_unsafe", "geofence_violation", "rth_triggered", "aborted"] } },
    });
    return rows;
  }

  private async averageRiskAssessmentScore(range: ResolvedDateRange): Promise<number | null> {
    const agg = await this.prisma.aiDecisionLog.aggregate({
      where: { createdAt: { gte: range.from, lte: range.to }, type: "RISK_ASSESSMENT" },
      _avg: { score: true },
    });
    return agg._avg.score === null ? null : round2(agg._avg.score);
  }
}
