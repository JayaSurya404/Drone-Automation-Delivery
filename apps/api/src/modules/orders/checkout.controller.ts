import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RequirePermission } from "../rbac/decorators/require-permission.decorator";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { CurrentUser } from "../users/decorators/current-user.decorator";
import { JwtAuthGuard } from "../users/guards/jwt-auth.guard";
import { GeofencingService, type EligibilityCheckResult } from "../geofencing/geofencing.service";
import { CheckEligibilityDto } from "./dto/check-eligibility.dto";
import { CheckoutDto } from "./dto/checkout.dto";
import { OrdersService } from "./orders.service";

@Controller("checkout")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CheckoutController {
  constructor(
    private readonly geofencingService: GeofencingService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post("eligibility")
  @RequirePermission("orders.create")
  async checkEligibility(@Body() dto: CheckEligibilityDto): Promise<EligibilityCheckResult> {
    return this.geofencingService.checkEligibility(dto.latitude, dto.longitude, dto.clearanceRadiusMeters);
  }

  @Post("orders")
  @RequirePermission("orders.create")
  async checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(user.sub, dto);
  }
}
