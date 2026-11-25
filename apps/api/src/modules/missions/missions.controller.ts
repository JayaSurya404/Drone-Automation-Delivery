import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CurrentUser } from "../users/decorators/current-user.decorator";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { AssignDroneDto } from "./dto/assign-drone.dto";
import { CreateMissionDto } from "./dto/create-mission.dto";
import { ListMissionsQueryDto } from "./dto/list-missions-query.dto";
import { MissionOverrideDto } from "./dto/mission-override.dto";
import { MissionsService } from "./missions.service";

@Controller("missions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get()
  @RequirePermission("missions.read")
  async list(@Query() query: ListMissionsQueryDto) {
    return this.missionsService.listAll(query);
  }

  @Get("by-delivery/:deliveryId")
  @RequirePermission("missions.read")
  async getByDelivery(@Param("deliveryId") deliveryId: string) {
    return this.missionsService.getByDeliveryId(deliveryId);
  }

  /** Fleet-wide safety/incident feed — registered before `:id` so it isn't shadowed by that param route (same precedent as Phase 3's `/products/by-id/:id`). */
  @Get("safety-events")
  @RequirePermission("incidents.read")
  async listSafetyEvents(@Query("limit") limit?: string) {
    return this.missionsService.listSafetyEvents(limit ? Number(limit) : undefined);
  }

  @Get(":id")
  @RequirePermission("missions.read")
  async getOne(@Param("id") id: string) {
    return this.missionsService.getById(id);
  }

  @Get(":id/safety")
  @RequirePermission("missions.read")
  async getSafety(@Param("id") id: string) {
    return this.missionsService.getSafetySnapshot(id);
  }

  @Post(":id/safety/recheck")
  @RequirePermission("missions.update")
  async recheckSafety(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.missionsService.recheckSafety(id, user);
  }

  /** The AI explainability surface (Phase 9) — every route/ETA/risk/drone-recommendation/reroute decision logged for this mission. */
  @Get(":id/ai")
  @RequirePermission("missions.read")
  async getAiDecisions(@Param("id") id: string, @Query("limit") limit?: string) {
    return this.missionsService.getAiDecisions(id, limit ? Number(limit) : undefined);
  }

  @Get(":id/ai/drone-recommendations")
  @RequirePermission("missions.read")
  async getDroneRecommendations(@Param("id") id: string) {
    return this.missionsService.getDroneRecommendations(id);
  }

  @Post(":id/approve")
  @RequirePermission("missions.update")
  async approve(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.missionsService.approve(id, user);
  }

  @Post()
  @RequirePermission("missions.create")
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMissionDto) {
    return this.missionsService.createForDelivery(dto, user);
  }

  @Post(":id/assign-drone")
  @RequirePermission("missions.assign")
  async assignDrone(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: AssignDroneDto) {
    return this.missionsService.assignDrone(id, dto, user);
  }

  @Post(":id/unassign-drone")
  @RequirePermission("missions.assign")
  async unassignDrone(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.missionsService.unassignDrone(id, user);
  }

  @Post(":id/start")
  @RequirePermission("missions.update")
  async start(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.missionsService.start(id, user);
  }

  @Post(":id/progress")
  @RequirePermission("missions.update")
  async progress(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.missionsService.progress(id, user);
  }

  @Post(":id/override")
  @RequirePermission("missions.override")
  async override(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: MissionOverrideDto) {
    return this.missionsService.override(id, dto, user);
  }
}
