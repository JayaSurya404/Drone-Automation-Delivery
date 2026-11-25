import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CurrentUser } from "../users/decorators/current-user.decorator";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { CheckPointDto } from "./dto/check-point.dto";
import { CreateGeofenceDto } from "./dto/create-geofence.dto";
import { ListGeofencesQueryDto } from "./dto/list-geofences-query.dto";
import { UpdateGeofenceDto } from "./dto/update-geofence.dto";
import { GeofencingService } from "./geofencing.service";

@Controller("geofences")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GeofencingController {
  constructor(private readonly geofencingService: GeofencingService) {}

  @Get()
  @RequirePermission("geofencing.read")
  async list(@Query() query: ListGeofencesQueryDto) {
    return this.geofencingService.list(query);
  }

  @Get(":id")
  @RequirePermission("geofencing.read")
  async getOne(@Param("id") id: string) {
    return this.geofencingService.getByIdOrThrow(id);
  }

  @Post()
  @RequirePermission("geofencing.update")
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGeofenceDto) {
    return this.geofencingService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermission("geofencing.update")
  async update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateGeofenceDto) {
    return this.geofencingService.update(id, dto, user);
  }

  @Delete(":id")
  @RequirePermission("geofencing.update")
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.geofencingService.remove(id, user);
    return { success: true };
  }

  /** Ad hoc point check used by the admin geofence editor/tester and available for any future caller that needs a one-off containment check without a mission in the picture. */
  @Post("check-point")
  @RequirePermission("geofencing.read")
  async checkPoint(@Body() dto: CheckPointDto) {
    const [serviceArea, restrictedViolations] = await Promise.all([
      this.geofencingService.checkServiceArea(dto),
      this.geofencingService.findPointViolations(dto),
    ]);
    return { serviceArea, restrictedViolations };
  }
}
