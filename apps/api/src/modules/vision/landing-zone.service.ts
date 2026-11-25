import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { EnvConfig } from "../../config/env.validation";
import { PrismaService } from "../../prisma/prisma.service";
import { GeofencingService } from "../geofencing/geofencing.service";
import { haversineMeters } from "../ai/route-geo.util";
import { scoreLandingZone, type LandingZoneVerdict } from "./landing-zone.util";
import { bestLandingZoneCandidate } from "./vision.util";
import { deriveNavigationHint, type VisualNavigationHint } from "./visual-navigation.util";
import { VisionService, type VisionAnalysisView } from "./vision.service";

export interface EvaluateLandingZoneInput {
  droneId?: string | null;
  missionId?: string | null;
  deliveryId?: string | null;
  lat: number;
  lng: number;
  altitudeMeters?: number;
  targetLat?: number;
  targetLng?: number;
}

export interface LandingZoneEvaluationView {
  id: string;
  missionId: string | null;
  deliveryId: string | null;
  lat: number;
  lng: number;
  radiusMeters: number;
  sizeScore: number;
  obstructionScore: number;
  safetyScore: number;
  proximityScore: number;
  suitabilityScore: number;
  verdict: LandingZoneVerdict;
  reasons: string[];
  navigationHint: VisualNavigationHint;
  visionAnalysis: VisionAnalysisView;
  createdAt: string;
}

const DEFAULT_ANALYSIS_ALTITUDE_METERS = 30;

/**
 * Part 2 — evaluates a candidate landing zone by combining a (simulated)
 * vision analysis with the *existing* `GeofencingService` safety check.
 * Never bypasses geofencing: `safetyScore` in `scoreLandingZone()` is a hard
 * gate driven directly by `GeofencingService.findPointViolations()`, the
 * same authoritative check missions already use — this service adds no
 * second, parallel notion of "safe."
 */
@Injectable()
export class LandingZoneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visionService: VisionService,
    private readonly geofencingService: GeofencingService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async evaluate(input: EvaluateLandingZoneInput): Promise<LandingZoneEvaluationView> {
    const altitudeMeters = input.altitudeMeters ?? DEFAULT_ANALYSIS_ALTITUDE_METERS;
    const analysis = await this.visionService.analyzeFrame({
      droneId: input.droneId,
      missionId: input.missionId,
      deliveryId: input.deliveryId,
      lat: input.lat,
      lng: input.lng,
      altitudeMeters,
    });

    const violations = await this.geofencingService.findPointViolations({ lat: input.lat, lng: input.lng });
    const candidate = bestLandingZoneCandidate(analysis.landingZoneCandidates);
    const distanceFromTargetMeters =
      input.targetLat !== undefined && input.targetLng !== undefined
        ? haversineMeters({ lat: input.lat, lng: input.lng }, { lat: input.targetLat, lng: input.targetLng })
        : null;

    const scored = scoreLandingZone({
      radiusMeters: candidate?.radiusMeters ?? 0,
      requiredRadiusMeters: this.configService.get("LANDING_ZONE_REQUIRED_RADIUS_METERS", { infer: true }),
      clearanceScore: candidate?.clearanceScore ?? 0,
      obstructed: analysis.obstructed,
      humanDetected: analysis.humanDetected,
      geofenceViolationCount: violations.length,
      distanceFromTargetMeters,
      suitableThreshold: this.configService.get("LANDING_ZONE_SUITABLE_THRESHOLD", { infer: true }),
      marginalThreshold: this.configService.get("LANDING_ZONE_MARGINAL_THRESHOLD", { infer: true }),
    });

    const row = await this.prisma.landingZoneEvaluation.create({
      data: {
        missionId: input.missionId ?? null,
        deliveryId: input.deliveryId ?? null,
        visionAnalysisId: analysis.id,
        lat: input.lat,
        lng: input.lng,
        radiusMeters: candidate?.radiusMeters ?? 0,
        sizeScore: scored.sizeScore,
        obstructionScore: scored.obstructionScore,
        safetyScore: scored.safetyScore,
        proximityScore: scored.proximityScore,
        suitabilityScore: scored.suitabilityScore,
        verdict: scored.verdict,
        reasons: scored.reasons as never,
      },
    });

    this.eventEmitter.emit("landing_zone.evaluated", {
      evaluationId: row.id,
      missionId: row.missionId,
      deliveryId: row.deliveryId,
      verdict: row.verdict,
      suitabilityScore: row.suitabilityScore,
    });
    if (scored.verdict === "UNSUITABLE") {
      this.eventEmitter.emit("advanced_risk.detected", {
        source: "LANDING_ZONE",
        missionId: row.missionId,
        deliveryId: row.deliveryId,
        severity: "HIGH",
        message: `Landing zone unsuitable (score ${scored.suitabilityScore}/100)`,
      });
    }

    const navigationHint = deriveNavigationHint({
      obstructed: analysis.obstructed,
      humanDetected: analysis.humanDetected,
      landingZoneVerdict: scored.verdict,
    });

    return {
      id: row.id,
      missionId: row.missionId,
      deliveryId: row.deliveryId,
      lat: row.lat,
      lng: row.lng,
      radiusMeters: row.radiusMeters,
      sizeScore: row.sizeScore,
      obstructionScore: row.obstructionScore,
      safetyScore: row.safetyScore,
      proximityScore: row.proximityScore,
      suitabilityScore: row.suitabilityScore,
      verdict: row.verdict,
      reasons: scored.reasons,
      navigationHint,
      visionAnalysis: analysis,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getById(id: string): Promise<Omit<LandingZoneEvaluationView, "navigationHint" | "visionAnalysis">> {
    const row = await this.prisma.landingZoneEvaluation.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Landing-zone evaluation ${id} not found`);
    }
    return {
      id: row.id,
      missionId: row.missionId,
      deliveryId: row.deliveryId,
      lat: row.lat,
      lng: row.lng,
      radiusMeters: row.radiusMeters,
      sizeScore: row.sizeScore,
      obstructionScore: row.obstructionScore,
      safetyScore: row.safetyScore,
      proximityScore: row.proximityScore,
      suitabilityScore: row.suitabilityScore,
      verdict: row.verdict,
      reasons: row.reasons as string[],
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listRecent(limit = 20): Promise<Array<Omit<LandingZoneEvaluationView, "navigationHint" | "visionAnalysis">>> {
    const rows = await this.prisma.landingZoneEvaluation.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map((row) => ({
      id: row.id,
      missionId: row.missionId,
      deliveryId: row.deliveryId,
      lat: row.lat,
      lng: row.lng,
      radiusMeters: row.radiusMeters,
      sizeScore: row.sizeScore,
      obstructionScore: row.obstructionScore,
      safetyScore: row.safetyScore,
      proximityScore: row.proximityScore,
      suitabilityScore: row.suitabilityScore,
      verdict: row.verdict,
      reasons: row.reasons as string[],
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
