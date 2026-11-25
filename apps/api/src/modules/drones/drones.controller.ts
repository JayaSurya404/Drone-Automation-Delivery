import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CurrentUser } from "../users/decorators/current-user.decorator";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { CreateDroneDto } from "./dto/create-drone.dto";
import { ListDronesQueryDto } from "./dto/list-drones-query.dto";
import { SetMaintenanceDto } from "./dto/set-maintenance.dto";
import { UpdateDroneDto } from "./dto/update-drone.dto";
import { DronesService } from "./drones.service";

@Controller("drones")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DronesController {
  constructor(private readonly dronesService: DronesService) {}

  @Get()
  @RequirePermission("drones.read")
  async list(@Query() query: ListDronesQueryDto) {
    return this.dronesService.list(query);
  }

  @Get("fleet-overview")
  @RequirePermission("drones.read")
  async fleetOverview() {
    return this.dronesService.fleetOverview();
  }

  @Get("available")
  @RequirePermission("drones.read")
  async listAvailable(@Query("hubId") hubId?: string) {
    return this.dronesService.listAvailable(hubId);
  }

  @Get(":id")
  @RequirePermission("drones.read")
  async getOne(@Param("id") id: string) {
    return this.dronesService.getById(id);
  }

  @Post()
  @RequirePermission("drones.create")
  async register(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDroneDto) {
    return this.dronesService.register(dto, user);
  }

  @Patch(":id")
  @RequirePermission("drones.update")
  async update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateDroneDto) {
    return this.dronesService.update(id, dto, user);
  }

  @Post(":id/maintenance")
  @RequirePermission("drones.maintenance")
  async setMaintenance(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: SetMaintenanceDto) {
    return this.dronesService.setMaintenance(id, dto, user);
  }

  @Delete(":id")
  @RequirePermission("drones.update")
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.dronesService.remove(id, user);
    return { removed: true };
  }
}
