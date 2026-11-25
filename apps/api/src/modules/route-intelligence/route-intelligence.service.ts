import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type { EnvConfig } from "../../config/env.validation";
import { PrismaService } from "../../prisma/prisma.service";
import { round2, safeRate } from "../analytics/analytics-math.util";
import { haversineMeters } from "../ai/route-geo.util";
import type { LatLng } from "../geofencing/geometry.util";

export interface RouteIntelligenceObservation {
  sampleSize: number;
  averageDistanceMeters: number | null;
  averageDurationSeconds: number | null;
  averageBatteryDropPercent: number | null;
  abortCount: number;
  abortRate: number | null;
  hazardBreakdown: Record<string, number>;
  lookbackDays: number;
  matchRadiusMeters: number;
}

const METERS_PER_DEGREE_LATITUDE = 111_000;

/**
 * Part 8 — shared route intelligence. Deliberately introduces NO new table
 * (the same "prefer live aggregation over premature warehousing" principle
 * Phase 10 established): every observation is derived live from existing
 * `Mission`/`MissionEvent`/`BatteryLog` rows, bounded by a lookback window
 * and a sample cap so this can never scan the full mission history
 * unbounded (Part 13's performance requirement). A bounding-box pre-filter
 * (indexed columns) narrows candidates before a precise haversine distance
 * check, the same "bounded query, then precise in-memory refinement"
 * pattern `AnalyticsService` already uses for its own aggregates.
 *
 * This is intentionally a plain statistical aggregate, not a learned model
 * — Part 8's explicit "do not blindly create a machine-learning knowledge
 * base." A future learned implementation could replace the query below
 * behind the same `getObservations()` signature without any caller
 * changing, the same adapter-swap precedent `RouteOptimizer`/`ETAPredictor`
 * already establish.
 */
@Injectable()
export class RouteIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async getObservations(origin: LatLng, destination: LatLng): Promise<RouteIntelligenceObservation> {
    const lookbackDays = this.configService.get("ROUTE_INTEL_LOOKBACK_DAYS", { infer: true });
    const maxSamples = this.configService.get("ROUTE_INTEL_MAX_SAMPLES", { infer: true });
    const matchRadiusMeters = this.configService.get("ROUTE_INTEL_MATCH_RADIUS_METERS", { infer: true });
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const latDelta = matchRadiusMeters / METERS_PER_DEGREE_LATITUDE;
    const cosLat = Math.cos((origin.lat * Math.PI) / 180) || 0.0001;
    const lngDelta = matchRadiusMeters / (METERS_PER_DEGREE_LATITUDE * cosLat);

    const candidates = await this.prisma.mission.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: ["COMPLETED", "ABORTED"] },
        originLat: { gte: origin.lat - latDelta, lte: origin.lat + latDelta },
        originLng: { gte: origin.lng - lngDelta, lte: origin.lng + lngDelta },
        destinationLat: { gte: destination.lat - latDelta, lte: destination.lat + latDelta },
        destinationLng: { gte: destination.lng - lngDelta, lte: destination.lng + lngDelta },
      },
      orderBy: { createdAt: "desc" },
      take: maxSamples,
      select: { id: true, status: true, originLat: true, originLng: true, destinationLat: true, destinationLng: true, startedAt: true, completedAt: true },
    });

    const matched = candidates.filter(
      (m) =>
        haversineMeters({ lat: m.originLat, lng: m.originLng }, origin) <= matchRadiusMeters &&
        haversineMeters({ lat: m.destinationLat, lng: m.destinationLng }, destination) <= matchRadiusMeters,
    );

    if (matched.length === 0) {
      return { sampleSize: 0, averageDistanceMeters: null, averageDurationSeconds: null, averageBatteryDropPercent: null, abortCount: 0, abortRate: null, hazardBreakdown: {}, lookbackDays, matchRadiusMeters };
    }

    const completed = matched.filter((m) => m.status === "COMPLETED");
    const abortCount = matched.length - completed.length;

    const durationsSeconds = completed.filter((m) => m.startedAt && m.completedAt).map((m) => (m.completedAt!.getTime() - m.startedAt!.getTime()) / 1000);
    const averageDurationSeconds = durationsSeconds.length > 0 ? round2(durationsSeconds.reduce((sum, d) => sum + d, 0) / durationsSeconds.length) : null;

    const averageDistanceMeters = round2(
      matched.reduce((sum, m) => sum + haversineMeters({ lat: m.originLat, lng: m.originLng }, { lat: m.destinationLat, lng: m.destinationLng }), 0) / matched.length,
    );

    const missionIds = matched.map((m) => m.id);
    const averageBatteryDropPercent = await this.averageBatteryDrop(missionIds);

    const events = await this.prisma.missionEvent.groupBy({ by: ["type"], where: { missionId: { in: missionIds } }, _count: true });
    const hazardBreakdown: Record<string, number> = {};
    for (const e of events) {
      hazardBreakdown[e.type] = e._count;
    }

    return {
      sampleSize: matched.length,
      averageDistanceMeters,
      averageDurationSeconds,
      averageBatteryDropPercent,
      abortCount,
      abortRate: safeRate(abortCount, matched.length),
      hazardBreakdown,
      lookbackDays,
      matchRadiusMeters,
    };
  }

  /** Same `LATERAL JOIN` first/last battery-reading-around-flight-window technique `AnalyticsService.averageBatteryDropPercent()` uses, scoped to this corridor's matched mission ids via `Prisma.join` (never string-interpolated). */
  private async averageBatteryDrop(missionIds: string[]): Promise<number | null> {
    if (missionIds.length === 0) {
      return null;
    }
    const rows = await this.prisma.$queryRaw<Array<{ avg_drop: number | null; sample_count: bigint }>>(Prisma.sql`
      SELECT AVG(first_log.battery_percent - last_log.battery_percent) as avg_drop, count(*)::bigint as sample_count
      FROM missions m
      JOIN LATERAL (
        SELECT battery_percent FROM battery_logs bl WHERE bl.drone_id = m.drone_id AND bl.recorded_at >= m.started_at ORDER BY bl.recorded_at ASC LIMIT 1
      ) first_log ON true
      JOIN LATERAL (
        SELECT battery_percent FROM battery_logs bl WHERE bl.drone_id = m.drone_id AND bl.recorded_at <= m.completed_at ORDER BY bl.recorded_at DESC LIMIT 1
      ) last_log ON true
      WHERE m.id IN (${Prisma.join(missionIds)}) AND m.drone_id IS NOT NULL AND m.started_at IS NOT NULL AND m.completed_at IS NOT NULL
    `);
    const row = rows[0];
    if (!row || row.avg_drop === null || Number(row.sample_count) === 0) {
      return null;
    }
    return round2(Number(row.avg_drop));
  }
}
