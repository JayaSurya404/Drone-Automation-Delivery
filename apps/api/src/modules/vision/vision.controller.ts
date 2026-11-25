import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { AnalyzeFrameDto } from "./dto/analyze-frame.dto";
import { EvaluateLandingZoneDto } from "./dto/evaluate-landing-zone.dto";
import { LandingZoneService } from "./landing-zone.service";
import { VisionService } from "./vision.service";

const DEFAULT_ANALYSIS_ALTITUDE_METERS = 30;

/** Part 1/2 — computer vision + landing-zone intelligence. Every route is admin/ops-only: `vision.read` for browsing past analyses, `vision.analyze` for triggering a new (simulated) one. No customer-facing route exists here at all (Part 11/12). */
@Controller("vision")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VisionController {
  constructor(
    private readonly visionService: VisionService,
    private readonly landingZoneService: LandingZoneService,
  ) {}

  @Post("analyze")
  @RequirePermission("vision.analyze")
  async analyze(@Body() dto: AnalyzeFrameDto) {
    return this.visionService.analyzeFrame({
      droneId: dto.droneId,
      missionId: dto.missionId,
      deliveryId: dto.deliveryId,
      lat: dto.lat,
      lng: dto.lng,
      altitudeMeters: dto.altitudeMeters ?? DEFAULT_ANALYSIS_ALTITUDE_METERS,
    });
  }

  @Get("analyses")
  @RequirePermission("vision.read")
  async listAnalyses(@Query("limit") limit?: string) {
    return this.visionService.listRecent(limit ? Number(limit) : undefined);
  }

  @Get("analyses/:id")
  @RequirePermission("vision.read")
  async getAnalysis(@Param("id") id: string) {
    return this.visionService.getById(id);
  }

  @Post("landing-zones/evaluate")
  @RequirePermission("vision.analyze")
  async evaluateLandingZone(@Body() dto: EvaluateLandingZoneDto) {
    return this.landingZoneService.evaluate(dto);
  }

  @Get("landing-zones")
  @RequirePermission("vision.read")
  async listLandingZoneEvaluations(@Query("limit") limit?: string) {
    return this.landingZoneService.listRecent(limit ? Number(limit) : undefined);
  }

  @Get("landing-zones/:id")
  @RequirePermission("vision.read")
  async getLandingZoneEvaluation(@Param("id") id: string) {
    return this.landingZoneService.getById(id);
  }
}
