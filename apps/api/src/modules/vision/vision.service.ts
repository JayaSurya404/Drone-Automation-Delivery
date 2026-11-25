import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import {
  COMPUTER_VISION_ADAPTER,
  type ComputerVisionAdapter,
  type DetectedObject,
  type LandingZoneCandidate,
} from "./interfaces/computer-vision-adapter.interface";

export interface VisionAnalysisView {
  id: string;
  droneId: string | null;
  missionId: string | null;
  deliveryId: string | null;
  lat: number;
  lng: number;
  altitudeMeters: number;
  objects: DetectedObject[];
  landingZoneCandidates: LandingZoneCandidate[];
  landingZoneCandidateCount: number;
  obstructed: boolean;
  humanDetected: boolean;
  modelProvider: string;
  summary: string;
  createdAt: string;
}

export interface AnalyzeFrameInput {
  droneId?: string | null;
  missionId?: string | null;
  deliveryId?: string | null;
  lat: number;
  lng: number;
  altitudeMeters: number;
}

interface VisionAnalysisRow {
  id: string;
  droneId: string | null;
  missionId: string | null;
  deliveryId: string | null;
  lat: number;
  lng: number;
  altitudeMeters: number;
  objects: unknown;
  landingZoneCandidateCount: number;
  obstructed: boolean;
  humanDetected: boolean;
  modelProvider: string;
  summary: string;
  createdAt: Date;
}

/**
 * Orchestrates `ComputerVisionAdapter.analyzeFrame()` and persists exactly
 * one bounded, structured summary per call (`VisionAnalysis`) — never a raw
 * frame/image (Part 1's "do not expose sensitive raw camera data
 * unnecessarily"; there is no raw frame to begin with, since V1 is
 * simulation-only). `LandingZoneService` is the other consumer of this
 * service — it never calls the adapter directly, so every analysis (whether
 * standalone or landing-zone-driven) goes through the same persistence and
 * `vision.detected` event path.
 */
@Injectable()
export class VisionService {
  constructor(
    @Inject(COMPUTER_VISION_ADAPTER) private readonly adapter: ComputerVisionAdapter,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async analyzeFrame(input: AnalyzeFrameInput): Promise<VisionAnalysisView> {
    const result = await this.adapter.analyzeFrame({
      droneId: input.droneId ?? "unassigned",
      lat: input.lat,
      lng: input.lng,
      altitudeMeters: input.altitudeMeters,
    });

    const summary = this.buildSummary(result.objects, result.landingZoneCandidates, result.obstructed, result.humanDetected);

    const row = await this.prisma.visionAnalysis.create({
      data: {
        droneId: input.droneId ?? null,
        missionId: input.missionId ?? null,
        deliveryId: input.deliveryId ?? null,
        lat: input.lat,
        lng: input.lng,
        altitudeMeters: input.altitudeMeters,
        objects: result.objects as never,
        landingZoneCandidateCount: result.landingZoneCandidates.length,
        obstructed: result.obstructed,
        humanDetected: result.humanDetected,
        modelProvider: result.modelProvider,
        summary,
      },
    });

    this.eventEmitter.emit("vision.detected", {
      analysisId: row.id,
      droneId: row.droneId,
      missionId: row.missionId,
      objectCount: result.objects.length,
      obstructed: row.obstructed,
      humanDetected: row.humanDetected,
    });

    return this.toView({ ...row, objects: result.objects as unknown }, result.landingZoneCandidates);
  }

  async getById(id: string): Promise<VisionAnalysisView> {
    const row = await this.prisma.visionAnalysis.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Vision analysis ${id} not found`);
    }
    return this.toView(row, []);
  }

  async listRecent(limit = 20): Promise<VisionAnalysisView[]> {
    const rows = await this.prisma.visionAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map((row) => this.toView(row, []));
  }

  private buildSummary(objects: DetectedObject[], landingZoneCandidates: LandingZoneCandidate[], obstructed: boolean, humanDetected: boolean): string {
    if (humanDetected) {
      return `Human detected — ${objects.length} object(s) in frame`;
    }
    if (obstructed) {
      return `Obstruction detected — ${objects.length} object(s) in frame`;
    }
    return `${objects.length} object(s) detected, ${landingZoneCandidates.length} landing-zone candidate(s), clear`;
  }

  /** `landingZoneCandidates` is only known right after a fresh `analyzeFrame()` call — it isn't persisted per-candidate (only the count is), so a re-read (`getById`/`listRecent`) reports an empty array here rather than fabricating candidates that weren't stored. */
  private toView(row: VisionAnalysisRow, landingZoneCandidates: LandingZoneCandidate[]): VisionAnalysisView {
    return {
      id: row.id,
      droneId: row.droneId,
      missionId: row.missionId,
      deliveryId: row.deliveryId,
      lat: row.lat,
      lng: row.lng,
      altitudeMeters: row.altitudeMeters,
      objects: row.objects as DetectedObject[],
      landingZoneCandidates,
      landingZoneCandidateCount: row.landingZoneCandidateCount,
      obstructed: row.obstructed,
      humanDetected: row.humanDetected,
      modelProvider: row.modelProvider,
      summary: row.summary,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
