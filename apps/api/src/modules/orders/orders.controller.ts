import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CurrentUser } from "../users/decorators/current-user.decorator";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { CheckoutDto } from "./dto/checkout.dto";
import { AdminListOrdersQueryDto, ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("checkout")
  @RequirePermission("orders.create")
  async checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(user.sub, dto);
  }

  @Get()
  @RequirePermission("orders.read_own")
  async listOwn(@CurrentUser() user: AuthenticatedUser, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.listOwnOrders(user.sub, query);
  }

  @Get("admin")
  @RequirePermission("orders.read")
  async listAll(@Query() query: AdminListOrdersQueryDto) {
    return this.ordersService.listAllOrders(query);
  }

  @Get(":id")
  async getOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.ordersService.getOrderForViewer(id, user);
  }

  @Post(":id/cancel")
  @RequirePermission("orders.cancel")
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancelOrder(id, user, dto.reason);
  }
}
