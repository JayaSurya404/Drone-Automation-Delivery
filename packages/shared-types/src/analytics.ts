import { z } from "zod";

/**
 * Phase 10 — every analytics endpoint takes the same optional
 * `preset`/`from`/`to` query shape (`AnalyticsService.resolveDateRange()`
 * mirrors this — see `apps/api/src/modules/analytics/date-range.util.ts`);
 * defaults to the last 30 days when nothing is given. Response schemas
 * below mirror `AnalyticsService`'s view interfaces exactly.
 */
export const analyticsDateRangePresetSchema = z.enum(["today", "7d", "30d"]);
export type AnalyticsDateRangePreset = z.infer<typeof analyticsDateRangePresetSchema>;

export const analyticsRangeSchema = z.object({
  from: z.string(),
  to: z.string(),
});
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

export const orderAnalyticsSchema = z.object({
  range: analyticsRangeSchema,
  totalOrders: z.number(),
  completedOrders: z.number(),
  cancelledOrders: z.number(),
  cancellationRate: z.number().nullable(),
  statusBreakdown: z.record(z.string(), z.number()),
  paymentSucceeded: z.number(),
  paymentFailed: z.number(),
  averageOrderValue: z.number().nullable(),
  totalRevenue: z.number(),
});
export type OrderAnalytics = z.infer<typeof orderAnalyticsSchema>;

export const deliveryAnalyticsSchema = z.object({
  range: analyticsRangeSchema,
  totalDeliveries: z.number(),
  completedDeliveries: z.number(),
  cancelledDeliveries: z.number(),
  successRate: z.number().nullable(),
  activeDeliveries: z.number(),
  averageDeliveryTimeSeconds: z.number().nullable(),
  delayedDeliveries: z.number(),
  averageDelaySeconds: z.number().nullable(),
  statusBreakdown: z.record(z.string(), z.number()),
  hubBreakdown: z.array(z.object({ hubId: z.string(), hubName: z.string(), count: z.number() })),
});
export type DeliveryAnalytics = z.infer<typeof deliveryAnalyticsSchema>;

export const fleetAnalyticsSchema = z.object({
  range: analyticsRangeSchema,
  totalMissions: z.number(),
  completedMissions: z.number(),
  abortedMissions: z.number(),
  activeMissions: z.number(),
  missionStatusBreakdown: z.record(z.string(), z.number()),
  averageDispatchTimeSeconds: z.number().nullable(),
  averageMissionDurationSeconds: z.number().nullable(),
  distanceFlownKm: z.number(),
  averageDistancePerMissionKm: z.number().nullable(),
  costPerDeliveryUsd: z.number().nullable(),
  droneUtilization: z.object({
    activeDroneCount: z.number(),
    totalDroneCount: z.number(),
    utilizationRate: z.number().nullable(),
  }),
  fleetAvailability: z.object({
    availableDrones: z.number(),
    totalDrones: z.number(),
    availabilityRate: z.number().nullable(),
    byStatus: z.record(z.string(), z.number()),
  }),
  battery: z.object({
    averageDropPercentPerMission: z.number().nullable(),
    averageFleetHealthPercent: z.number().nullable(),
    sampledMissionCount: z.number(),
  }),
  maintenance: z.object({
    inMaintenance: z.number(),
    degradedBatteryHealth: z.number(),
  }),
});
export type FleetAnalytics = z.infer<typeof fleetAnalyticsSchema>;

export const safetyAnalyticsSchema = z.object({
  range: analyticsRangeSchema,
  weatherRelatedEvents: z.number(),
  geofenceBlocks: z.number(),
  rthEvents: z.number(),
  missionAborts: z.number(),
  emergencyEvents: z.number(),
  safetyStateBreakdown: z.record(z.string(), z.number()),
});
export type SafetyAnalytics = z.infer<typeof safetyAnalyticsSchema>;

export const aiAnalyticsSchema = z.object({
  range: analyticsRangeSchema,
  decisionsByType: z.record(z.string(), z.number()),
  averageRiskScore: z.number().nullable(),
  riskLevelBreakdown: z.record(z.string(), z.number()),
  missionsRequiringApproval: z.number(),
  missionsApproved: z.number(),
  approvalRate: z.number().nullable(),
  rerouteCount: z.number(),
  droneRecommendationsWithEligibleDrone: z.number(),
  droneRecommendationsWithNoEligibleDrone: z.number(),
});
export type AiAnalytics = z.infer<typeof aiAnalyticsSchema>;

export const dashboardSummarySchema = z.object({
  range: analyticsRangeSchema,
  totalOrders: z.number(),
  completedOrders: z.number(),
  cancelledOrders: z.number(),
  deliverySuccessRate: z.number().nullable(),
  activeDeliveries: z.number(),
  activeMissions: z.number(),
  fleetAvailabilityRate: z.number().nullable(),
  averageDeliveryTimeSeconds: z.number().nullable(),
  safetyIncidentCount: z.number(),
  averageRiskScore: z.number().nullable(),
  lowStockItemCount: z.number(),
  generatedAt: z.string(),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const analyticsTrendMetricSchema = z.enum(["orders", "deliveries", "missions"]);
export type AnalyticsTrendMetric = z.infer<typeof analyticsTrendMetricSchema>;

export const trendPointSchema = z.object({
  date: z.string(),
  count: z.number(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;

export const trendPointListSchema = z.array(trendPointSchema);

export interface AnalyticsDateRangeParams {
  preset?: AnalyticsDateRangePreset;
  from?: string;
  to?: string;
}
