import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CurrentUser } from "../users/decorators/current-user.decorator";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { CartService, type CartView } from "./cart.service";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

@Controller("cart")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission("cart.manage")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<CartView> {
    return this.cartService.getCart(user.sub);
  }

  @Post("items")
  async addItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddCartItemDto): Promise<CartView> {
    return this.cartService.addItem(user.sub, dto);
  }

  @Patch("items/:itemId")
  async updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartView> {
    return this.cartService.updateItem(user.sub, itemId, dto);
  }

  @Delete("items/:itemId")
  async removeItem(@CurrentUser() user: AuthenticatedUser, @Param("itemId") itemId: string): Promise<CartView> {
    return this.cartService.removeItem(user.sub, itemId);
  }

  @Delete()
  async clear(@CurrentUser() user: AuthenticatedUser): Promise<CartView> {
    return this.cartService.clearCart(user.sub);
  }
}
