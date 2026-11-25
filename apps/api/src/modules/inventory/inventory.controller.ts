import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CurrentUser } from "../users/decorators/current-user.decorator";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { ListInventoryQueryDto } from "./dto/list-inventory-query.dto";
import { InventoryService } from "./inventory.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("inventory")
  @RequirePermission("inventory.read")
  async list(@Query() query: ListInventoryQueryDto) {
    return this.inventoryService.listInventory(query);
  }

  @Get("hubs")
  @RequirePermission("inventory.read")
  async listHubs() {
    return this.inventoryService.listHubs();
  }

  @Patch("inventory/:id")
  @RequirePermission("inventory.update")
  async adjust(
    @Param("id") id: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.inventoryService.adjustStock(id, dto, currentUser.sub);
  }
}
