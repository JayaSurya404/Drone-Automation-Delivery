import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { RouteIntelligenceQueryDto } from "./dto/route-intelligence-query.dto";
import { RouteIntelligenceService } from "./route-intelligence.service";

/** Part 8 — shared route intelligence, derived live from historical mission data. Admin/ops-only (`route_intel.read`); no customer route exists here. */
@Controller("route-intelligence")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission("route_intel.read")
export class RouteIntelligenceController {
  constructor(private readonly routeIntelligenceService: RouteIntelligenceService) {}

  @Get()
  async getObservations(@Query() query: RouteIntelligenceQueryDto) {
    return this.routeIntelligenceService.getObservations(
      { lat: query.originLat, lng: query.originLng },
      { lat: query.destinationLat, lng: query.destinationLng },
    );
  }
}
