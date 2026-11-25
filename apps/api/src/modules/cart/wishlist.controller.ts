import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CurrentUser } from "../users/decorators/current-user.decorator";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { AddWishlistItemDto } from "./dto/add-wishlist-item.dto";
import { WishlistService, type WishlistItemView } from "./wishlist.service";

@Controller("wishlist")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission("wishlist.manage")
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<WishlistItemView[]> {
    return this.wishlistService.list(user.sub);
  }

  @Post("items")
  async addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddWishlistItemDto,
  ): Promise<WishlistItemView[]> {
    return this.wishlistService.addItem(user.sub, dto.productId);
  }

  @Delete("items/:productId")
  async removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("productId") productId: string,
  ): Promise<WishlistItemView[]> {
    return this.wishlistService.removeItem(user.sub, productId);
  }
}
